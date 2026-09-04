"""Miniaturas, servidas desde el propio worker.

Dos razones para no dejar que el navegador las cargue desde su origen:

1. La app se sirve con `Cross-Origin-Embedder-Policy: require-corp`. Un
   `<img src="https://i.ytimg.com/...">` es una carga *no-cors*, y COEP la
   bloquea salvo que el origen envíe CORP, cosa que esos CDN no hacen.
2. YouTube sirve WebP, que MP3 no admite como carátula embebida. Al pasar por
   aquí se normaliza a JPEG y el navegador puede usarla tal cual con
   `-c:v copy`, sin recodificar nada en WebAssembly.
"""

from __future__ import annotations

import asyncio

import httpx

MAX_SOURCE_BYTES = 8 * 1024 * 1024
MAX_EDGE_PX = 640

# Varios CDN de imágenes responden 403 a un cliente sin User-Agent. Sin esto,
# miniaturas perfectamente públicas fallan sin motivo aparente.
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/140.0 Safari/537.36"
    ),
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
}


class ThumbnailError(RuntimeError):
    pass


async def fetch_thumbnail(url: str, *, timeout: float = 15.0) -> bytes:
    """Descarga la imagen original, con tope de tamaño."""
    async with (
        httpx.AsyncClient(timeout=timeout, follow_redirects=True, headers=_HEADERS) as client,
        client.stream("GET", url) as response,
    ):
        if response.status_code != 200:
            raise ThumbnailError(f"La miniatura respondió {response.status_code}.")

        chunks: list[bytes] = []
        total = 0
        async for chunk in response.aiter_bytes():
            total += len(chunk)
            if total > MAX_SOURCE_BYTES:
                raise ThumbnailError("La miniatura es demasiado grande.")
            chunks.append(chunk)

    if not chunks:
        raise ThumbnailError("La miniatura vino vacía.")
    return b"".join(chunks)


async def to_jpeg(data: bytes, *, timeout: float = 20.0) -> bytes:
    """Convierte a JPEG y limita el lado mayor, con ffmpeg por tubería."""
    args = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-i", "pipe:0",
        # `min(...,iw)` solo reduce: una miniatura pequeña no se agranda.
        # `-2` deja que la altura siga la proporción y salga par, que es lo que
        # exige el submuestreo de croma del JPEG.
        "-vf", f"scale='min({MAX_EDGE_PX},iw)':-2",
        "-frames:v", "1",
        "-f", "mjpeg", "-q:v", "4",
        "pipe:1",
    ]
    process = await asyncio.create_subprocess_exec(
        *args,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(process.communicate(data), timeout=timeout)
    except TimeoutError:
        process.kill()
        await process.wait()
        raise ThumbnailError("La conversión de la miniatura tardó demasiado.") from None

    if process.returncode != 0 or not stdout:
        raise ThumbnailError(stderr.decode("utf-8", "replace")[-200:] or "ffmpeg falló.")
    return stdout
