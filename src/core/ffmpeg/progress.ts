/**
 * `00:01:23.45` → 83.45 segundos.
 *
 * ffmpeg escribe el avance en sus líneas de log como `time=HH:MM:SS.ss`.
 * Dividirlo entre la duración del original da un progreso mucho más fiable que
 * el evento `progress` de ffmpeg.wasm, que avanza a saltos y a veces se queda
 * en cero durante toda la conversión.
 */
export function parseTimeFromLog(message: string): number | undefined {
  const match = /time=\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(message)
  if (!match) return undefined
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
}
