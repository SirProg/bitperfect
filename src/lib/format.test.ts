import { describe, expect, it } from 'vitest'

import { formatBytes, formatDuration, formatSampleRate, formatSizeDelta } from './format'

describe('formatBytes', () => {
  it('escala a la unidad legible', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 kB')
    expect(formatBytes(38 * 1024 * 1024)).toBe('38.0 MB')
  })

  it('quita los decimales cuando ya no aportan', () => {
    expect(formatBytes(150 * 1024)).toBe('150 kB')
  })
})

describe('formatDuration', () => {
  it('usa m:ss por debajo de una hora y h:mm:ss por encima', () => {
    expect(formatDuration(222)).toBe('3:42')
    expect(formatDuration(9)).toBe('0:09')
    expect(formatDuration(3661)).toBe('1:01:01')
  })

  it('devuelve undefined si no hay duración', () => {
    expect(formatDuration(undefined)).toBeUndefined()
    expect(formatDuration(Number.NaN)).toBeUndefined()
  })
})

describe('formatSampleRate', () => {
  it('mantiene el decimal solo donde existe', () => {
    expect(formatSampleRate(44100)).toBe('44.1 kHz')
    expect(formatSampleRate(48000)).toBe('48 kHz')
  })
})

describe('formatSizeDelta', () => {
  it('indica el sentido del cambio', () => {
    expect(formatSizeDelta(1000, 500).label).toBe('−50 %')
    expect(formatSizeDelta(1000, 3000).label).toBe('+200 %')
  })

  it('no señala cambios imperceptibles', () => {
    expect(formatSizeDelta(1000, 1002).label).toBe('=')
  })
})
