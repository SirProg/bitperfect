import type { ConversionOptions, FormatId, PresetId, TrackMetadata } from '../../types'
import { getFormat } from './catalog'

export const PRESET_IDS: PresetId[] = ['maxQuality', 'balanced', 'mobile', 'custom']

/**
 * Un preset no puede ser una tabla fija de valores: "máxima calidad" significa
 * 320 kbps en MP3 pero compresión 8 y 24 bits en FLAC, y en WAV no significa
 * nada relacionado con el bitrate. Por eso cada preset se resuelve contra el
 * formato de destino y, cuando se conoce, contra el original.
 *
 * Devuelve solo los campos que el preset fija; el resto se hereda de las
 * opciones actuales.
 */
export function applyPreset(
  preset: PresetId,
  format: FormatId,
  source?: TrackMetadata,
): Partial<ConversionOptions> {
  if (preset === 'custom') return {}

  const spec = getFormat(format)

  if (spec.lossy) {
    const bitrateKbps = pickBitrate(preset, format)
    return {
      bitrateKbps,
      // Sin pérdida de generalidad se conserva el sample rate del original
      // salvo en el preset de móvil, donde bajar a 44.1 kHz ahorra espacio.
      sampleRate: preset === 'mobile' ? nearestSupported(44100, format) : undefined,
      channels: undefined,
      preserveMetadata: true,
      preserveCoverArt: preset !== 'mobile',
    }
  }

  // Formatos sin pérdida: la "calidad" no depende del bitrate sino de conservar
  // la profundidad y la frecuencia del original.
  const sourceDepth = source?.bitDepth
  return {
    bitDepth: preset === 'mobile' ? 16 : pickBitDepth(sourceDepth, format),
    sampleRate: undefined,
    // FLAC: 8 comprime más pero tarda; 5 es el equilibrio habitual; 0 es rápido.
    flacCompression: spec.supports.flacCompression
      ? preset === 'maxQuality'
        ? 8
        : preset === 'balanced'
          ? 5
          : 2
      : undefined,
    preserveMetadata: true,
    preserveCoverArt: true,
  }
}

function pickBitrate(preset: Exclude<PresetId, 'custom'>, format: FormatId): number {
  const { bitrates } = getFormat(format)
  if (bitrates.length === 0) return 0
  const targets: Record<Exclude<PresetId, 'custom'>, number> = {
    maxQuality: bitrates[bitrates.length - 1],
    balanced: format === 'opus' ? 128 : 192,
    mobile: format === 'opus' ? 64 : 128,
  }
  return nearest(targets[preset], bitrates)
}

function pickBitDepth(sourceDepth: number | undefined, format: FormatId) {
  const available = getFormat(format).bitDepths
  if (available.length === 0) return undefined
  // Nunca por encima del original: subir la profundidad no añade información.
  const wanted = sourceDepth && sourceDepth >= 24 ? 24 : 16
  return available.includes(wanted as 16 | 24) ? (wanted as 16 | 24) : available[0]
}

function nearestSupported(rate: number, format: FormatId): number {
  return nearest(rate, getFormat(format).sampleRates)
}

function nearest(target: number, options: number[]): number {
  return options.reduce((best, v) => (Math.abs(v - target) < Math.abs(best - target) ? v : best), options[0])
}

/** Opciones iniciales al cargar un archivo. */
export function defaultOptions(format: FormatId, source?: TrackMetadata): ConversionOptions {
  const spec = getFormat(format)
  return {
    format,
    preset: 'balanced',
    bitrateKbps: spec.defaultBitrateKbps,
    bitDepth: spec.defaultBitDepth,
    sampleRate: undefined,
    channels: undefined,
    flacCompression: spec.supports.flacCompression ? 5 : undefined,
    preserveMetadata: true,
    preserveCoverArt: true,
    ...applyPreset('balanced', format, source),
  }
}
