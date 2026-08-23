#!/usr/bin/env node
/**
 * Ejecuta el core monohilo de ffmpeg.wasm bajo Node y vuelca lo que el propio
 * binario declara: encoders disponibles y, con `--encoder=<nombre>`, los sample
 * formats / sample rates / layouts que admite.
 *
 * Sirve para verificar que el catálogo de `src/core/formats/catalog.ts` refleja
 * lo que el build de ffmpeg.wasm realmente trae, en vez de asumirlo. Es
 * especialmente útil al subir la versión de @ffmpeg/core.
 *
 *   node scripts/audit-encoders.mjs
 *   node scripts/audit-encoders.mjs --encoder=flac
 *   node scripts/audit-encoders.mjs -- -hide_banner -formats
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'node_modules', '@ffmpeg', 'core', 'dist', 'umd')

// El build UMD asume un navegador; estos shims le bastan para arrancar en Node.
globalThis.self = globalThis
globalThis.window = globalThis
globalThis.location = { href: `file://${dist}/ffmpeg-core.js` }
globalThis.document = { currentScript: { src: `file://${dist}/ffmpeg-core.js` } }

const argv = process.argv.slice(2)
const encoderFlag = argv.find((a) => a.startsWith('--encoder='))
const passthrough = argv.includes('--') ? argv.slice(argv.indexOf('--') + 1) : null

const args = passthrough
  ? passthrough
  : encoderFlag
    ? ['-hide_banner', '-h', `encoder=${encoderFlag.split('=')[1]}`]
    : ['-hide_banner', '-encoders']

const createFFmpegCore = createRequire(import.meta.url)(join(dist, 'ffmpeg-core.js'))

const lines = []
const core = await createFFmpegCore({
  // Node no puede hacer fetch de un file://, así que le damos el wasm ya leído.
  wasmBinary: readFileSync(join(dist, 'ffmpeg-core.wasm')),
})
core.setLogger(({ message }) => lines.push(message))
core.exec(...args)
console.log(lines.join('\n'))
process.exit(0)
