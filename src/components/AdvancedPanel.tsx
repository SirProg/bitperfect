import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { getFormat } from '../core/formats/catalog'
import { formatSampleRate } from '../lib/format'
import type { BitDepth, Channels, ConversionOptions } from '../types'
import Field from './Field'

export interface AdvancedPanelProps {
  options: ConversionOptions
  sourceSampleRate?: number
  onChange: (patch: Partial<ConversionOptions>) => void
  disabled?: boolean
}

const selectClass =
  'measure w-full rounded border border-line bg-panel px-2.5 py-1.5 text-sm text-ink transition-colors hover:border-line-bright disabled:cursor-not-allowed'

/**
 * Control fino. Cada campo se habilita a partir del catálogo del formato de
 * destino, de modo que no hay forma de fijar un parámetro que ffmpeg vaya a
 * ignorar o que haga fallar la conversión.
 */
export default function AdvancedPanel({ options, sourceSampleRate, onChange, disabled }: AdvancedPanelProps) {
  const { t } = useTranslation()
  const spec = getFormat(options.format)
  const ids = {
    bitrate: useId(),
    sampleRate: useId(),
    bitDepth: useId(),
    channels: useId(),
    flac: useId(),
  }

  // Marcar cualquier valor a mano significa que ya no estamos en un preset.
  const set = (patch: Partial<ConversionOptions>) => onChange({ ...patch, preset: 'custom' })

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field
        label={t('advanced.bitrate.label')}
        help={t('advanced.bitrate.help')}
        htmlFor={ids.bitrate}
        disabled={disabled || !spec.supports.bitrate}
        disabledReason={t('advanced.bitrate.notApplicable', { format: spec.label })}
      >
        <select
          id={ids.bitrate}
          className={selectClass}
          disabled={disabled || !spec.supports.bitrate}
          value={options.bitrateKbps ?? ''}
          onChange={(e) => set({ bitrateKbps: Number(e.target.value) })}
        >
          {spec.bitrates.map((kbps) => (
            <option key={kbps} value={kbps}>
              {kbps} kbps
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={t('advanced.sampleRate.label')}
        help={t('advanced.sampleRate.help')}
        htmlFor={ids.sampleRate}
        disabled={disabled || !spec.supports.sampleRate}
      >
        <select
          id={ids.sampleRate}
          className={selectClass}
          disabled={disabled || !spec.supports.sampleRate}
          value={options.sampleRate ?? ''}
          onChange={(e) => set({ sampleRate: e.target.value === '' ? undefined : Number(e.target.value) })}
        >
          <option value="">{t('advanced.sampleRate.keep')}</option>
          {spec.sampleRates.map((hz) => (
            <option key={hz} value={hz}>
              {formatSampleRate(hz)}
              {hz === sourceSampleRate ? ` — ${t('advanced.sampleRate.sameAsSource')}` : ''}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={t('advanced.bitDepth.label')}
        help={t('advanced.bitDepth.help')}
        htmlFor={ids.bitDepth}
        disabled={disabled || !spec.supports.bitDepth}
        disabledReason={t('advanced.bitDepth.notApplicable', { format: spec.label })}
      >
        <select
          id={ids.bitDepth}
          className={selectClass}
          disabled={disabled || !spec.supports.bitDepth}
          value={options.bitDepth ?? ''}
          onChange={(e) => set({ bitDepth: Number(e.target.value) as BitDepth })}
        >
          {spec.bitDepths.map((depth) => (
            <option key={depth} value={depth}>
              {depth} bit
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={t('advanced.channels.label')}
        help={t('advanced.channels.help')}
        htmlFor={ids.channels}
        disabled={disabled || !spec.supports.channels}
      >
        <select
          id={ids.channels}
          className={selectClass}
          disabled={disabled || !spec.supports.channels}
          value={options.channels ?? ''}
          onChange={(e) => set({ channels: e.target.value === '' ? undefined : (Number(e.target.value) as Channels) })}
        >
          <option value="">{t('advanced.channels.keep')}</option>
          <option value={2}>{t('audio.stereo')}</option>
          <option value={1}>{t('audio.mono')}</option>
        </select>
      </Field>

      {spec.supports.flacCompression && (
        <Field
          label={t('advanced.flac.label')}
          help={t('advanced.flac.help')}
          htmlFor={ids.flac}
          disabled={disabled}
        >
          <div className="flex items-center gap-3">
            <input
              id={ids.flac}
              type="range"
              min={0}
              max={8}
              step={1}
              disabled={disabled}
              value={options.flacCompression ?? 5}
              onChange={(e) => set({ flacCompression: Number(e.target.value) })}
              className="h-1 w-full cursor-pointer appearance-none rounded bg-line accent-target"
            />
            <span className="measure w-4 text-right text-sm text-ink">{options.flacCompression ?? 5}</span>
          </div>
        </Field>
      )}

      <div className="sm:col-span-2 space-y-3 border-t border-line pt-4">
        <Toggle
          checked={options.preserveMetadata}
          onChange={(preserveMetadata) => set({ preserveMetadata })}
          disabled={disabled}
          label={t('advanced.metadata.label')}
          help={t('advanced.metadata.help')}
        />
        <Toggle
          checked={options.preserveCoverArt}
          onChange={(preserveCoverArt) => set({ preserveCoverArt })}
          disabled={disabled || !spec.supports.coverArt}
          label={t('advanced.cover.label')}
          help={
            spec.supports.coverArt
              ? t('advanced.cover.help')
              : t('advanced.cover.notSupported', { format: spec.label })
          }
        />
      </div>
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  disabled,
  label,
  help,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  label: string
  help: string
}) {
  const id = useId()
  return (
    <div className={disabled ? 'opacity-40' : undefined}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5">
        <input
          id={id}
          type="checkbox"
          checked={checked && !disabled}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-target"
        />
        <span>
          <span className="block text-sm font-medium text-ink">{label}</span>
          <span className="block text-xs leading-relaxed text-ink-dim">{help}</span>
        </span>
      </label>
    </div>
  )
}
