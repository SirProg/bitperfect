import { useTranslation } from 'react-i18next'

import type { CoreVariant } from '../core/ffmpeg/capabilities'

export interface EngineBadgeProps {
  variant: CoreVariant
  threads: number
}

/**
 * En modo monohilo la conversión es notablemente más lenta. Decirlo evita que
 * el usuario piense que la aplicación se ha colgado.
 */
export default function EngineBadge({ variant, threads }: EngineBadgeProps) {
  const { t } = useTranslation()
  const mt = variant === 'mt'

  return (
    <span
      className="measure inline-flex items-center gap-1.5 text-[0.6875rem] text-ink-faint"
      title={mt ? t('engine.multiThread.help', { threads }) : t('engine.singleThread.help')}
    >
      <span aria-hidden className={mt ? 'text-target' : 'text-warn'}>
        ●
      </span>
      {mt ? t('engine.multiThread.label', { threads }) : t('engine.singleThread.label')}
    </span>
  )
}
