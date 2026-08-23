import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { extractPeaks, placeholderPeaks } from '../audio/peaks'
import { getFormat } from '../core/formats/catalog'
import { formatBytes, formatDuration, formatSizeDelta } from '../lib/format'
import type { QueueItem } from '../types'
import AudioPreview from './AudioPreview'
import Waveform from './Waveform'

export interface QueueItemCardProps {
  item: QueueItem
  onCancel: (id: string) => void
  onRemove: (id: string) => void
  onRetry: (id: string) => void
}

export default function QueueItemCard({ item, onCancel, onRemove, onRetry }: QueueItemCardProps) {
  const { t } = useTranslation()
  const [resultPeaks, setResultPeaks] = useState<number[] | null>(null)
  const spec = getFormat(item.options.format)

  // La onda del resultado se calcula al terminar: es la prueba visible de que
  // la conversión produjo audio real y no un archivo vacío.
  useEffect(() => {
    if (item.status !== 'done' || !item.result) return
    let cancelled = false
    void extractPeaks(item.result.blob).then((peaks) => {
      if (!cancelled) setResultPeaks(peaks ?? placeholderPeaks(item.result!.filename))
    })
    return () => {
      cancelled = true
    }
  }, [item.status, item.result])

  const busy = item.status === 'converting' || item.status === 'reading-metadata'
  const delta = item.result ? formatSizeDelta(item.file.size, item.result.size) : null

  return (
    <li className="rounded-lg border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink" title={item.file.name}>
            {item.file.name}
          </p>
          <p className="measure mt-0.5 text-xs text-ink-faint">
            {formatBytes(item.file.size)}
            <span aria-hidden> → </span>
            {spec.label}
            {item.result && ` · ${formatBytes(item.result.size)}`}
            {delta && delta.label !== '=' && (
              <span className={delta.ratio > 1 ? 'text-warn' : 'text-target'}> ({delta.label})</span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {busy && (
            <button
              type="button"
              onClick={() => onCancel(item.id)}
              className="measure rounded border border-line px-2 py-1 text-[0.6875rem] text-ink-dim hover:border-danger hover:text-danger"
            >
              {t('queue.cancel')}
            </button>
          )}
          {(item.status === 'error' || item.status === 'cancelled') && (
            <button
              type="button"
              onClick={() => onRetry(item.id)}
              className="measure rounded border border-line px-2 py-1 text-[0.6875rem] text-ink-dim hover:border-line-bright hover:text-ink"
            >
              {t('queue.retry')}
            </button>
          )}
          {!busy && (
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label={t('queue.remove')}
              className="rounded border border-line px-2 py-1 text-[0.6875rem] text-ink-faint hover:border-line-bright hover:text-ink"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {busy && (
        <div className="mt-3">
          <Waveform
            peaks={placeholderPeaks(item.file.name)}
            tone="target"
            progress={item.progress}
            height={40}
          />
          <p className="measure mt-1.5 text-xs text-ink-dim" aria-live="polite">
            {item.status === 'reading-metadata'
              ? t('queue.reading')
              : t('queue.converting', { percent: Math.round(item.progress * 100) })}
          </p>
        </div>
      )}

      {item.status === 'queued' && (
        <p className="measure mt-3 text-xs text-ink-faint">{t('queue.waiting')}</p>
      )}

      {item.status === 'error' && (
        <p className="mt-3 rounded border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-ink-dim">
          <strong className="text-ink">{t('queue.failed')}</strong> {item.error}
        </p>
      )}

      {item.status === 'cancelled' && (
        <p className="measure mt-3 text-xs text-ink-faint">{t('queue.cancelled')}</p>
      )}

      {item.status === 'done' && item.result && (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="rail">{t('queue.result')}</span>
            {item.elapsedMs && (
              <span className="measure text-[0.6875rem] text-ink-faint">
                {t('queue.elapsed', { seconds: (item.elapsedMs / 1000).toFixed(1) })}
              </span>
            )}
          </div>

          <AudioPreview
            key={item.result.url}
            url={item.result.url}
            peaks={resultPeaks ?? placeholderPeaks(item.result.filename)}
            tone="target"
            label={t('queue.resultPreviewLabel')}
          />

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={item.result.url}
              download={item.result.filename}
              className="rounded border border-target bg-target/10 px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-target/20"
            >
              {t('queue.download')}
            </a>
            <span className="measure text-xs text-ink-faint">
              {item.result.filename}
              {formatDuration(item.sourceMetadata?.duration) && ` · ${formatDuration(item.sourceMetadata?.duration)}`}
            </span>
          </div>
        </div>
      )}
    </li>
  )
}
