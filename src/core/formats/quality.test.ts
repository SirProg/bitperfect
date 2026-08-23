import { describe, expect, it } from 'vitest'

import type { ConversionOptions, TrackMetadata } from '../../types'
import {
  collectWarnings,
  isLossyToLossy,
  isPointlessUpconversion,
  isUpsampling,
  MAX_FILE_BYTES,
  sourceIsLossy,
  validateFile,
} from './quality'

const file = (name: string, size = 1024, type = '') =>
  new File([new Uint8Array(Math.min(size, 8))], name, { type })

const opts = (o: Partial<ConversionOptions> & { format: ConversionOptions['format'] }): ConversionOptions => ({
  preset: 'custom',
  preserveMetadata: true,
  preserveCoverArt: true,
  ...o,
})

describe('validateFile', () => {
  it('acepta un audio normal', () => {
    expect(validateFile(file('a.flac', 1024, 'audio/flac'))).toBeNull()
  })

  it('rechaza los vacíos', () => {
    expect(validateFile(new File([], 'a.flac'))).toBe('empty')
  })

  it('rechaza por encima del tope anunciado de 500 MB', () => {
    const big = file('a.flac')
    Object.defineProperty(big, 'size', { value: MAX_FILE_BYTES + 1 })
    expect(validateFile(big)).toBe('too-large')
  })

  it('acepta justo en el límite', () => {
    const edge = file('a.flac')
    Object.defineProperty(edge, 'size', { value: MAX_FILE_BYTES })
    expect(validateFile(edge)).toBeNull()
  })

  it('rechaza lo que no parece audio', () => {
    expect(validateFile(file('documento', 100, 'application/pdf'))).toBe('not-audio')
  })
})

describe('sourceIsLossy', () => {
  it('usa el códec real cuando se pudo leer', () => {
    // La extensión diría "sin pérdida", pero el códec manda.
    expect(sourceIsLossy(file('raro.flac'), { codec: 'MPEG 1 Layer 3' })).toBe(true)
    expect(sourceIsLossy(file('raro.mp3'), { codec: 'FLAC' })).toBe(false)
  })

  it('cae a la extensión cuando no hay metadatos', () => {
    expect(sourceIsLossy(file('a.mp3'), undefined)).toBe(true)
    expect(sourceIsLossy(file('a.flac'), undefined)).toBe(false)
    expect(sourceIsLossy(file('a.opus'), undefined)).toBe(true)
  })
})

describe('avisos de calidad', () => {
  const mp3: TrackMetadata = { codec: 'MPEG 1 Layer 3', sampleRate: 44100 }
  const flac: TrackMetadata = { codec: 'FLAC', sampleRate: 44100, bitDepth: 16 }

  it('avisa al pasar de con pérdida a sin pérdida: no se recupera nada', () => {
    expect(isPointlessUpconversion(file('a.mp3'), mp3, opts({ format: 'flac' }))).toBe(true)
    expect(isPointlessUpconversion(file('a.mp3'), mp3, opts({ format: 'wav' }))).toBe(true)
  })

  it('no avisa de sin pérdida a sin pérdida', () => {
    expect(isPointlessUpconversion(file('a.flac'), flac, opts({ format: 'wav' }))).toBe(false)
  })

  it('avisa al recomprimir entre formatos con pérdida', () => {
    expect(isLossyToLossy(file('a.mp3'), mp3, opts({ format: 'opus' }))).toBe(true)
    expect(isLossyToLossy(file('a.flac'), flac, opts({ format: 'mp3' }))).toBe(false)
  })

  it('avisa al subir el sample rate por encima del original', () => {
    expect(isUpsampling(flac, opts({ format: 'wav', sampleRate: 96000 }))).toBe(true)
    expect(isUpsampling(flac, opts({ format: 'wav', sampleRate: 44100 }))).toBe(false)
    expect(isUpsampling(flac, opts({ format: 'wav' }))).toBe(false)
  })

  it('avisa si el destino no admite carátula y el origen la tiene', () => {
    const conCaratula: TrackMetadata = { ...flac, coverUrl: 'blob:x' }
    expect(collectWarnings(file('a.flac'), conCaratula, opts({ format: 'opus' }))).toContain('noCoverSupport')
    expect(collectWarnings(file('a.flac'), conCaratula, opts({ format: 'mp3' }))).not.toContain('noCoverSupport')
  })

  it('acumula varios avisos a la vez', () => {
    const warnings = collectWarnings(file('a.mp3'), mp3, opts({ format: 'flac', sampleRate: 96000 }))
    expect(warnings).toEqual(expect.arrayContaining(['upconversion', 'upsampling']))
  })

  it('no avisa de nada en una conversión sensata', () => {
    expect(collectWarnings(file('a.flac'), flac, opts({ format: 'mp3', bitrateKbps: 320 }))).toEqual([])
  })
})
