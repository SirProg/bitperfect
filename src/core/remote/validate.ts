/**
 * Validación en cliente de lo que el usuario escribe.
 *
 * No sustituye a la del worker —esa es la que protege de verdad— pero evita
 * un viaje de ida y vuelta para decir algo que ya sabíamos aquí.
 */

export type UrlProblem = 'empty' | 'not-a-url' | 'bad-scheme' | 'no-host'

const ALLOWED_SCHEMES = new Set(['http:', 'https:'])

export function checkSourceUrl(raw: string): UrlProblem | null {
  const value = raw.trim()
  if (!value) return 'empty'

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return 'not-a-url'
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) return 'bad-scheme'
  if (!parsed.hostname) return 'no-host'
  return null
}

export type WorkerUrlProblem = 'empty' | 'not-a-url' | 'bad-scheme'

export function checkWorkerUrl(raw: string): WorkerUrlProblem | null {
  const value = raw.trim()
  if (!value) return 'empty'
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return 'not-a-url'
  }
  if (!ALLOWED_SCHEMES.has(parsed.protocol)) return 'bad-scheme'
  return null
}

/** Quita la barra final para poder concatenar rutas sin duplicarla. */
export function normaliseWorkerUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '')
}

/**
 * Nombre de dominio legible, para decir de dónde viene sin enseñar la URL entera.
 */
export function hostOf(raw: string): string | null {
  try {
    return new URL(raw.trim()).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}
