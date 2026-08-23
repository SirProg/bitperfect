import type { ReactNode } from 'react'

export interface FieldProps {
  label: string
  /** El README exige que cada control explique qué hace: aquí no es opcional. */
  help: string
  htmlFor?: string
  disabled?: boolean
  disabledReason?: string
  children: ReactNode
}

/**
 * Envoltorio de todo control de conversión. Existe para que sea imposible
 * añadir un parámetro sin su explicación: el texto de ayuda es obligatorio.
 */
export default function Field({ label, help, htmlFor, disabled, disabledReason, children }: FieldProps) {
  return (
    <div className={disabled ? 'opacity-40' : undefined}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">
        {disabled && disabledReason ? disabledReason : help}
      </p>
    </div>
  )
}
