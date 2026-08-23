import { describe, expect, it } from 'vitest'

import { buildArgs } from '../ffmpeg/buildArgs'
import { FORMAT_IDS, getFormat } from './catalog'
import { applyPreset, defaultOptions } from './presets'

describe('applyPreset', () => {
  it('produce opciones válidas para todo formato del catálogo', () => {
    for (const format of FORMAT_IDS) {
      for (const preset of ['maxQuality', 'balanced', 'mobile'] as const) {
        const spec = getFormat(format)
        const options = { ...defaultOptions(format), ...applyPreset(preset, format) }

        if (options.bitrateKbps !== undefined && spec.bitrates.length > 0) {
          expect(spec.bitrates, `${format}/${preset}`).toContain(options.bitrateKbps)
        }
        if (options.sampleRate !== undefined) {
          expect(spec.sampleRates, `${format}/${preset}`).toContain(options.sampleRate)
        }
        if (options.bitDepth !== undefined && spec.bitDepths.length > 0) {
          expect(spec.bitDepths, `${format}/${preset}`).toContain(options.bitDepth)
        }
        // Y el resultado tiene que ser una línea de comandos construible.
        expect(() => buildArgs('x.wav', options), `${format}/${preset}`).not.toThrow()
      }
    }
  })

  it('máxima calidad usa el bitrate más alto del formato', () => {
    expect(applyPreset('maxQuality', 'mp3').bitrateKbps).toBe(320)
    expect(applyPreset('maxQuality', 'opus').bitrateKbps).toBe(256)
  })

  it('el preset de móvil baja el bitrate frente a equilibrado', () => {
    for (const format of ['mp3', 'aac', 'ogg', 'opus'] as const) {
      const mobile = applyPreset('mobile', format).bitrateKbps!
      const balanced = applyPreset('balanced', format).bitrateKbps!
      expect(mobile, format).toBeLessThan(balanced)
    }
  })

  it('en FLAC la compresión sube con la calidad y nunca sale de 0–8', () => {
    const levels = (['mobile', 'balanced', 'maxQuality'] as const).map(
      (p) => applyPreset(p, 'flac').flacCompression!,
    )
    expect(levels).toEqual([...levels].sort((a, b) => a - b))
    for (const l of levels) expect(l).toBeGreaterThanOrEqual(0)
    for (const l of levels) expect(l).toBeLessThanOrEqual(8)
  })

  it('no sube la profundidad por encima de la del original', () => {
    const de16 = applyPreset('maxQuality', 'flac', { bitDepth: 16 })
    expect(de16.bitDepth).toBe(16)
    const de24 = applyPreset('maxQuality', 'flac', { bitDepth: 24 })
    expect(de24.bitDepth).toBe(24)
  })

  it('"custom" no toca nada', () => {
    expect(applyPreset('custom', 'mp3')).toEqual({})
  })
})

describe('defaultOptions', () => {
  it('devuelve algo convertible para cada formato', () => {
    for (const format of FORMAT_IDS) {
      const options = defaultOptions(format)
      expect(options.format).toBe(format)
      const args = buildArgs('pista.flac', options)
      expect(args.at(-1)).toBe(`output.${getFormat(format).extension}`)
    }
  })
})
