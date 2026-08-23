import { parseBlob, selectCover } from 'music-metadata'

import type { TrackMetadata } from '../../types'

/**
 * Lee tags, carátula y propiedades técnicas del archivo de origen.
 *
 * Se usa para dos cosas:
 * 1. Mostrar en la interfaz qué contiene el archivo antes de convertirlo.
 * 2. Obtener la duración, imprescindible para calcular el progreso real: el
 *    evento `progress` de ffmpeg.wasm no es fiable, así que el porcentaje se
 *    deriva del `time=` del log dividido entre esta duración.
 *
 * Nunca lanza: un archivo con tags corruptos debe poder convertirse igual.
 */
export async function readMetadata(file: File): Promise<TrackMetadata> {
  try {
    const parsed = await parseBlob(file, { duration: true })
    const { common, format } = parsed

    const meta: TrackMetadata = {
      title: common.title,
      artist: common.artist,
      album: common.album,
      year: common.year,
      trackNumber: common.track?.no ?? undefined,
      duration: format.duration,
      sampleRate: format.sampleRate,
      bitDepth: format.bitsPerSample,
      channels: format.numberOfChannels,
      bitrate: format.bitrate,
      codec: format.codec,
      container: format.container,
    }

    const cover = selectCover(common.picture)
    if (cover) {
      // Object URL: hay que revocarlo con `releaseMetadata` al descartar el item.
      meta.coverUrl = URL.createObjectURL(new Blob([cover.data as BlobPart], { type: cover.format }))
      meta.coverMimeType = cover.format
    }

    return meta
  } catch (error) {
    // Sin metadatos legibles la conversión sigue siendo posible; solo se pierde
    // el progreso preciso y la ficha informativa. Aun así conviene verlo en
    // desarrollo: un fallo silencioso aquí se confunde con un archivo sin tags.
    if (import.meta.env.DEV) console.warn('[bitperfect] no se pudieron leer los metadatos:', error)
    return {}
  }
}

/** Libera la object URL de la carátula. Llamar al quitar un item de la cola. */
export function releaseMetadata(meta: TrackMetadata | undefined): void {
  if (meta?.coverUrl) URL.revokeObjectURL(meta.coverUrl)
}

/** ¿El códec de origen es con pérdida? `undefined` si no se pudo determinar. */
export function isLossyCodec(meta: TrackMetadata | undefined): boolean | undefined {
  const codec = meta?.codec?.toLowerCase()
  if (!codec) return undefined
  if (/flac|alac|pcm|wav|aiff|lossless|tta|wavpack/.test(codec)) return false
  if (/mp3|mpeg|aac|vorbis|opus|wma|mp2|ac-?3/.test(codec)) return true
  return undefined
}
