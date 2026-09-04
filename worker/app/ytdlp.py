"""Envoltorio sobre el binario de yt-dlp.

Se invoca como subproceso y no como librería a propósito: actualizarlo pasa a
ser `pip install -U yt-dlp` sin quedar acoplados a su API interna, que no es
pública ni estable. Los extractores se rompen a menudo cuando las fuentes
cambian, así que poder actualizar sin tocar código es lo que mantiene esto vivo.
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from functools import cache
from pathlib import Path

from .config import Config


class YtdlpError(RuntimeError):
    """Fallo de extracción. `message` es apto para mostrar al usuario."""

    def __init__(self, message: str, *, detail: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.detail = detail


# Frases que yt-dlp escribe en stderr y que sabemos traducir a algo útil.
_KNOWN_FAILURES: list[tuple[str, str]] = [
    ("sign in to confirm", "La fuente pide iniciar sesión para confirmar que no eres un bot. "
                           "Suele pasar al salir desde una IP de centro de datos."),
    ("private video", "El contenido es privado."),
    ("video unavailable", "El contenido ya no está disponible."),
    ("members-only", "El contenido es solo para miembros."),
    ("unsupported url", "No hay ningún extractor para esa dirección."),
    ("no video formats", "No se encontró ninguna pista de audio en esa dirección."),
    ("age-restricted", "El contenido tiene restricción de edad y requiere sesión."),
    ("requested format is not available", "La fuente no ofrece una pista de audio descargable."),
]


def _humanise(stderr: str) -> str:
    low = stderr.lower()
    for needle, message in _KNOWN_FAILURES:
        if needle in low:
            return message
    return "La fuente rechazó la petición o no se pudo extraer el audio."


@cache
def ytdlp_binary() -> str | None:
    """Ruta del ejecutable de yt-dlp.

    Se mira primero junto al intérprete actual: dentro de un entorno virtual,
    `yt-dlp` vive en el mismo `bin/` que Python pero puede no estar en el PATH
    del proceso. Buscar solo en el PATH hace que el worker crea que no está
    instalado cuando sí lo está.
    """
    beside_python = Path(sys.executable).parent / "yt-dlp"
    if beside_python.is_file() and os.access(beside_python, os.X_OK):
        return str(beside_python)
    return shutil.which("yt-dlp")


def ytdlp_version() -> str | None:
    binary = ytdlp_binary()
    if binary is None:
        return None
    try:
        out = subprocess.run(
            [binary, "--version"], capture_output=True, text=True, timeout=15, check=False
        )
        return out.stdout.strip() or None
    except (OSError, subprocess.SubprocessError):
        return None


def has_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None


def _base_args(config: Config) -> list[str]:
    binary = ytdlp_binary()
    if binary is None:
        raise YtdlpError("yt-dlp no está instalado en este worker.")
    args = [
        binary,
        "--no-playlist",          # una pista por URL, es el alcance acordado
        "--playlist-items", "1",  # cinturón y tirantes si la URL es una lista
        "--no-warnings",
        "--no-progress",
        "--socket-timeout", "20",
        "--retries", "2",
    ]
    if config.cookies_file:
        args += ["--cookies", config.cookies_file]
    return args


async def _run(args: list[str], timeout: int) -> tuple[int, bytes, bytes]:
    process = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout)
    except TimeoutError:
        process.kill()
        await process.wait()
        raise YtdlpError("La fuente tardó demasiado en responder.") from None
    return process.returncode or 0, stdout, stderr


@dataclass
class ProbeResult:
    raw: dict

    @property
    def duration(self) -> float | None:
        value = self.raw.get("duration")
        return float(value) if isinstance(value, (int, float)) else None

    @property
    def is_live(self) -> bool:
        return bool(self.raw.get("is_live") or self.raw.get("live_status") == "is_live")

    @property
    def thumbnail(self) -> str | None:
        direct = self.raw.get("thumbnail")
        if isinstance(direct, str) and direct:
            return direct
        # Si no hay `thumbnail`, se coge la mayor de la lista.
        thumbs = self.raw.get("thumbnails")
        if isinstance(thumbs, list) and thumbs:
            best = max(
                (t for t in thumbs if isinstance(t, dict) and t.get("url")),
                key=lambda t: (t.get("preference") or 0, t.get("width") or 0),
                default=None,
            )
            if best:
                return best.get("url")
        return None


# Selección de formato. La usan `probe` y `download` por igual: si la consulta
# describiera un formato distinto del que luego se descarga, la ficha mentiría
# —el tamaño estimado sería el del vídeo completo, no el del audio suelto—.
AUDIO_FORMAT = "bestaudio/best"


async def probe(url: str, config: Config) -> ProbeResult:
    """Metadatos sin descargar el medio."""
    args = _base_args(config) + [
        "--format", AUDIO_FORMAT,
        "--dump-single-json",
        "--skip-download",
        url,
    ]
    code, stdout, stderr = await _run(args, config.probe_timeout_sec)

    if code != 0 or not stdout.strip():
        raise YtdlpError(_humanise(stderr.decode("utf-8", "replace")),
                         detail=stderr.decode("utf-8", "replace")[-500:])

    try:
        data = json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise YtdlpError("La fuente devolvió una respuesta ilegible.") from exc

    # Con `--no-playlist` una lista puede venir igualmente envuelta.
    if data.get("_type") == "playlist":
        entries = data.get("entries") or []
        if not entries:
            raise YtdlpError("Esa dirección no contiene ninguna pista.")
        data = entries[0]

    return ProbeResult(raw=data)


async def download(url: str, dest_dir: Path, config: Config) -> Path:
    """Descarga el mejor audio disponible y devuelve la ruta del archivo."""
    template = str(dest_dir / "audio.%(ext)s")
    args = _base_args(config) + [
        # Se prefiere audio puro; `best` solo como último recurso para fuentes
        # que no separan pistas (TikTok e Instagram, habitualmente).
        "--format", AUDIO_FORMAT,
        "--no-part",
        "--max-filesize", str(config.max_bytes),
        "--output", template,
        "--print", "after_move:filepath",
        "--no-simulate",
        url,
    ]
    code, stdout, stderr = await _run(args, config.download_timeout_sec)

    if code != 0:
        raise YtdlpError(_humanise(stderr.decode("utf-8", "replace")),
                         detail=stderr.decode("utf-8", "replace")[-500:])

    printed = stdout.decode("utf-8", "replace").strip().splitlines()
    for line in reversed(printed):
        candidate = Path(line.strip())
        if line.strip() and candidate.is_file():
            return candidate

    # `--print` puede quedarse corto en algún extractor: se busca lo que haya.
    produced = [p for p in dest_dir.iterdir() if p.is_file()]
    if not produced:
        raise YtdlpError("La descarga terminó sin producir ningún archivo.")
    return max(produced, key=lambda p: p.stat().st_size)


def safe_filename(title: str, ext: str) -> str:
    """Nombre de archivo utilizable en cualquier sistema, a partir del título."""
    cleaned = "".join(
        "_" if ch in '<>:"/\\|?*' or ord(ch) < 32 else ch for ch in (title or "audio")
    ).strip(" .")
    cleaned = cleaned[:120].strip() or "audio"
    suffix = (ext or "bin").lstrip(".")
    return f"{cleaned}.{suffix}"


def cleanup(path: Path) -> None:
    try:
        if path.exists():
            os.unlink(path)
    except OSError:
        pass
