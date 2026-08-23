import { useTranslation } from 'react-i18next'

import type { WarningId } from '../core/formats/quality'

export interface WarningListProps {
  warnings: WarningId[]
}

/**
 * Los avisos informan, no bloquean: convertir MP3 a FLAC es a veces justo lo
 * que se necesita (compatibilidad, edición posterior). Lo que la app no hace es
 * dejar que ocurra en silencio.
 */
export default function WarningList({ warnings }: WarningListProps) {
  const { t } = useTranslation()
  if (warnings.length === 0) return null

  return (
    <ul className="space-y-2" aria-live="polite">
      {warnings.map((id) => (
        <li
          key={id}
          className="flex gap-2.5 rounded border border-warn/30 bg-warn/5 px-3 py-2.5 text-xs leading-relaxed"
        >
          <span aria-hidden className="text-warn">
            !
          </span>
          <span>
            <strong className="block font-medium text-ink">{t(`warning.${id}.title`)}</strong>
            <span className="text-ink-dim">{t(`warning.${id}.body`)}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
