import type { ConversionOptions, TrackMetadata } from '../../types'
import { extensionOf } from '../ffmpeg/buildArgs'
import { isLossyCodec } from '../metadata/read'
import { getFormat, LOSSY_EXTENSIONS } from './catalog'

/** Tope por archivo, en bytes. El README anuncia 500 MB. */
export const MAX_FILE_BYTES = 500 * 1024 * 1024

export type FileRejection = 'too-large' | 'empty' | 'not-audio'

export function validateFile(file: File): FileRejection | null {
  if (file.size === 0) return 'empty'
  if (file.size > MAX_FILE_BYTES) return 'too-large'
  const ext = extensionOf(file.name)
  const looksLikeAudio = file.type.startsWith('audio/') || file.type === 'application/ogg' || ext !== ''
  return looksLikeAudio ? null : 'not-audio'
}

/**
 * ¿El origen es con pérdida? Se prefiere el códec real leído del archivo; si no
 * se pudo leer, se cae a la extensión, que acierta en la práctica totalidad de
 * los casos.
 */
export function sourceIsLossy(file: File, meta: TrackMetadata | undefined): boolean {
  return isLossyCodec(meta) ?? LOSSY_EXTENSIONS.has(extensionOf(file.name))
}

/**
 * Convertir de un formato con pérdida a uno sin pérdida no recupera nada de lo
 * que ya se perdió: el archivo crece mucho sin ganar detalle. No se bloquea,
 * solo se avisa — a veces es justo lo que el usuario quiere (compatibilidad
 * con un reproductor, edición posterior).
 */
export function isPointlessUpconversion(
  file: File,
  meta: TrackMetadata | undefined,
  options: ConversionOptions,
): boolean {
  return !getFormat(options.format).lossy && sourceIsLossy(file, meta)
}

/**
 * Reconvertir entre dos formatos con pérdida encadena dos compresiones y
 * degrada el sonido, aunque se suba el bitrate.
 */
export function isLossyToLossy(
  file: File,
  meta: TrackMetadata | undefined,
  options: ConversionOptions,
): boolean {
  return getFormat(options.format).lossy && sourceIsLossy(file, meta)
}

/** Subir el sample rate por encima del original no añade información. */
export function isUpsampling(meta: TrackMetadata | undefined, options: ConversionOptions): boolean {
  const source = meta?.sampleRate
  return source !== undefined && options.sampleRate !== undefined && options.sampleRate > source
}

/** Subir la profundidad de bits por encima de la original tampoco añade nada. */
export function isUpscalingBitDepth(
  meta: TrackMetadata | undefined,
  options: ConversionOptions,
): boolean {
  const source = meta?.bitDepth
  return source !== undefined && options.bitDepth !== undefined && options.bitDepth > source
}

export type WarningId = 'upconversion' | 'lossyToLossy' | 'upsampling' | 'bitDepthUpscale' | 'noCoverSupport'

/** Todos los avisos aplicables a esta combinación, para pintarlos en la interfaz. */
export function collectWarnings(
  file: File,
  meta: TrackMetadata | undefined,
  options: ConversionOptions,
): WarningId[] {
  const warnings: WarningId[] = []
  if (isPointlessUpconversion(file, meta, options)) warnings.push('upconversion')
  if (isLossyToLossy(file, meta, options)) warnings.push('lossyToLossy')
  if (isUpsampling(meta, options)) warnings.push('upsampling')
  if (isUpscalingBitDepth(meta, options)) warnings.push('bitDepthUpscale')
  if (options.preserveCoverArt && meta?.coverUrl && !getFormat(options.format).supports.coverArt) {
    warnings.push('noCoverSupport')
  }
  return warnings
}
