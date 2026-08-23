import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import Waveform, { type WaveformTone } from './Waveform'

export interface AudioPreviewProps {
  url: string
  peaks: number[]
  tone: WaveformTone
  label: string
}

/**
 * Onda + reproducción. Se monta con `key={url}`, así que un archivo nuevo trae
 * un componente nuevo y no hay que reponer el estado a mano.
 * La cabeza de lectura recorre la misma onda que sirve de
 * previsualización, así que no hace falta una barra de progreso aparte.
 */
export default function AudioPreview({ url, peaks, tone, label }: AudioPreviewProps) {
  const { t } = useTranslation()
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) void audio.play()
    else audio.pause()
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        className="group block w-full cursor-pointer text-left"
        aria-label={playing ? t('preview.pause', { label }) : t('preview.play', { label })}
      >
        <Waveform peaks={peaks} tone={tone} progress={position} height={64} label={label} />
      </button>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          className="measure inline-flex items-center gap-1.5 rounded border border-line px-2 py-1 text-xs text-ink-dim transition-colors hover:border-line-bright hover:text-ink"
        >
          <span aria-hidden>{playing ? '❚❚' : '▶'}</span>
          {playing ? t('preview.pauseShort') : t('preview.playShort')}
        </button>
      </div>

      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setPosition(0)
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget
          if (el.duration > 0) setPosition(el.currentTime / el.duration)
        }}
      />
    </div>
  )
}
