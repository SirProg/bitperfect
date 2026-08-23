/**
 * Decodifica el audio y reduce cada archivo a una lista corta de picos, que es
 * todo lo que hace falta para dibujar la onda.
 *
 * Se decodifica con la Web Audio API, no con ffmpeg: es instantáneo y no toca
 * el core, que queremos reservado para la conversión. A cambio depende de los
 * códecs del navegador, así que puede fallar en formatos poco habituales
 * (ALAC en Chrome, por ejemplo) — de ahí que devuelva `null` en vez de lanzar.
 */

/** Por encima de esto no se decodifica: no cabría en memoria sin castigar al equipo. */
export const MAX_DECODE_BYTES = 80 * 1024 * 1024

export const PEAK_COUNT = 96

let sharedContext: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  sharedContext ??= new AudioContext()
  return sharedContext
}

/**
 * Picos normalizados a 0–1, uno por columna de la onda. `null` si el navegador
 * no sabe decodificar este formato o el archivo es demasiado grande.
 */
export async function extractPeaks(blob: Blob, count = PEAK_COUNT): Promise<number[] | null> {
  if (blob.size > MAX_DECODE_BYTES) return null
  const context = getContext()
  if (!context) return null

  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer())
    const channel = buffer.getChannelData(0)
    const per = Math.floor(channel.length / count) || 1
    const peaks: number[] = []

    for (let i = 0; i < count; i++) {
      let peak = 0
      const start = i * per
      const end = Math.min(start + per, channel.length)
      // Muestreo espaciado: recorrer cada muestra de una pista larga bloquearía
      // el hilo principal sin cambiar el dibujo de forma perceptible.
      const step = Math.max(1, Math.floor((end - start) / 512))
      for (let j = start; j < end; j += step) {
        const value = Math.abs(channel[j])
        if (value > peak) peak = value
      }
      peaks.push(peak)
    }

    const loudest = Math.max(...peaks, 0.0001)
    return peaks.map((p) => p / loudest)
  } catch {
    return null
  }
}

/**
 * Onda de reserva cuando no se puede decodificar: una figura estable derivada
 * del nombre del archivo, para que cada pista tenga la suya y no parezca que
 * la interfaz está rota.
 */
export function placeholderPeaks(seed: string, count = PEAK_COUNT): number[] {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Array.from({ length: count }, (_, i) => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    const noise = ((h >>> 8) & 0xffff) / 0xffff
    // Envolvente suave para que no parezca ruido plano.
    const envelope = Math.sin((Math.PI * (i + 0.5)) / count) ** 0.6
    return 0.18 + 0.72 * noise * envelope
  })
}
