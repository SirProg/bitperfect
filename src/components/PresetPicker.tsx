import { useTranslation } from 'react-i18next'

import type { PresetId } from '../types'

const PRESETS: Exclude<PresetId, 'custom'>[] = ['maxQuality', 'balanced', 'mobile']

export interface PresetPickerProps {
  value: PresetId
  onChange: (preset: PresetId) => void
  disabled?: boolean
}

export default function PresetPicker({ value, onChange, disabled }: PresetPickerProps) {
  const { t } = useTranslation()

  return (
    <fieldset disabled={disabled}>
      <legend className="rail mb-2">{t('preset.legend')}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {PRESETS.map((preset) => {
          const selected = value === preset
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(preset)}
              className={[
                'rounded border px-3 py-2.5 text-left transition-colors',
                selected
                  ? 'border-target bg-target/10'
                  : 'border-line bg-panel hover:border-line-bright',
              ].join(' ')}
            >
              <span className={`block text-sm font-medium ${selected ? 'text-ink' : 'text-ink-dim'}`}>
                {t(`preset.${preset}.label`)}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-ink-faint">
                {t(`preset.${preset}.help`)}
              </span>
            </button>
          )
        })}
      </div>
      {value === 'custom' && (
        <p className="mt-2 text-xs text-ink-dim">{t('preset.customActive')}</p>
      )}
    </fieldset>
  )
}
