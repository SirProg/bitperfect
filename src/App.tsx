import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { extractPeaks, placeholderPeaks } from './audio/peaks'
import AdvancedPanel from './components/AdvancedPanel'
import Dropzone from './components/Dropzone'
import EngineBadge from './components/EngineBadge'
import FormatPicker from './components/FormatPicker'
import LanguageSwitcher from './components/LanguageSwitcher'
import PresetPicker from './components/PresetPicker'
import PrivacyNote from './components/PrivacyNote'
import QueueItemCard from './components/QueueItemCard'
import SourceCard from './components/SourceCard'
import SourceTabs, { type SourceMode } from './components/SourceTabs'
import UrlInput from './components/UrlInput'
import WarningList from './components/WarningList'
import WorkerSettingsPanel from './components/WorkerSettings'
import { describeIsolation } from './core/ffmpeg/capabilities'
import { applyPreset, defaultOptions } from './core/formats/presets'
import { collectWarnings } from './core/formats/quality'
import { readMetadata, releaseMetadata } from './core/metadata/read'
import { download } from './core/remote/client'
import { useWorkerSettings } from './core/remote/settings'
import type { ProbedTrack } from './core/remote/types'
import { hostOf } from './core/remote/validate'
import { useConversionQueue } from './queue/useConversionQueue'
import type { ConversionOptions, ConversionTags, FormatId, TrackMetadata } from './types'

/** De dónde vino un audio traído por URL. */
interface RemoteOrigin {
  sourceUrl: string
  extractor: string
  /** Miniatura ya descargada, para incrustarla como carátula. */
  cover?: Blob
  /** Tags de la fuente: el audio descargado llega sin ellos. */
  tags: ConversionTags
}

/** El archivo que se está configurando, antes de mandarlo a la cola. */
interface Staged {
  file: File
  url: string
  metadata?: TrackMetadata
  peaks: number[]
  remote?: RemoteOrigin
}

