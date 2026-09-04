import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { checkWorkerUrl } from '../core/remote/validate'
import { checkHealth } from '../core/remote/client'
import type { WorkerHealth, WorkerSettings } from '../core/remote/types'

export interface WorkerSettingsPanelProps {
  settings: WorkerSettings
  onChange: (settings: WorkerSettings) => void
  onForget: () => void
  onClose: () => void
}

type Status =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; health: WorkerHealth }
  | { kind: 'error'; message: string }

export default function WorkerSettingsPanel({
  settings,
  onChange,
  onForget,
  onClose,
}: WorkerSettingsPanelProps) {
  const { t } = useTranslation()
  const ids = { url: useId(), token: useId() }
  const [draft, setDraft] = useState(settings)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const abortRef = useRef<AbortController | null>(null)

  // El borrador arranca con los ajustes guardados y solo lo mueve el usuario:
  // `useWorkerSettings` ya los lee en el primer render, así que no hay un
  // momento en que este panel esté montado con datos por llegar.
  useEffect(() => () => abortRef.current?.abort(), [])

  const test = useCallback(async () => {
    const problem = checkWorkerUrl(draft.url)
    if (problem) {
      setStatus({ kind: 'error', message: t(`workerUrl.${problem}`) })
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus({ kind: 'checking' })

    try {
      const health = await checkHealth(draft, controller.signal)
      setStatus({ kind: 'ok', health })
      // Solo se guarda lo que se ha comprobado que responde.
      onChange(draft)
    } catch (error) {
      if (controller.signal.aborted) return
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : t('worker.unreachable'),
      })
    }
  }, [draft, onChange, t])

  const inputClass =
    'measure w-full rounded border border-line bg-panel px-2.5 py-1.5 text-sm text-ink transition-colors hover:border-line-bright'

  return (
    <div className="space-y-4 rounded-lg border border-line bg-panel p-4">
      <div>
        <label htmlFor={ids.url} className="mb-1.5 block text-sm font-medium text-ink">
          {t('worker.urlLabel')}
        </label>
        <input
          id={ids.url}
          type="url"
          inputMode="url"
          placeholder="https://mi-worker.fly.dev"
          className={inputClass}
          value={draft.url}
          onChange={(e) => setDraft({ ...draft, url: e.target.value })}
        />
        <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">{t('worker.urlHelp')}</p>
      </div>

      <div>
        <label htmlFor={ids.token} className="mb-1.5 block text-sm font-medium text-ink">
          {t('worker.tokenLabel')}
        </label>
        <input
          id={ids.token}
          type="password"
          autoComplete="off"
          className={inputClass}
          value={draft.token}
          onChange={(e) => setDraft({ ...draft, token: e.target.value })}
        />
        <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">{t('worker.tokenHelp')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void test()}
          disabled={status.kind === 'checking'}
          className="rounded border border-target bg-target/10 px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-target/20 disabled:opacity-50"
        >
          {status.kind === 'checking' ? t('worker.checking') : t('worker.check')}
        </button>
        {settings.url && (
          <button
            type="button"
            onClick={onForget}
            className="measure rounded border border-line px-2.5 py-1.5 text-xs text-ink-faint hover:border-danger hover:text-danger"
          >
            {t('worker.forget')}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="measure ml-auto rounded border border-line px-2.5 py-1.5 text-xs text-ink-faint hover:border-line-bright hover:text-ink"
        >
          {t('worker.close')}
        </button>
      </div>

      <div aria-live="polite">
        {status.kind === 'ok' && (
          <p className="measure text-xs text-target">
            {t('worker.ready', {
              version: status.health.ytdlpVersion ?? '?',
              minutes: Math.round(status.health.maxDurationSec / 60),
            })}
            {!status.health.ffmpeg && ` · ${t('worker.noFfmpeg')}`}
          </p>
        )}
        {status.kind === 'error' && <p className="text-xs text-danger">{status.message}</p>}
      </div>
    </div>
  )
}
