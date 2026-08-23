import { useTranslation } from 'react-i18next'

import { SUPPORTED_LANGUAGES } from '../i18n'

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const current = i18n.resolvedLanguage ?? 'es'

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('language.label')}>
      {SUPPORTED_LANGUAGES.map((lang) => (
        <button
          key={lang}
          type="button"
          aria-pressed={current === lang}
          onClick={() => void i18n.changeLanguage(lang)}
          className={[
            'measure rounded px-1.5 py-0.5 text-[0.6875rem] uppercase transition-colors',
            current === lang ? 'text-ink' : 'text-ink-faint hover:text-ink-dim',
          ].join(' ')}
        >
          {lang}
        </button>
      ))}
    </div>
  )
}