export default function App() {
  const { t } = useTranslation()
  const isolation = useMemo(() => describeIsolation(), [])
  const { items, rejected, isBusy, addFiles, cancel, remove, retry, clearCompleted } = useConversionQueue()

  const [staged, setStaged] = useState<Staged | null>(null)
  const [options, setOptions] = useState<ConversionOptions>(() => defaultOptions('mp3'))
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [mode, setMode] = useState<SourceMode>('file')
  const [showWorkerSettings, setShowWorkerSettings] = useState(false)
  const [fetching, setFetching] = useState<{ ratio?: number } | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const { settings, update: updateSettings, forget: forgetSettings, configured } = useWorkerSettings()

  /**
   * Espejo de `staged` para poder liberar sus object URLs sin que la limpieza
   * dependa del valor de estado: un efecto con `[staged]` volvería a ejecutar
   * su cleanup en cada cambio y revocaría la URL del audio en cuanto llegan
   * los metadatos, dejando la previsualización muda.
   */
  const stagedRef = useRef<Staged | null>(null)

  const releaseStaged = useCallback((value: Staged | null) => {
    if (!value) return
    URL.revokeObjectURL(value.url)
    releaseMetadata(value.metadata)
  }, [])

  /** Deja el archivo listo para configurarse, venga de donde venga. */
  const stage = useCallback(
    (file: File, remote?: RemoteOrigin) => {
      // Liberar aquí y no dentro del updater de setState: en StrictMode los
      // updaters se ejecutan dos veces y revocarían URLs por duplicado.
      releaseStaged(stagedRef.current)
      const next: Staged = {
        file,
        url: URL.createObjectURL(file),
        peaks: placeholderPeaks(file.name),
        remote,
      }
      stagedRef.current = next
      setStaged(next)

      void (async () => {
        const [metadata, peaks] = await Promise.all([readMetadata(file), extractPeaks(file)])
        if (stagedRef.current?.file !== file) {
          // Entró otro archivo mientras leíamos: esta carátula ya no se usará.
          releaseMetadata(metadata)
          return
        }
        // Lo que dice la fuente manda sobre lo que traiga el archivo: un
        // `bestaudio` descargado viene sin título ni artista.
        const merged: TrackMetadata = remote
          ? {
              ...metadata,
              title: remote.tags.title ?? metadata.title,
              artist: remote.tags.artist ?? metadata.artist,
            }
          : metadata
        const updated = { ...stagedRef.current, metadata: merged, peaks: peaks ?? stagedRef.current.peaks }
        stagedRef.current = updated
        setStaged(updated)
        // Con la profundidad real del original a la vista, el preset puede
        // decidir mejor (no tiene sentido subir un 16 bits a 24).
        setOptions((prev) =>
          prev.preset === 'custom' ? prev : { ...prev, ...applyPreset(prev.preset, prev.format, merged) },
        )
      })()
    },
    [releaseStaged],
  )

  const handleFiles = useCallback(
    (files: File[]) => {
      const file = files[0]
      if (file) stage(file)
    },
    [stage],
  )

  /**
   * Trae el audio desde la URL y lo mete por el mismo camino que un archivo
   * local: a partir de aquí no hay ninguna diferencia.
   */
  const handleRemote = useCallback(
    async (sourceUrl: string, track: ProbedTrack) => {
      setFetchError(null)
      setFetching({})
      try {
        const { file, cover } = await download(settings, sourceUrl, {
          coverPath: track.thumbnailPath,
          onProgress: (ratio) => setFetching({ ratio }),
        })
        stage(file, {
          sourceUrl,
          extractor: track.extractor,
          cover,
          tags: {
            title: track.title,
            artist: track.uploader ?? undefined,
            comment: track.webpageUrl ?? sourceUrl,
          },
        })
      } catch (error) {
        setFetchError(error instanceof Error ? error.message : String(error))
      } finally {
        setFetching(null)
      }
    },
    [settings, stage],
  )

  const changeFormat = (format: FormatId) => {
    setOptions((prev) => ({
      ...defaultOptions(format, staged?.metadata),
      preset: prev.preset,
      ...applyPreset(prev.preset, format, staged?.metadata),
    }))
  }

  const patchOptions = (patch: Partial<ConversionOptions>) => setOptions((prev) => ({ ...prev, ...patch }))

  const warnings = useMemo(
    () => (staged ? collectWarnings(staged.file, staged.metadata, options) : []),
    [staged, options],
  )

  const convert = () => {
    if (!staged) return
    // Los tags de la fuente remota viajan con las opciones: el audio descargado
    // llega desnudo y sin esto el resultado saldría sin título ni artista.
    const withOrigin: ConversionOptions = staged.remote
      ? { ...options, tags: { ...staged.remote.tags, ...options.tags } }
      : options
    // La cola vuelve a leer metadatos y crea sus propias URLs, así que las de
    // la ficha de configuración dejan de hacer falta en cuanto se encola.
    addFiles([staged.file], withOrigin, staged.remote?.cover)
    releaseStaged(staged)
    stagedRef.current = null
    setStaged(null)
  }

  // Solo al desmontar: "sin rastro" significa no dejar object URLs vivas.
  useEffect(() => () => releaseStaged(stagedRef.current), [releaseStaged])

  const finished = items.filter((i) => i.status !== 'queued' && i.status !== 'converting').length

  return (
    <div className="min-h-full bg-chassis">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
          <span className="font-display text-sm font-bold tracking-[0.2em] text-ink">BITPERFECT</span>
          <div className="flex items-center gap-4">
            <EngineBadge variant={isolation.variant} threads={isolation.hardwareConcurrency} />
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-24">
        <section className="py-14 sm:py-20">
          <h1 className="font-display max-w-2xl text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-ink sm:text-6xl">
            {t('app.tagline')}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-dim">{t('app.description')}</p>
        </section>

        <SourceTabs
          value={mode}
          onChange={(next) => {
            setMode(next)
            setFetchError(null)
          }}
        />

        <div className="mt-5 space-y-4">
          {mode === 'file' ? (
            <Dropzone onFiles={handleFiles} />
          ) : (
            <>
              {showWorkerSettings && (
                <WorkerSettingsPanel
                  settings={settings}
                  // El panel no se cierra solo al conectar: si lo hiciera, el
                  // mensaje de «conectado» desaparecería en el mismo instante
                  // en que aparece y el usuario no sabría si funcionó.
                  onChange={updateSettings}
                  onForget={forgetSettings}
                  onClose={() => setShowWorkerSettings(false)}
                />
              )}

              <UrlInput
                settings={settings}
                configured={configured}
                busy={fetching !== null}
                onFetch={(url, track) => void handleRemote(url, track)}
                onOpenSettings={() => setShowWorkerSettings((v) => !v)}
              />

              {configured && !showWorkerSettings && (
                <button
                  type="button"
                  onClick={() => setShowWorkerSettings(true)}
                  className="rail hover:text-ink-dim"
                >
                  {t('worker.edit')}
                </button>
              )}

              {fetching && (
                <p className="measure text-xs text-ink-dim" aria-live="polite">
                  {fetching.ratio === undefined
                    ? t('url.preparing')
                    : t('url.transferring', { percent: Math.round(fetching.ratio * 100) })}
                </p>
              )}

              {fetchError && (
                <p className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-xs leading-relaxed text-ink-dim">
                  {fetchError}
                </p>
              )}
            </>
          )}

          <PrivacyNote
            mode={mode}
            workerHost={mode === 'url' && configured ? hostOf(settings.url) : null}
          />
        </div>

        {rejected.length > 0 && (
          <ul className="mt-3 space-y-1" aria-live="polite">
            {rejected.map((r) => (
              <li key={r.name} className="text-xs text-danger">
                {t(`reject.${r.reason}`, { name: r.name })}
              </li>
            ))}
          </ul>
        )}

        {staged && (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_auto_1.15fr]">
            <SourceCard
              file={staged.file}
              metadata={staged.metadata}
              peaks={staged.peaks}
              url={staged.url}
            />

            {/* Camino de la señal: origen (ámbar) a la izquierda, destino (azul)
                a la derecha. `items-center` colapsaba la altura del filete. */}
            <div
              aria-hidden
              className="hidden w-px self-stretch bg-gradient-to-b from-transparent via-line-bright to-transparent lg:block"
            />

            <section className="space-y-6">
              <h2 className="rail">{t('target.title')}</h2>

              <FormatPicker value={options.format} onChange={changeFormat} disabled={isBusy} />
              <PresetPicker
                value={options.preset}
                onChange={(preset) => patchOptions({ preset, ...applyPreset(preset, options.format, staged.metadata) })}
                disabled={isBusy}
              />

              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  aria-expanded={showAdvanced}
                  className="rail flex items-center gap-1.5 hover:text-ink-dim"
                >
                  <span aria-hidden>{showAdvanced ? '−' : '+'}</span>
                  {t('advanced.legend')}
                </button>
                {showAdvanced && (
                  <div className="mt-4 rounded-lg border border-line bg-panel p-4">
                    <AdvancedPanel
                      options={options}
                      sourceSampleRate={staged.metadata?.sampleRate}
                      onChange={patchOptions}
                      disabled={isBusy}
                    />
                  </div>
                )}
              </div>

              <WarningList warnings={warnings} />

              <button
                type="button"
                onClick={convert}
                className="w-full rounded border border-target bg-target/15 px-4 py-3 font-display text-sm font-semibold tracking-wide text-ink transition-colors hover:bg-target/25"
              >
                {t('actions.convert')}
              </button>
            </section>
          </div>
        )}

        {items.length > 0 && (
          <section className="mt-14">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="rail">{t('queue.title')}</h2>
              {finished > 0 && (
                <button
                  type="button"
                  onClick={clearCompleted}
                  className="measure text-[0.6875rem] text-ink-faint hover:text-ink-dim"
                >
                  {t('queue.clear')}
                </button>
              )}
            </div>
            <ul className="space-y-3">
              {items.map((item) => (
                <QueueItemCard
                  key={item.id}
                  item={item}
                  onCancel={cancel}
                  onRemove={remove}
                  onRetry={retry}
                />
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-xs text-ink-faint">
          <span>{t('footer.privacy')}</span>
          <a
            href="https://github.com/SirProg/bitperfect"
            className="measure hover:text-ink-dim"
            target="_blank"
            rel="noreferrer"
          >
            {t('footer.source')}
          </a>
        </div>
      </footer>
    </div>
  )
}
