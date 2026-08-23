import { useTranslation } from 'react-i18next'

import { OUTPUT_FORMATS } from '../core/formats/catalog'
import type { FormatId } from '../types'

export interface FormatPickerProps {
  value: FormatId
  onChange: (format: FormatId) => void
  disabled?: boolean
}

/**
 * Los formatos se agrupan por con/sin pérdida porque esa distinción es la que
 * determina si la conversión tiene sentido, y es el eje sobre el que la app
 * avisa al usuario. Ordenarlos alfabéticamente escondería justo lo que importa.
 */
export default function FormatPicker({ value, onChange, disabled }: FormatPickerProps) {
  const { t } = useTranslation()
  const groups = [
    { lossy: false, label: t('format.lossless'), hint: t('format.losslessHint') },
    { lossy: true, label: t('format.lossy'), hint: t('format.lossyHint') },
  ]

  return (
    <fieldset disabled={disabled} className="space-y-4">
      <legend className="sr-only">{t('format.legend')}</legend>
      {groups.map((group) => (
        <div key={String(group.lossy)}>
          <div className="mb-2 flex items-baseline gap-2">
            <span className="rail">{group.label}</span>
            <span className="text-xs text-ink-faint">{group.hint}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {OUTPUT_FORMATS.filter((f) => f.lossy === group.lossy).map((format) => {
              const selected = format.id === value
              return (
                <button
                  key={format.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange(format.id)}
                  className={[
                    'rounded border px-3 py-2 text-left transition-colors',
                    selected
                      ? 'border-target bg-target/10 text-ink'
                      : 'border-line bg-panel text-ink-dim hover:border-line-bright hover:text-ink',
                  ].join(' ')}
                >
                  <span className="block text-sm font-medium">{format.label}</span>
                  <span className="measure block text-[0.6875rem] text-ink-faint">.{format.extension}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </fieldset>
  )
}
