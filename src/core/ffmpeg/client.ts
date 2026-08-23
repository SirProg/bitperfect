import { FFmpeg } from '@ffmpeg/ffmpeg'

import { detectCoreVariant, type CoreVariant } from './capabilities'

/**
 * Todo se sirve desde nuestro propio origen: con
 * `Cross-Origin-Embedder-Policy: require-corp` el navegador bloquea el core si
 * viene de un CDN. `scripts/sync-ffmpeg-core.mjs` deja estos archivos en
 * `public/ffmpeg/` durante `postinstall`.
 */
const FFMPEG_BASE = `${import.meta.env.BASE_URL}ffmpeg`

/**
 * `@ffmpeg/ffmpeg` crea su worker con `type: "module"`, donde `importScripts`
 * no existe; por eso el core tiene que ser el build ESM.
 */
function coreUrls(variant: CoreVariant) {
  const dir = variant === 'mt' ? `${FFMPEG_BASE}/core-mt` : `${FFMPEG_BASE}/core`
  return {
    coreURL: new URL(`${dir}/ffmpeg-core.js`, globalThis.location.href).href,
    wasmURL: new URL(`${dir}/ffmpeg-core.wasm`, globalThis.location.href).href,
    // Solo el core multihilo tiene worker de pthreads.
    ...(variant === 'mt'
      ? { workerURL: new URL(`${dir}/ffmpeg-core.worker.js`, globalThis.location.href).href }
      : {}),
  }
}

export interface FFmpegSession {
  ffmpeg: FFmpeg
  variant: CoreVariant
}

let session: FFmpegSession | null = null
let pending: Promise<FFmpegSession> | null = null

/**
 * Devuelve la instancia cargada, creándola la primera vez. Las llamadas
 * concurrentes comparten la misma promesa: cargar el core cuesta decenas de MB
 * y no tiene sentido hacerlo dos veces.
 */
export function getSession(): Promise<FFmpegSession> {
  if (session) return Promise.resolve(session)
  pending ??= createSession().catch((error) => {
    // Sin esto, un fallo de red dejaría la promesa en caché y la carga nunca
    // se podría reintentar.
    pending = null
    throw error
  })
  return pending
}

async function createSession(): Promise<FFmpegSession> {
  const variant = detectCoreVariant()
  const ffmpeg = new FFmpeg()

  await ffmpeg.load({
    classWorkerURL: new URL(`${FFMPEG_BASE}/worker.js`, globalThis.location.href).href,
    ...coreUrls(variant),
  })

  session = { ffmpeg, variant }
  pending = null
  return session
}

/**
 * Destruye la instancia. Se usa para cancelar una conversión en curso —
 * ffmpeg.wasm no tiene forma de abortar un `exec()` a medias — y para
 * recuperarse de un core que quedó en mal estado.
 */
export function terminateSession(): void {
  session?.ffmpeg.terminate()
  session = null
  pending = null
}

/** La variante en uso, o `null` si aún no se ha cargado nada. */
export function currentVariant(): CoreVariant | null {
  return session?.variant ?? null
}
