import type { BitDepth, ConversionOptions } from '../../types'
import { getFormat } from '../formats/catalog'

/** Nombres dentro del sistema de archivos virtual de ffmpeg.wasm. */
export const INPUT_FILENAME = 'input'
export const OUTPUT_FILENAME = 'output'

/**
 * Nombre del archivo dentro del FS virtual. La extensión importa: ffmpeg
 * elige demuxer y muxer a partir de ella.
 */
export function virtualInputName(sourceFilename: string): string {
  const ext = extensionOf(sourceFilename)
  return ext ? `${INPUT_FILENAME}.${ext}` : INPUT_FILENAME
}

export function virtualOutputName(options: ConversionOptions): string {
  return `${OUTPUT_FILENAME}.${getFormat(options.format).extension}`
}

/** Nombre con el que se descarga el resultado: el original con la extensión nueva. */
export function downloadFilename(sourceFilename: string, options: ConversionOptions): string {
  const base = sourceFilename.replace(/\.[^./\\]+$/, '') || 'audio'
  return `${base}.${getFormat(options.format).extension}`
}

export function extensionOf(filename: string): string {
  const match = /\.([^./\\]+)$/.exec(filename)
  return match ? match[1].toLowerCase() : ''
}

/**
 * Traduce las opciones de la interfaz a la línea de comandos de ffmpeg.
 *
 * Es una función pura y sin dependencias de React ni del DOM: es donde vive
 * el conocimiento sobre cada formato y donde se concentran los tests.
 *
 * Reglas que aplica:
 * - Cualquier opción que el formato de destino no declare en su catálogo se
 *   descarta en silencio (p. ej. bitrate al convertir a WAV).
 * - Un sample rate que el encoder no admita se descarta en vez de emitirse,
 *   porque ffmpeg abortaría la conversión.
 * - La carátula solo se mapea en formatos que la admiten; en el resto se usa
 *   `-vn` para no arrastrar el stream de imagen.
 */
export function buildArgs(sourceFilename: string, options: ConversionOptions): string[] {
  const spec = getFormat(options.format)
  const args: string[] = ['-i', virtualInputName(sourceFilename)]

  // --- Selección de streams y carátula ---
  args.push('-map', '0:a:0')
  if (options.preserveCoverArt && spec.supports.coverArt) {
    // El `?` hace el mapeo opcional: sin carátula en el origen, no falla.
    args.push('-map', '0:v?', '-c:v', 'copy', '-disposition:v', 'attached_pic')
  } else {
    args.push('-vn')
  }

  // --- Metadatos ---
  args.push('-map_metadata', options.preserveMetadata ? '0' : '-1')
  if (options.format === 'mp3' && options.preserveMetadata) {
    // ID3v2.3 tiene mucha mejor compatibilidad con reproductores que 2.4,
    // que es el que ffmpeg escribe por defecto.
    args.push('-id3v2_version', '3')
  }

  // --- Códec de audio y parámetros propios del formato ---
  args.push('-c:a', encoderFor(options))

  // Ajustes fijos del encoder (rodeos a defectos del build de ffmpeg.wasm).
  if (spec.encoderArgs) args.push(...spec.encoderArgs)

  if (spec.supports.bitrate && options.bitrateKbps !== undefined) {
    args.push('-b:a', `${options.bitrateKbps}k`)
  }

  if (spec.supports.bitDepth && options.bitDepth !== undefined) {
    const sampleFormat = spec.sampleFormats?.[options.bitDepth]
    if (sampleFormat) args.push('-sample_fmt', sampleFormat)
    // FLAC y ALAC no tienen un sample format de 24 bits: se usa el de 32 y se
    // declara la profundidad real, o el archivo saldría como 32 bits.
    if (options.bitDepth === 24 && sampleFormat) {
      args.push('-bits_per_raw_sample', '24')
    }
  }

  if (spec.supports.flacCompression && options.flacCompression !== undefined) {
    args.push('-compression_level', String(clamp(options.flacCompression, 0, 8)))
  }

  // --- Parámetros comunes ---
  if (spec.supports.sampleRate && options.sampleRate !== undefined) {
    // Un sample rate no admitido aborta la conversión, así que se ignora.
    if (spec.sampleRates.includes(options.sampleRate)) {
      args.push('-ar', String(options.sampleRate))
    }
  }

  if (spec.supports.channels && options.channels !== undefined) {
    args.push('-ac', String(options.channels))
  }

  args.push(virtualOutputName(options))
  return args
}

/**
 * En WAV y AIFF la profundidad de bits se elige cambiando de encoder PCM;
 * en el resto de formatos el encoder es fijo.
 */
function encoderFor(options: ConversionOptions): string {
  const spec = getFormat(options.format)
  if (spec.pcmEncoders && options.bitDepth !== undefined) {
    return spec.pcmEncoders[options.bitDepth] ?? spec.encoder
  }
  return spec.encoder
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Profundidades que el formato ofrece, para poblar el selector. */
export function availableBitDepths(options: Pick<ConversionOptions, 'format'>): BitDepth[] {
  return getFormat(options.format).bitDepths
}
