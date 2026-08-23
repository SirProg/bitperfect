import type { BitDepth, FormatId } from '../../types'

/**
 * Qué parámetros tiene sentido exponer para un formato de destino.
 * La interfaz habilita o deshabilita controles leyendo esto, y `buildArgs`
 * omite cualquier opción cuyo flag aquí sea `false`. Añadir un formato nuevo
 * debería no requerir tocar ningún componente.
 */
export interface FormatCapabilities {
  bitrate: boolean
  sampleRate: boolean
  bitDepth: boolean
  channels: boolean
  flacCompression: boolean
  /** ¿Admite carátula embebida al escribir con ffmpeg? */
  coverArt: boolean
}

export interface FormatSpec {
  id: FormatId
  /** Nombre visible. No se traduce: son nombres propios de formato. */
  label: string
  extension: string
  mimeType: string
  lossy: boolean
  /** Encoder de ffmpeg para 16 bits o para formatos con pérdida. */
  encoder: string
  supports: FormatCapabilities
  /**
   * Sample rates admitidos por el encoder, en Hz. Verificado contra el build
   * de ffmpeg.wasm con `npm run audit:encoders`. Pasar uno fuera de esta lista
   * hace fallar la conversión, así que la interfaz solo ofrece estos.
   */
  sampleRates: number[]
  /** kbps ofrecidos. Vacío en formatos sin pérdida. */
  bitrates: number[]
  bitDepths: BitDepth[]
  defaultBitrateKbps?: number
  defaultBitDepth?: BitDepth
  /**
   * Encoder PCM por profundidad de bits. Solo formatos PCM (WAV, AIFF), donde
   * la profundidad se elige cambiando de encoder en vez de con `-sample_fmt`.
   */
  pcmEncoders?: Record<BitDepth, string>
  /**
   * Argumentos que siempre se pasan a este encoder, independientemente de lo
   * que elija el usuario. Se usa para sortear defectos concretos del build de
   * ffmpeg.wasm; cada uno debe ir comentado con el motivo.
   */
  encoderArgs?: string[]
  /**
   * `-sample_fmt` por profundidad de bits, para encoders que sí lo usan
   * (FLAC, ALAC). 24 bits se consigue con el formato de 32 más
   * `-bits_per_raw_sample 24`, que `buildArgs` añade.
   */
  sampleFormats?: Record<BitDepth, string>
}

const NO_SUPPORT: FormatCapabilities = {
  bitrate: false,
  sampleRate: false,
  bitDepth: false,
  channels: false,
  flacCompression: false,
  coverArt: false,
}

/** Sample rates habituales para formatos que no imponen restricciones. */
const PCM_SAMPLE_RATES = [8000, 11025, 16000, 22050, 32000, 44100, 48000, 88200, 96000]

const LOSSY_BITRATES = [64, 96, 128, 160, 192, 256, 320]

