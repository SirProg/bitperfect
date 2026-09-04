import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { fetchThumbnail, probe, WorkerNotConfigured } from '../core/remote/client'
import type { ProbedTrack, WorkerSettings } from '../core/remote/types'
import { checkSourceUrl } from '../core/remote/validate'
import { formatBytes, formatDuration } from '../lib/format'

export interface UrlInputProps {
  settings: WorkerSettings
  configured: boolean
  busy: boolean
  onFetch: (url: string, track: ProbedTrack) => void
  onOpenSettings: () => void
}

type State =
  | { kind: 'idle' }
  | { kind: 'probing' }
  | { kind: 'found'; track: ProbedTrack; url: string }
  | { kind: 'error'; message: string }

export default function UrlInput({
  settings,
  configured,
  busy,
  onFetch,
  onOpenSettings,
}: UrlInputProps) {
  const { t } = useTranslation()
  const [url, setUrl] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [thumb, setThumb] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const thumbRef = useRef<string | null>(null)

  /** Suelta la miniatura anterior antes de poner otra, y al desmontar. */
  const setThumbnail = useCallback((next: string | null) => {
    if (thumbRef.current) URL.revokeObjectURL(thumbRef.current)
    thumbRef.current = next
    setThumb(next)
  }, [])

  useEffect(() => () => {
    if (thumbRef.current) URL.revokeObjectURL(thumbRef.current)
  }, [])

  const runProbe = useCallback(async () => {
    const problem = checkSourceUrl(url)
    if (problem) {
      setState({ kind: 'error', message: t(`sourceUrl.${problem}`) })
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setState({ kind: 'probing' })
    setThumbnail(null)

    try {
      const track = await probe(settings, url.trim(), controller.signal)
      setState({ kind: 'found', track, url: url.trim() })

      const cover = await fetchThumbnail(settings, track.thumbnailPath, controller.signal)
      if (cover && !controller.signal.aborted) setThumbnail(URL.createObjectURL(cover))
    } catch (error) {
      if (controller.signal.aborted) return
      setState({
        kind: 'error',
        message:
          error instanceof WorkerNotConfigured
            ? t('worker.notConfiguredShort')
            : error instanceof Error
              ? error.message
              : t('worker.unreachable'),
      })
    }
  }, [setThumbnail, settings, t, url])

  if (!configured) {
    return (
      <div className="rounded-lg border border-line bg-panel p-6">
        <h3 className="font-display text-base font-semibold text-ink">{t('urlEmpty.title')}</h3>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-dim">
          {t('urlEmpty.why')}
        </p>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-dim">
          {t('urlEmpty.yours')}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded border border-target bg-target/10 px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-target/20"
          >
            {t('urlEmpty.configure')}
          </button>
          <a
            href="https://github.com/SirProg/bitperfect/tree/main/worker#readme"
            target="_blank"
            rel="noreferrer"
            className="measure rounded border border-line px-2.5 py-1.5 text-xs text-ink-dim transition-colors hover:border-line-bright hover:text-ink"
          >
            {t('urlEmpty.docs')}
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          inputMode="url"
          value={url}
          disabled={busy}
          placeholder={t('url.placeholder')}
          aria-label={t('url.label')}
          onChange={(e) => {
            setUrl(e.target.value)
            if (state.kind !== 'idle') {
              setState({ kind: 'idle' })
              setThumbnail(null)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void runProbe()
          }}
          className="measure w-full rounded border border-line bg-panel px-3 py-2 text-sm text-ink transition-colors hover:border-line-bright disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void runProbe()}
          disabled={busy || state.kind === 'probing'}
          className="shrink-0 rounded border border-line bg-panel px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-line-bright disabled:opacity-50"
        >
          {state.kind === 'probing' ? t('url.checking') : t('url.check')}
        </button>
      </div>

      <div aria-live="polite">
        {state.kind === 'error' && (
          <p className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-xs leading-relaxed text-ink-dim">
            {state.message}
          </p>
        )}

        {state.kind === 'found' && (
          <div className="rounded-lg border border-line bg-panel p-4">
            <div className="flex gap-3">
              {thumb && (
                <img
                  src={thumb}
                  alt=""
                  className="h-16 w-28 shrink-0 rounded border border-line object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink" title={state.track.title}>
                  {state.track.title}
                </p>
                {state.track.uploader && (
                  <p className="truncate text-sm text-ink-dim">{state.track.uploader}</p>
                )}
                <p className="measure mt-1 flex flex-wrap gap-x-2 text-xs text-ink-faint">
                  <span>{state.track.extractor}</span>
                  {formatDuration(state.track.durationSec ?? undefined) && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{formatDuration(state.track.durationSec ?? undefined)}</span>
                    </>
                  )}
                  {state.track.ext && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{state.track.ext}</span>
                    </>
                  )}
                  {state.track.filesizeApprox && (
                    <>
                      <span aria-hidden>·</span>
                      <span>≈ {formatBytes(state.track.filesizeApprox)}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => onFetch(state.url, state.track)}
              className="mt-4 w-full rounded border border-target bg-target/15 px-4 py-2.5 font-display text-sm font-semibold tracking-wide text-ink transition-colors hover:bg-target/25 disabled:opacity-50"
            >
              {t('url.fetch')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
