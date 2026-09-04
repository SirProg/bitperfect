"""Configuración por variables de entorno.

El worker lo levanta cada usuario en su propia infraestructura, así que la
configuración tiene que ser explícita y con valores por defecto seguros.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


class ConfigError(RuntimeError):
    """Configuración inválida. Se lanza al arrancar, nunca en caliente."""


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError as exc:
        raise ConfigError(f"{name} debe ser un entero, se recibió {raw!r}") from exc


def _env_list(name: str, default: list[str]) -> list[str]:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


DEFAULT_ORIGINS = [
    "https://bitperfect.vercel.app",
    "http://localhost:5173",
    "http://localhost:4173",
]


@dataclass(frozen=True)
class Config:
    token: str | None
    allow_anonymous: bool
    allowed_origins: list[str] = field(default_factory=lambda: list(DEFAULT_ORIGINS))
    max_duration_sec: int = 1800
    max_bytes: int = 500 * 1024 * 1024
    probe_timeout_sec: int = 45
    download_timeout_sec: int = 600
    max_concurrent: int = 1
    cookies_file: str | None = None
    allow_private_hosts: bool = False

    @classmethod
    def from_env(cls) -> Config:
        token = os.environ.get("WORKER_TOKEN") or None
        allow_anonymous = _env_bool("ALLOW_ANONYMOUS")

        # Un endpoint yt-dlp accesible y anónimo se descubre y se abusa, y el
        # ancho de banda lo paga quien lo levantó. Negarse a arrancar es más
        # amable que dejarlo abierto sin que nadie se entere.
        if token is None and not allow_anonymous:
            raise ConfigError(
                "Falta WORKER_TOKEN. Define un token, o pon ALLOW_ANONYMOUS=true "
                "si de verdad quieres un worker abierto a cualquiera."
            )

        cookies = os.environ.get("YTDLP_COOKIES_FILE") or None
        if cookies and not os.path.isfile(cookies):
            raise ConfigError(f"YTDLP_COOKIES_FILE apunta a algo que no existe: {cookies}")

        return cls(
            token=token,
            allow_anonymous=allow_anonymous,
            allowed_origins=_env_list("ALLOWED_ORIGINS", list(DEFAULT_ORIGINS)),
            max_duration_sec=_env_int("MAX_DURATION_SEC", 1800),
            max_bytes=_env_int("MAX_BYTES", 500 * 1024 * 1024),
            probe_timeout_sec=_env_int("PROBE_TIMEOUT_SEC", 45),
            download_timeout_sec=_env_int("DOWNLOAD_TIMEOUT_SEC", 600),
            max_concurrent=_env_int("MAX_CONCURRENT", 1),
            cookies_file=cookies,
            # Solo para pruebas en local contra un servidor propio.
            allow_private_hosts=_env_bool("ALLOW_PRIVATE_HOSTS"),
        )
