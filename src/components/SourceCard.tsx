import { useTranslation } from 'react-i18next'

import { formatBitrate, formatBytes, formatDuration, formatSampleRate } from '../lib/format'
import type { TrackMetadata } from '../types'
import AudioPreview from './AudioPreview'

export interface SourceCardProps {
  file: File
  metadata?: TrackMetadata
  peaks: number[]
  url: string
}

/** Ficha del archivo original: qué es exactamente lo que se va a convertir. */
export default function SourceCard({ file, metadata, peaks, url }: SourceCardProps) {
  const { t } = useTranslation()

  const specs = [
    metadata?.codec,
    formatSampleRate(metadata?.sampleRate),
    metadata?.bitDepth ? `${metadata.bitDepth} bit` : undefined,
    metadata?.channels ? t(metadata.channels === 1 ? 'audio.mono' : 'audio.stereo') : undefined,
    formatBitrate(metadata?.bitrate),
  ].filter(Boolean) as string[]

  return (
    <section>
      <h2 className="rail mb-3">{t('source.title')}</h2>

      <div className="flex gap-3">
        {metadata?.coverUrl && (
          <img
            src={metadata.coverUrl}
            alt={t('source.coverAlt')}
            className="size-14 shrink-0 rounded border border-line object-cover"
          />
        )}
        <div className="min-w-0">
          <p className="truncate font-medium text-ink" title={file.name}>
            {file.name}
          </p>
          {(metadata?.title ?? metadata?.artist) && (
            <p className="truncate text-sm text-ink-dim">
              {[metadata?.artist, metadata?.title].filter(Boolean).join(' — ')}
            </p>
          )}
        </div>
      </div>

      <dl className="measure mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-dim">
        <dd>{formatBytes(file.size)}</dd>
        {formatDuration(metadata?.duration) && (
          <>
            <dd aria-hidden className="text-ink-faint">·</dd>
            <dd>{formatDuration(metadata?.duration)}</dd>
          </>
        )}
        {specs.map((spec) => (
          <span key={spec} className="contents">
            <dd aria-hidden className="text-ink-faint">·</dd>
            <dd>{spec}</dd>
          </span>
        ))}
      </dl>

      <div className="mt-4">
        <AudioPreview key={url} url={url} peaks={peaks} tone="source" label={t("source.previewLabel")} />
      </div>
    </section>
  )
}