export const FORMATS: Record<FormatId, FormatSpec> = {
  mp3: {
    id: 'mp3',
    label: 'MP3',
    extension: 'mp3',
    mimeType: 'audio/mpeg',
    lossy: true,
    encoder: 'libmp3lame',
    supports: { ...NO_SUPPORT, bitrate: true, sampleRate: true, channels: true, coverArt: true },
    // libmp3lame no pasa de 48 kHz.
    sampleRates: [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000],
    bitrates: LOSSY_BITRATES,
    bitDepths: [],
    defaultBitrateKbps: 192,
  },
  aac: {
    id: 'aac',
    label: 'AAC',
    extension: 'm4a',
    mimeType: 'audio/mp4',
    lossy: true,
    encoder: 'aac',
    supports: { ...NO_SUPPORT, bitrate: true, sampleRate: true, channels: true, coverArt: true },
    sampleRates: [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000, 64000, 88200, 96000],
    bitrates: LOSSY_BITRATES,
    bitDepths: [],
    defaultBitrateKbps: 192,
  },
  ogg: {
    id: 'ogg',
    label: 'Ogg Vorbis',
    extension: 'ogg',
    mimeType: 'audio/ogg',
    lossy: true,
    encoder: 'libvorbis',
    supports: { ...NO_SUPPORT, bitrate: true, sampleRate: true, channels: true },
    // Verificado con `npm run audit:encoders`: libvorbis en este build falla al
    // abrir el encoder por encima de 48 kHz (64 kHz y 88.2 kHz abortan).
    sampleRates: [8000, 11025, 16000, 22050, 32000, 44100, 48000],
    bitrates: LOSSY_BITRATES,
    bitDepths: [],
    defaultBitrateKbps: 192,
  },
  opus: {
    id: 'opus',
    label: 'Opus',
    extension: 'opus',
    mimeType: 'audio/ogg',
    lossy: true,
    encoder: 'libopus',
    supports: { ...NO_SUPPORT, bitrate: true, sampleRate: true, channels: true },
    // libopus solo acepta estos cinco; cualquier otro aborta la conversión.
    sampleRates: [8000, 12000, 16000, 24000, 48000],
    // Opus rinde bien a bitrates bajos; por encima de 256 kbps no aporta nada.
    bitrates: [32, 48, 64, 96, 128, 160, 192, 256],
    /**
     * Defecto de ffmpeg para libopus es complejidad 10, que a 48 kHz estéreo
     * desborda el heap de wasm: en Node el core aborta con "memory access out
     * of bounds" y en el navegador el worker se queda colgado sin resolver
     * nunca la promesa. La frontera medida es exacta: 0–4 funcionan, 5–10 no.
     * 4 es el máximo seguro y la pérdida de calidad frente a 10 es marginal.
     * Afecta a cualquier salida Opus estéreo, porque Opus siempre trabaja
     * internamente a 48 kHz aunque la entrada sea de 44.1 kHz.
     */
    encoderArgs: ['-compression_level', '4'],
    bitDepths: [],
    defaultBitrateKbps: 128,
  },
  flac: {
    id: 'flac',
    label: 'FLAC',
    extension: 'flac',
    mimeType: 'audio/flac',
    lossy: false,
    encoder: 'flac',
    supports: {
      ...NO_SUPPORT,
      sampleRate: true,
      bitDepth: true,
      channels: true,
      flacCompression: true,
      coverArt: true,
    },
    sampleRates: PCM_SAMPLE_RATES,
    bitrates: [],
    bitDepths: [16, 24],
    defaultBitDepth: 16,
    sampleFormats: { 16: 's16', 24: 's32', 32: 's32' },
  },
  wav: {
    id: 'wav',
    label: 'WAV',
    extension: 'wav',
    mimeType: 'audio/wav',
    lossy: false,
    encoder: 'pcm_s16le',
    supports: { ...NO_SUPPORT, sampleRate: true, bitDepth: true, channels: true },
    sampleRates: PCM_SAMPLE_RATES,
    bitrates: [],
    bitDepths: [16, 24, 32],
    defaultBitDepth: 16,
    pcmEncoders: { 16: 'pcm_s16le', 24: 'pcm_s24le', 32: 'pcm_s32le' },
  },
  alac: {
    id: 'alac',
    label: 'ALAC',
    extension: 'm4a',
    mimeType: 'audio/mp4',
    lossy: false,
    encoder: 'alac',
    supports: { ...NO_SUPPORT, sampleRate: true, bitDepth: true, channels: true, coverArt: true },
    sampleRates: PCM_SAMPLE_RATES,
    bitrates: [],
    bitDepths: [16, 24],
    defaultBitDepth: 16,
    sampleFormats: { 16: 's16p', 24: 's32p', 32: 's32p' },
  },
  aiff: {
    id: 'aiff',
    label: 'AIFF',
    extension: 'aiff',
    mimeType: 'audio/aiff',
    lossy: false,
    encoder: 'pcm_s16be',
    supports: { ...NO_SUPPORT, sampleRate: true, bitDepth: true, channels: true },
    sampleRates: PCM_SAMPLE_RATES,
    bitrates: [],
    bitDepths: [16, 24, 32],
    defaultBitDepth: 16,
    pcmEncoders: { 16: 'pcm_s16be', 24: 'pcm_s24be', 32: 'pcm_s32be' },
  },
}

export const FORMAT_IDS = Object.keys(FORMATS) as FormatId[]

export const OUTPUT_FORMATS: FormatSpec[] = FORMAT_IDS.map((id) => FORMATS[id])

export function getFormat(id: FormatId): FormatSpec {
  return FORMATS[id]
}

/** Extensiones aceptadas como entrada, para el `accept` del input de archivo. */
export const INPUT_EXTENSIONS = [
  'mp3',
  'm4a',
  'aac',
  'ogg',
  'oga',
  'opus',
  'flac',
  'wav',
  'aiff',
  'aif',
  'wma',
  'alac',
]

export const INPUT_ACCEPT = ['audio/*', ...INPUT_EXTENSIONS.map((e) => `.${e}`)].join(',')

/**
 * Extensiones cuyo contenido es con pérdida. Se usa para avisar en
 * conversiones con pérdida → sin pérdida cuando no se pudo leer el códec real.
 */
export const LOSSY_EXTENSIONS = new Set(['mp3', 'aac', 'm4a', 'ogg', 'oga', 'opus', 'wma'])
