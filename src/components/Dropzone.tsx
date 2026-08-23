import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { INPUT_ACCEPT } from '../core/formats/catalog'
import { MAX_FILE_BYTES } from '../core/formats/quality'
import { placeholderPeaks } from '../audio/peaks'
import Waveform from './Waveform'

export interface DropzoneProps {
  onFiles: (files: File[]) => void
  disabled?: boolean
}

const IDLE_PEAKS = placeholderPeaks('bitperfect')

export default function Dropzone({ onFiles, disabled }: DropzoneProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  // Un contador, no un booleano: `dragleave` salta también al pasar sobre los
  // hijos, y con un booleano el marco parpadearía.
  const depth = useRef(0)

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return
      onFiles(Array.from(list))
    },
    [onFiles],
  )

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault()
        depth.current += 1
        if (!disabled) setOver(true)
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        depth.current -= 1
        if (depth.current <= 0) setOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        depth.current = 0
        setOver(false)
        if (!disabled) handleFiles(e.dataTransfer.files)
      }}
      className={[
        'relative overflow-hidden rounded-lg border transition-colors duration-150',
        over ? 'border-target bg-panel-2' : 'border-line bg-panel',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-line-bright',
      ].join(' ')}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 opacity-30">
        <Waveform peaks={IDLE_PEAKS} tone={over ? 'target' : 'idle'} height={92} />
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation()
          inputRef.current?.click()
        }}
        className="relative flex w-full flex-col items-center gap-2 px-6 py-14 text-center"
      >
        <span className="font-display text-lg font-semibold tracking-tight text-ink">
          {t('dropzone.title')}
        </span>
        <span className="text-sm text-ink-dim">{t('dropzone.subtitle')}</span>
        <span className="measure mt-1 text-xs text-ink-faint">
          {t('dropzone.limit', { size: Math.round(MAX_FILE_BYTES / 1024 / 1024) })}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={INPUT_ACCEPT}
        multiple
        className="sr-only"
        onChange={(e) => {
          handleFiles(e.target.files)
          // Permite volver a elegir el mismo archivo justo después.
          e.target.value = ''
        }}
      />
    </div>
  )
}
