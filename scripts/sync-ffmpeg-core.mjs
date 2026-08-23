#!/usr/bin/env node
/**
 * Copia los binarios de ffmpeg.wasm desde node_modules a public/ffmpeg/.
 *
 * Motivo: la app se sirve con `Cross-Origin-Embedder-Policy: require-corp`,
 * que bloquea cualquier recurso de terceros que no envíe CORP. Cargar el core
 * desde un CDN (unpkg/jsDelivr) falla bajo esa cabecera, así que servimos
 * todo desde nuestro propio origen.
 *
 * Se ejecuta en `postinstall` y `prebuild`, de modo que public/ffmpeg/ es un
 * artefacto derivado y no se versiona.
 */
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const modules = join(root, 'node_modules')
const outDir = join(root, 'public', 'ffmpeg')

/** Cada entrada: [ruta dentro de node_modules, subcarpeta destino] */
const targets = [
  // Core multihilo: rápido, requiere SharedArrayBuffer (y por tanto COOP/COEP).
  ['@ffmpeg/core-mt/dist/esm/ffmpeg-core.js', 'core-mt'],
  ['@ffmpeg/core-mt/dist/esm/ffmpeg-core.wasm', 'core-mt'],
  ['@ffmpeg/core-mt/dist/esm/ffmpeg-core.worker.js', 'core-mt'],
  // Core monohilo: fallback para navegadores sin SharedArrayBuffer.
  ['@ffmpeg/core/dist/esm/ffmpeg-core.js', 'core'],
  ['@ffmpeg/core/dist/esm/ffmpeg-core.wasm', 'core'],
  // Worker de @ffmpeg/ffmpeg (classWorkerURL). Sin autohospedarlo, la librería
  // intenta resolverlo desde el CDN y COEP lo bloquea. Se crea con
  // `type: "module"` e importa estos dos hermanos por ruta relativa, así que
  // tienen que viajar con él o el worker se queda colgado sin cargar nunca.
  ['@ffmpeg/ffmpeg/dist/esm/worker.js', '.'],
  ['@ffmpeg/ffmpeg/dist/esm/const.js', '.'],
  ['@ffmpeg/ffmpeg/dist/esm/errors.js', '.'],
]

async function main() {
  if (!existsSync(modules)) {
    console.log('[sync-ffmpeg-core] node_modules ausente; nada que copiar.')
    return
  }

  const missing = []
  for (const [rel, sub] of targets) {
    const src = join(modules, rel)
    if (!existsSync(src)) {
      missing.push(rel)
      continue
    }
    const destDir = join(outDir, sub)
    await mkdir(destDir, { recursive: true })
    await copyFile(src, join(destDir, rel.split('/').pop()))
  }

  if (missing.length > 0) {
    console.error('[sync-ffmpeg-core] No se encontraron estos archivos:')
    for (const m of missing) console.error(`  - ${m}`)
    console.error('Revisa que @ffmpeg/core, @ffmpeg/core-mt y @ffmpeg/ffmpeg estén instalados.')
    process.exitCode = 1
    return
  }

  const listing = []
  for (const sub of ['.', 'core', 'core-mt']) {
    const dir = join(outDir, sub)
    if (existsSync(dir)) {
      for (const f of await readdir(dir, { withFileTypes: true })) {
        if (f.isFile()) listing.push(`${sub === '.' ? '' : sub + '/'}${f.name}`)
      }
    }
  }
  console.log(`[sync-ffmpeg-core] public/ffmpeg listo: ${listing.sort().join(', ')}`)
}

await main()
