import { useTranslation } from 'react-i18next'

import type { SourceMode } from './SourceTabs'

export interface PrivacyNoteProps {
  mode: SourceMode
  /** Dominio del worker, para decir exactamente a dónde va la URL. */
  workerHost?: string | null
}

/**
 * Qué sale del equipo en cada modo, dicho junto al control y no escondido en
 * el pie de página. En el modo URL el destino es el worker del propio usuario,
 * así que se nombra: la diferencia entre «un servidor» y «tu servidor» es toda
 * la diferencia.
 */
export default function PrivacyNote({ mode, workerHost }: PrivacyNoteProps) {
  const { t } = useTranslation()

  const text =
    mode === 'file'
      ? t('privacy.file')
      : workerHost
        ? t('privacy.urlConfigured', { host: workerHost })
        : t('privacy.url')

  return (
    <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-faint">
      <span aria-hidden className={mode === 'file' ? 'text-target' : 'text-source'}>
        ●
      </span>
      <span>{text}</span>
    </p>
  )
}
