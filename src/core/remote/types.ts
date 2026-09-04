/** Formas que devuelve el worker. Espejo de `worker/app/models.py`. */

export interface WorkerHealth {
  ok: boolean
  ytdlpVersion: string | null
  ffmpeg: boolean
  requiresToken: boolean
  maxDurationSec: number
}

export interface ProbedTrack {
  title: string
  uploader: string | null
  durationSec: number | null
  ext: string | null
  acodec: string | null
  abr: number | null
  filesizeApprox: number | null
  extractor: string
  webpageUrl: string | null
  isLive: boolean
  /** Ruta relativa dentro del worker, no la URL original de la miniatura. */
  thumbnailPath: string | null
}

export interface WorkerSettings {
  /** URL base del worker, sin barra final. Vacío significa «sin configurar». */
  url: string
  token: string
}

export const EMPTY_SETTINGS: WorkerSettings = { url: '', token: '' }
