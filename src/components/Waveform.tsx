import { useId } from 'react'

export type WaveformTone = 'source' | 'target' | 'idle'

export interface WaveformProps {
  peaks: number[]
  tone?: WaveformTone
  /** 0–1. Lo que quede a la derecha se dibuja apagado. */
  progress?: number
  /** Altura en píxeles del lienzo. */
  height?: number
  className?: string
  label?: string
}

const TONE_VARS: Record<WaveformTone, { lit: string; dim: string }> = {
  source: { lit: 'var(--color-source)', dim: 'var(--color-source-dim)' },
  target: { lit: 'var(--color-target)', dim: 'var(--color-target-dim)' },
  idle: { lit: 'var(--color-line-bright)', dim: 'var(--color-line)' },
}

/**
 * La onda se dibuja como una escalera de muestras (sample-and-hold) en vez de
 * una curva suave: los escalones son literalmente lo que distingue al audio
 * digital del analógico, que es de lo que trata toda la aplicación.
 *
 * El mismo componente hace de previsualización y de barra de progreso: con
 * `progress`, la parte ya convertida se dibuja encendida y el resto apagado.
 */
export default function Waveform({
  peaks,
  tone = 'idle',
  progress,
  height = 72,
  className,
  label,
}: WaveformProps) {
  const clipId = useId()
  const colors = TONE_VARS[tone]
  const count = peaks.length
  const width = count * 4 // 3 de barra + 1 de hueco
  const mid = height / 2

  // Un solo `path` con todos los escalones: mucho más barato que un rect por muestra.
  const steps = peaks
    .map((peak, i) => {
      const h = Math.max(1.5, peak * (height - 6))
      const x = i * 4
      return `M${x} ${mid - h / 2}h3v${h}h-3z`
    })
    .join('')

  const clipWidth = progress === undefined ? width : Math.max(0, Math.min(1, progress)) * width

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      style={{ width: '100%', height }}
      role="img"
      aria-label={label}
    >
      {progress !== undefined && (
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={clipWidth} height={height} />
          </clipPath>
        </defs>
      )}
      {/* Capa apagada: la onda completa, siempre presente como referencia. */}
      <path d={steps} fill={progress === undefined ? colors.lit : colors.dim} />
      {progress !== undefined && (
        <path d={steps} fill={colors.lit} clipPath={`url(#${clipId})`} />
      )}
    </svg>
  )
}
