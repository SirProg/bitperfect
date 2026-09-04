import { useTranslation } from 'react-i18next'

export type SourceMode = 'file' | 'url'

export interface SourceTabsProps {
  value: SourceMode
  onChange: (mode: SourceMode) => void
}

/**
 * Las dos formas de traer audio, siempre visibles y siempre etiquetadas.
 *
 * No es solo navegación: es donde el usuario ve que un modo no sale de su
 * equipo y el otro pasa por un servidor. Esconder esa diferencia sería
 * justamente lo que este proyecto no hace.
 */
export default function SourceTabs({ value, onChange }: SourceTabsProps) {
  const { t } = useTranslation()
  const modes: SourceMode[] = ['file', 'url']

  return (
    <div role="tablist" aria-label={t('tabs.legend')} className="flex w-full gap-1 border-b border-line">
      {modes.map((mode) => {
        const selected = value === mode
        return (
          <button
            key={mode}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(mode)}
            className={[
              'relative -mb-px px-4 py-2.5 text-sm font-medium transition-colors',
              selected
                ? 'border-b-2 border-target text-ink'
                : 'border-b-2 border-transparent text-ink-faint hover:text-ink-dim',
            ].join(' ')}
          >
            {t(`tabs.${mode}.label`)}
            <span className="ml-2 hidden text-xs font-normal text-ink-faint sm:inline">
              {t(`tabs.${mode}.hint`)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
