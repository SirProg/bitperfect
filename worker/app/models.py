"""Formas de entrada y salida de la API.

Los nombres salen en camelCase porque los consume TypeScript directamente.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class UrlRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2048)


class ProbeResponse(BaseModel):
    """Lo que se sabe de la pista antes de descargar nada."""

    title: str
    uploader: str | None = None
    durationSec: float | None = None
    ext: str | None = None
    acodec: str | None = None
    abr: float | None = None
    filesizeApprox: int | None = None
    extractor: str
    webpageUrl: str | None = None
    isLive: bool = False
    # Ruta relativa dentro del propio worker, no la URL original: servirla desde
    # aquí evita que COEP bloquee la imagen y garantiza que llegue en JPEG.
    thumbnailPath: str | None = None


class HealthResponse(BaseModel):
    ok: bool
    ytdlpVersion: str | None
    ffmpeg: bool
    requiresToken: bool
    maxDurationSec: int


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None
