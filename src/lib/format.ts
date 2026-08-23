/** Formateo de cantidades medidas. Todo lo que sale de aquí va en la clase `measure`. */

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['kB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`
}

export function formatDuration(seconds: number | undefined): string | undefined {
  if (seconds === undefined || !Number.isFinite(seconds)) return undefined
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

export function formatSampleRate(hz: number | undefined): string | undefined {
  if (!hz) return undefined
  const khz = hz / 1000
  return `${Number.isInteger(khz) ? khz : khz.toFixed(1)} kHz`
}

export function formatBitrate(bps: number | undefined): string | undefined {
  if (!bps) return undefined
  return `${Math.round(bps / 1000)} kbps`
}

/** Diferencia de tamaño frente al original, ya redactada. */
export function formatSizeDelta(before: number, after: number): { ratio: number; label: string } {
  const ratio = before === 0 ? 1 : after / before
  const pct = Math.round(Math.abs(1 - ratio) * 100)
  if (pct < 1) return { ratio, label: '=' }
  return { ratio, label: `${ratio > 1 ? '+' : '−'}${pct} %` }
}
