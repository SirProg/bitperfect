import type { ConversionOptions, ConversionResult, TrackMetadata } from '../../types'
import { getFormat } from '../formats/catalog'
import { buildArgs, downloadFilename, virtualInputName, virtualOutputName } from './buildArgs'
import { getSession, terminateSession } from './client'
import { parseTimeFromLog } from './progress'

export class ConversionCancelled extends Error {
  constructor() {
    super('cancelled')
    this.name = 'ConversionCancelled'
  }
}

export interface ConvertParams {
  file: File
  options: ConversionOptions
  metadata?: TrackMetadata
  onProgress?: (ratio: number) => void
  signal?: AbortSignal
}

/**
 * Margen sobre la duración del audio antes de dar una conversión por colgada.
 * Un core que revienta deja la promesa de `exec()` sin resolver jamás — se
 * observó al convertir a Opus con la complejidad por defecto — así que sin un
 * plazo máximo la interfaz se quedaría esperando para siempre.
 */
const WATCHDOG_BASE_MS = 60_000
const WATCHDOG_PER_SECOND_MS = 2_000

export async function convert({
  file,
  options,
  metadata,
  onProgress,
  signal,
}: ConvertParams): Promise<ConversionResult> {
  if (signal?.aborted) throw new ConversionCancelled()

  const spec = getFormat(options.format)
  const inputName = virtualInputName(file.name)
  const outputName = virtualOutputName(options)
  const duration = metadata?.duration

  const { ffmpeg } = await getSession()

  // El evento `progress` de ffmpeg.wasm es errático; el `time=` del log es
  // fiable siempre que conozcamos la duración del original.
  const onLog = ({ message }: { message: string }) => {
    if (!duration || duration <= 0 || !onProgress) return
    const seconds = parseTimeFromLog(message)
    if (seconds !== undefined) onProgress(Math.min(1, seconds / duration))
  }
  const onNativeProgress = ({ progress }: { progress: number }) => {
    // Respaldo para archivos sin duración legible.
    if (duration || !onProgress) return
    if (Number.isFinite(progress)) onProgress(Math.min(1, Math.max(0, progress)))
  }

  ffmpeg.on('log', onLog)
  ffmpeg.on('progress', onNativeProgress)

  const abort = () => terminateSession()
  signal?.addEventListener('abort', abort, { once: true })

  try {
    await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()))

    const timeoutMs = WATCHDOG_BASE_MS + (duration ?? 60) * WATCHDOG_PER_SECOND_MS
    const code = await withWatchdog(ffmpeg.exec(buildArgs(file.name, options)), timeoutMs)

    if (signal?.aborted) throw new ConversionCancelled()
    if (code !== 0) throw new Error(`ffmpeg terminó con código ${code}`)

    const data = (await ffmpeg.readFile(outputName)) as Uint8Array
    if (data.length === 0) throw new Error('ffmpeg no produjo ningún dato')

    // Copia al Blob para poder soltar el buffer del FS virtual acto seguido.
    const blob = new Blob([data.slice().buffer as ArrayBuffer], { type: spec.mimeType })
    onProgress?.(1)

    return {
      blob,
      url: URL.createObjectURL(blob),
      filename: downloadFilename(file.name, options),
      size: blob.size,
    }
  } catch (error) {
    if (signal?.aborted) throw new ConversionCancelled()
    throw error
  } finally {
    signal?.removeEventListener('abort', abort)
    ffmpeg.off('log', onLog)
    ffmpeg.off('progress', onNativeProgress)
    // El core acumula memoria entre ejecuciones: tras varias conversiones
    // seguidas empieza a abortar con "memory access out of bounds". Se recicla
    // al terminar cada una para que la siguiente arranque con un heap limpio.
    // Terminar aquí (y no antes de la siguiente) evita además dejar el FS
    // virtual con el archivo de entrada ocupando memoria.
    terminateSession()
  }
}

async function withWatchdog<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('La conversión no respondió y se ha cancelado.')),
          ms,
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
