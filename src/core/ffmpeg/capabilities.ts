/** Qué build del core de ffmpeg.wasm puede usar este navegador. */
export type CoreVariant = 'mt' | 'st'

/**
 * El core multihilo necesita `SharedArrayBuffer`, que solo existe en contextos
 * con cross-origin isolation. En producción las cabeceras COOP/COEP las pone
 * `vercel.json` y en desarrollo `vite.config.ts`, pero el navegador puede
 * seguir sin ofrecerlo (iframe sin permisos, navegador antiguo, extensión que
 * interfiere), así que se comprueba en runtime en vez de asumirlo.
 */
export function detectCoreVariant(): CoreVariant {
  const isolated = typeof globalThis.crossOriginIsolated === 'boolean' ? globalThis.crossOriginIsolated : false
  const hasSAB = typeof SharedArrayBuffer !== 'undefined'
  return isolated && hasSAB ? 'mt' : 'st'
}

export function describeIsolation() {
  return {
    crossOriginIsolated: globalThis.crossOriginIsolated ?? false,
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    hardwareConcurrency: globalThis.navigator?.hardwareConcurrency ?? 1,
    variant: detectCoreVariant(),
  }
}
