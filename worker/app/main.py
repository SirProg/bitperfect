"""API del worker de BitPerfect.

Extrae audio de una URL y lo devuelve tal cual. **No convierte**: eso sigue
ocurriendo en el navegador del usuario con ffmpeg.wasm, que es lo que mantiene
en pie la propuesta del proyecto.
"""

from __future__ import annotations

import asyncio
import hmac
import shutil
import tempfile
from collections.abc import AsyncIterator
from pathlib import Path
from urllib.parse import quote

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse

from . import ytdlp
from .config import Config
from .models import HealthResponse, ProbeResponse, UrlRequest
from .security import UrlRejected, assert_safe_url
from .thumbs import ThumbnailError, fetch_thumbnail, to_jpeg

config = Config.from_env()

app = FastAPI(
    title="BitPerfect worker",
    description="Extrae audio de una URL para que BitPerfect lo convierta en el navegador.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.allowed_origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    # Sin esto el navegador no puede leer el nombre de archivo que enviamos.
    expose_headers=["X-BitPerfect-Filename", "X-BitPerfect-Ext", "Content-Length"],
    max_age=600,
)

# yt-dlp es intensivo en red y CPU. Servir varias descargas a la vez en una
# máquina pequeña solo consigue que todas vayan mal.
_slots = asyncio.Semaphore(max(1, config.max_concurrent))


def require_token(authorization: str | None = Header(default=None)) -> None:
    if config.token is None:
        return
    expected = f"Bearer {config.token}"
    # Comparación en tiempo constante para no filtrar el token carácter a carácter.
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Token del worker incorrecto o ausente.")


@app.exception_handler(UrlRejected)
async def _url_rejected(_: Request, exc: UrlRejected) -> JSONResponse:
    return JSONResponse(status_code=400, content={"error": str(exc)})


@app.exception_handler(ytdlp.YtdlpError)
async def _ytdlp_failed(_: Request, exc: ytdlp.YtdlpError) -> JSONResponse:
    return JSONResponse(status_code=502, content={"error": exc.message, "detail": exc.detail})


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Estado y versión. La app lo usa para confirmar que el worker responde.

    Que la versión de yt-dlp esté a la vista es deliberado: quedarse atrás es la
    causa número uno de que un extractor deje de funcionar.
    """
    return HealthResponse(
        ok=True,
        ytdlpVersion=ytdlp.ytdlp_version(),
        ffmpeg=ytdlp.has_ffmpeg(),
        requiresToken=config.token is not None,
        maxDurationSec=config.max_duration_sec,
    )


def _guard_duration(result: ytdlp.ProbeResult) -> None:
    if result.is_live:
        raise HTTPException(status_code=400, detail="No se pueden descargar emisiones en directo.")
    duration = result.duration
    if duration is not None and duration > config.max_duration_sec:
        minutes = config.max_duration_sec // 60
        raise HTTPException(
            status_code=413,
            detail=f"La pista dura más del máximo permitido ({minutes} minutos).",
        )


@app.post("/probe", response_model=ProbeResponse, dependencies=[Depends(require_token)])
async def probe(body: UrlRequest) -> ProbeResponse:
    """Qué hay en esa URL, sin descargar el medio.

    Existe para que el usuario vea lo que va a bajar antes de bajarlo, y para
    poder rechazar por duración sin gastar ancho de banda.
    """
    url = assert_safe_url(body.url, allow_private=config.allow_private_hosts)

    async with _slots:
        result = await ytdlp.probe(url, config)

    _guard_duration(result)
    raw = result.raw

    thumbnail = result.thumbnail
    thumb_path = f"/thumb?u={quote(thumbnail, safe='')}" if thumbnail else None

    return ProbeResponse(
        title=raw.get("title") or "audio",
        uploader=raw.get("uploader") or raw.get("channel") or raw.get("creator"),
        durationSec=result.duration,
        ext=raw.get("ext"),
        acodec=raw.get("acodec") if raw.get("acodec") != "none" else None,
        abr=raw.get("abr"),
        filesizeApprox=raw.get("filesize") or raw.get("filesize_approx"),
        extractor=raw.get("extractor_key") or raw.get("extractor") or "desconocido",
        webpageUrl=raw.get("webpage_url"),
        isLive=result.is_live,
        thumbnailPath=thumb_path,
    )


@app.get("/thumb", dependencies=[Depends(require_token)])
async def thumb(u: str = Query(min_length=1, max_length=2048)) -> Response:
    """Miniatura normalizada a JPEG y servida desde este origen."""
    url = assert_safe_url(u, allow_private=config.allow_private_hosts)
    try:
        jpeg = await to_jpeg(await fetch_thumbnail(url))
    except ThumbnailError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return Response(
        content=jpeg,
        media_type="image/jpeg",
        headers={
            # Esta sí hace falta: es una carga *no-cors* desde un `<img>`, y sin
            # CORP el COEP de la app la descartaría.
            "Cross-Origin-Resource-Policy": "cross-origin",
            "Cache-Control": "public, max-age=3600",
        },
    )


@app.post("/download", dependencies=[Depends(require_token)])
async def download(body: UrlRequest) -> StreamingResponse:
    """Los bytes del mejor audio disponible, sin convertir.

    Se descarga a un temporal y luego se transmite con `Content-Length` real,
    para que la barra de progreso del navegador sea exacta durante la
    transferencia. La fase de servidor no informa de avance; es una limitación
    conocida de esta versión.
    """
    url = assert_safe_url(body.url, allow_private=config.allow_private_hosts)

    async with _slots:
        info = await ytdlp.probe(url, config)
        _guard_duration(info)

        workdir = Path(tempfile.mkdtemp(prefix="bitperfect-"))
        try:
            produced = await ytdlp.download(url, workdir, config)
        except BaseException:
            shutil.rmtree(workdir, ignore_errors=True)
            raise

    size = produced.stat().st_size
    if size == 0:
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=502, detail="La descarga salió vacía.")
    if size > config.max_bytes:
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=413, detail="El audio supera el tamaño máximo permitido.")

    filename = ytdlp.safe_filename(info.raw.get("title") or "audio", produced.suffix)

    async def stream() -> AsyncIterator[bytes]:
        try:
            with produced.open("rb") as handle:
                while chunk := handle.read(256 * 1024):
                    yield chunk
        finally:
            # El temporal se borra pase lo que pase, incluso si el cliente corta.
            shutil.rmtree(workdir, ignore_errors=True)

    return StreamingResponse(
        stream(),
        media_type="application/octet-stream",
        headers={
            "Content-Length": str(size),
            "X-BitPerfect-Filename": quote(filename),
            "X-BitPerfect-Ext": produced.suffix.lstrip("."),
            "Cross-Origin-Resource-Policy": "cross-origin",
        },
    )
