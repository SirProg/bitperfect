export type FormatId = 'mp3' | 'aac' | 'ogg' | 'opus' | 'flac' | 'wav' | 'alac' | 'aiff'

/** Bits por muestra. Solo aplica a formatos sin pérdida / PCM. */
export type BitDepth = 16 | 24 | 32

export type Channels = 1 | 2

export type PresetId = 'maxQuality' | 'balanced' | 'mobile' | 'custom'

/**
 * Opciones de una conversión. Todos los campos opcionales significan
 * "deja que ffmpeg decida" o "no aplica a este formato": `buildArgs` omite
 * los que el formato de destino no soporta, leyendo el catálogo.
 */
export interface ConversionOptions {
  format: FormatId
  preset: PresetId
  /** kbps. Solo formatos con pérdida. */
  bitrateKbps?: number
  /** Hz. `undefined` conserva el del original. */
  sampleRate?: number
  /** Solo formatos sin pérdida / PCM. `undefined` conserva el del original. */
  bitDepth?: BitDepth
  /** `undefined` conserva los canales del original. */
  channels?: Channels
  /** 0–8. Solo FLAC. No afecta a la calidad, solo a tamaño y tiempo. */
  flacCompression?: number
  preserveMetadata: boolean
  preserveCoverArt: boolean
}

/** Tags leídos del archivo de origen, para mostrarlos en la interfaz. */
export interface TrackMetadata {
  title?: string
  artist?: string
  album?: string
  year?: number
  trackNumber?: number
  /** Segundos. Necesario para calcular el progreso real de la conversión. */
  duration?: number
  sampleRate?: number
  bitDepth?: number
  channels?: number
  bitrate?: number
  codec?: string
  container?: string
  /** Object URL de la carátula embebida, si la hay. Debe revocarse al limpiar. */
  coverUrl?: string
  coverMimeType?: string
}

export type QueueItemStatus =
  | 'queued'
  | 'reading-metadata'
  | 'converting'
  | 'done'
  | 'error'
  | 'cancelled'

export interface ConversionResult {
  blob: Blob
  url: string
  filename: string
  size: number
}

export interface QueueItem {
  id: string
  file: File
  status: QueueItemStatus
  /** 0–1. Solo significativo mientras `status === 'converting'`. */
  progress: number
  options: ConversionOptions
  sourceMetadata?: TrackMetadata
  /** Object URL del archivo original, para la previsualización "antes". */
  sourceUrl?: string
  result?: ConversionResult
  error?: string
  /** Milisegundos que tardó la conversión. */
  elapsedMs?: number
}
