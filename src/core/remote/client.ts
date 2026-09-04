import { normaliseWorkerUrl } from './validate'
import type { ProbedTrack, WorkerHealth, WorkerSettings } from './types'

/**
 * Cliente del worker de extracción.
 *
 * El worker lo levanta el propio usuario, así que su URL es configuración y no
 * una constante. Todo lo que se envía es la URL de origen; el audio se convierte
 * después aquí, en el navegador.
 */

export class WorkerError extends Error {
  // Campos explícitos: `erasableSyntaxOnly` no admite propiedades de parámetro.
  status?: number
  detail?: string

  constructor(message: string, status?: number, detail?: string) {
    super(message)
    this.name = 'WorkerError'
    this.status = status
    this.detail = detail
  }
}

export class WorkerNotConfigured extends WorkerError {
  constructor() {
    super('No hay ningún worker configurado.')
    this.name = 'WorkerNotConfigured'
  }
}

function endpoint(settings: WorkerSettings, path: string): string {
  const base = normaliseWorkerUrl(settings.url)
  if (!base) throw new WorkerNotConfigured()
  return `${base}${path}`
}

function authHeaders(settings: WorkerSettings): Record<string, string> {
  return settings.token.trim() ? { Authorization: `Bearer ${settings.token.trim()}` } : {}
}

/** Convierte una respuesta de error del worker en algo mostrable. */
async function toError(response: Response): Promise<WorkerError> {
  let message = `El worker respondió ${response.status}.`
  let detail: string | undefined
  try {
    const body = (await response.json()) as { error?: string; detail?: string }
    if (body.error) message = body.error
    // FastAPI usa `detail` para los HTTPException que lanzamos nosotros.
    else if (body.detail) message = body.detail
    detail = body.detail
  } catch {
    // Un 502 de un proxy no trae JSON; el mensaje por defecto ya sirve.
  }
  if (response.status === 401) {
    message = 'El worker rechazó el token. Revísalo en los ajustes.'
  }
  return new WorkerError(message, response.status, detail)
}

export async function checkHealth(
  settings: WorkerSettings,
  signal?: AbortSignal,
): Promise<WorkerHealth> {
  const response = await fetch(endpoint(settings, '/health'), {
    headers: authHeaders(settings),
    signal,
  })
  if (!response.ok) throw await toError(response)
  return (await response.json()) as WorkerHealth
}

export async function probe(
  settings: WorkerSettings,
  url: string,
  signal?: AbortSignal,
): Promise<ProbedTrack> {
  const response = await fetch(endpoint(settings, '/probe'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(settings) },
    body: JSON.stringify({ url }),
    signal,
  })
  if (!response.ok) throw await toError(response)
  return (await response.json()) as ProbedTrack
}

/**
 * Descarga la miniatura desde el worker.
 *
 * Tiene que ser un `fetch` y no un `<img src>` directo: `/thumb` exige el token
 * y una etiqueta `<img>` no puede enviar cabecera `Authorization`. Además, al
 * mostrarla como object URL queda en el mismo origen y COEP deja de importar.
 *
 * Nunca lanza: quedarse sin miniatura no debe estropear el resto.
 */
export async function fetchThumbnail(
  settings: WorkerSettings,
  path: string | null,
  signal?: AbortSignal,
): Promise<Blob | undefined> {
  if (!path) return undefined
  try {
    const response = await fetch(endpoint(settings, path), {
      headers: authHeaders(settings),
      signal,
    })
    if (!response.ok) return undefined
    const blob = await response.blob()
    return blob.size > 0 ? blob : undefined
  } catch {
    return undefined
  }
}

export interface DownloadResult {
  file: File
  /** Miniatura ya descargada, lista para incrustarse como carátula. */
  cover?: Blob
}

/**
 * Descarga el audio y lo envuelve en un `File`, que es todo lo que necesita el
 * resto de la aplicación: a partir de aquí el camino es idéntico al de un
 * archivo elegido a mano.
 *
 * `onProgress` recibe `undefined` mientras el worker prepara la descarga —esa
 * fase no informa de avance— y una fracción 0–1 durante la transferencia.
 */
export async function download(
  settings: WorkerSettings,
  url: string,
  {
    onProgress,
    signal,
    coverPath,
  }: {
    onProgress?: (ratio: number | undefined) => void
    signal?: AbortSignal
    coverPath?: string | null
  } = {},
): Promise<DownloadResult> {
  onProgress?.(undefined)

  const response = await fetch(endpoint(settings, '/download'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(settings) },
    body: JSON.stringify({ url }),
    signal,
  })
  if (!response.ok) throw await toError(response)

  const filename = decodeFilename(response.headers.get('X-BitPerfect-Filename')) ?? 'audio'
  const total = Number(response.headers.get('Content-Length')) || 0
  const blob = await readWithProgress(response, total, onProgress)

  if (blob.size === 0) throw new WorkerError('El worker devolvió un archivo vacío.')

  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' })
  // El worker manda `Cache-Control`, así que esta segunda petición suele
  // resolverse desde la caché del navegador si ya se mostró en la ficha.
  const cover = await fetchThumbnail(settings, coverPath ?? null, signal)

  return { file, cover }
}

async function readWithProgress(
  response: Response,
  total: number,
  onProgress?: (ratio: number | undefined) => void,
): Promise<Blob> {
  // Sin `body` legible (navegador antiguo o respuesta vacía) se cae al camino
  // simple: sin porcentaje, pero funcional.
  if (!response.body || total === 0) {
    onProgress?.(undefined)
    return await response.blob()
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      received += value.length
      onProgress?.(Math.min(1, received / total))
    }
  }

  onProgress?.(1)
  return new Blob(chunks as BlobPart[])
}

function decodeFilename(raw: string | null): string | null {
  if (!raw) return null
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}
