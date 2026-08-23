import { describe, expect, it } from 'vitest'

import type { ConversionOptions } from '../../types'
import { FORMAT_IDS, getFormat } from '../formats/catalog'
import { buildArgs, downloadFilename, virtualInputName } from './buildArgs'
import { parseTimeFromLog } from './progress'

const base: Omit<ConversionOptions, 'format'> = {
  preset: 'custom',
  preserveMetadata: true,
  preserveCoverArt: true,
}

const opts = (o: Partial<ConversionOptions> & { format: ConversionOptions['format'] }): ConversionOptions => ({
  ...base,
  ...o,
})

/** Valor que sigue a `flag` en la lista de argumentos. */
function valueOf(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag)
  return i === -1 ? undefined : args[i + 1]
}

describe('buildArgs', () => {
  it('empieza por la entrada y termina por la salida', () => {
    const args = buildArgs('cancion.flac', opts({ format: 'mp3' }))
    expect(args.slice(0, 2)).toEqual(['-i', 'input.flac'])
    expect(args.at(-1)).toBe('output.mp3')
  })

  it('conserva la extensión del origen en el nombre virtual: ffmpeg elige el demuxer por ella', () => {
    expect(virtualInputName('a b.FLAC')).toBe('input.flac')
    expect(virtualInputName('sin-extension')).toBe('input')
  })

  describe('bitrate', () => {
    it('se emite en formatos con pérdida', () => {
      const args = buildArgs('x.wav', opts({ format: 'mp3', bitrateKbps: 320 }))
      expect(valueOf(args, '-b:a')).toBe('320k')
    })

    it('se descarta en formatos sin pérdida, donde no significa nada', () => {
      for (const format of ['flac', 'wav', 'alac', 'aiff'] as const) {
        const args = buildArgs('x.mp3', opts({ format, bitrateKbps: 320 }))
        expect(args, format).not.toContain('-b:a')
      }
    })
  })

  describe('profundidad de bits', () => {
    it('WAV y AIFF la eligen cambiando de encoder PCM', () => {
      expect(valueOf(buildArgs('x.flac', opts({ format: 'wav', bitDepth: 24 })), '-c:a')).toBe('pcm_s24le')
      expect(valueOf(buildArgs('x.flac', opts({ format: 'aiff', bitDepth: 24 })), '-c:a')).toBe('pcm_s24be')
      expect(valueOf(buildArgs('x.flac', opts({ format: 'wav', bitDepth: 32 })), '-c:a')).toBe('pcm_s32le')
    })

    it('FLAC y ALAC la eligen con -sample_fmt', () => {
      expect(valueOf(buildArgs('x.wav', opts({ format: 'flac', bitDepth: 16 })), '-sample_fmt')).toBe('s16')
      expect(valueOf(buildArgs('x.wav', opts({ format: 'alac', bitDepth: 16 })), '-sample_fmt')).toBe('s16p')
    })

    it('24 bits declara bits_per_raw_sample: ni FLAC ni ALAC tienen sample_fmt de 24', () => {
      const flac = buildArgs('x.wav', opts({ format: 'flac', bitDepth: 24 }))
      expect(valueOf(flac, '-sample_fmt')).toBe('s32')
      expect(valueOf(flac, '-bits_per_raw_sample')).toBe('24')

      const alac = buildArgs('x.wav', opts({ format: 'alac', bitDepth: 24 }))
      expect(valueOf(alac, '-sample_fmt')).toBe('s32p')
      expect(valueOf(alac, '-bits_per_raw_sample')).toBe('24')
    })

    it('se descarta en formatos con pérdida', () => {
      for (const format of ['mp3', 'aac', 'ogg', 'opus'] as const) {
        const args = buildArgs('x.flac', opts({ format, bitDepth: 24 }))
        expect(args, format).not.toContain('-sample_fmt')
        expect(args, format).not.toContain('-bits_per_raw_sample')
      }
    })
  })

  describe('sample rate', () => {
    it('se emite cuando el encoder lo admite', () => {
      expect(valueOf(buildArgs('x.flac', opts({ format: 'mp3', sampleRate: 48000 })), '-ar')).toBe('48000')
    })

    it('se descarta si el encoder no lo admite, porque ffmpeg abortaría', () => {
      // libmp3lame no pasa de 48 kHz y libvorbis tampoco en este build.
      expect(buildArgs('x.flac', opts({ format: 'mp3', sampleRate: 96000 }))).not.toContain('-ar')
      expect(buildArgs('x.flac', opts({ format: 'ogg', sampleRate: 96000 }))).not.toContain('-ar')
      // libopus solo admite 8/12/16/24/48 kHz.
      expect(buildArgs('x.flac', opts({ format: 'opus', sampleRate: 44100 }))).not.toContain('-ar')
      expect(valueOf(buildArgs('x.flac', opts({ format: 'opus', sampleRate: 48000 })), '-ar')).toBe('48000')
    })
  })

  describe('carátula', () => {
    it('se mapea de forma opcional en formatos que la admiten', () => {
      const args = buildArgs('x.flac', opts({ format: 'mp3', preserveCoverArt: true }))
      // El `?` evita que falle cuando el origen no trae imagen.
      expect(args).toContain('0:v?')
      expect(valueOf(args, '-disposition:v')).toBe('attached_pic')
      expect(args).not.toContain('-vn')
    })

    it('se descarta en Ogg y Opus, que no la soportan al escribir con ffmpeg', () => {
      for (const format of ['ogg', 'opus'] as const) {
        const args = buildArgs('x.flac', opts({ format, preserveCoverArt: true }))
        expect(args, format).toContain('-vn')
        expect(args, format).not.toContain('0:v?')
      }
    })

    it('usa -vn cuando el usuario la desactiva', () => {
      expect(buildArgs('x.flac', opts({ format: 'mp3', preserveCoverArt: false }))).toContain('-vn')
    })
  })

  describe('metadatos', () => {
    it('-map_metadata 0 los conserva y -1 los descarta', () => {
      expect(valueOf(buildArgs('x.flac', opts({ format: 'mp3' })), '-map_metadata')).toBe('0')
      expect(
        valueOf(buildArgs('x.flac', opts({ format: 'mp3', preserveMetadata: false })), '-map_metadata'),
      ).toBe('-1')
    })

    it('MP3 fuerza ID3v2.3, mucho más compatible que el 2.4 por defecto', () => {
      expect(valueOf(buildArgs('x.flac', opts({ format: 'mp3' })), '-id3v2_version')).toBe('3')
      expect(buildArgs('x.flac', opts({ format: 'aac' }))).not.toContain('-id3v2_version')
    })
  })

  describe('compresión FLAC', () => {
    it('se emite solo en FLAC y se limita a 0–8', () => {
      expect(valueOf(buildArgs('x.wav', opts({ format: 'flac', flacCompression: 8 })), '-compression_level')).toBe('8')
      expect(valueOf(buildArgs('x.wav', opts({ format: 'flac', flacCompression: 99 })), '-compression_level')).toBe('8')
      expect(valueOf(buildArgs('x.wav', opts({ format: 'flac', flacCompression: -3 })), '-compression_level')).toBe('0')
      expect(buildArgs('x.wav', opts({ format: 'wav', flacCompression: 8 }))).not.toContain('-compression_level')
    })
  })

  describe('rodeos a defectos de ffmpeg.wasm', () => {
    it('Opus fija complejidad 4: por encima de 4 revienta el heap a 48 kHz estéreo', () => {
      const args = buildArgs('x.flac', opts({ format: 'opus' }))
      expect(valueOf(args, '-compression_level')).toBe('4')
    })

    it('el resto de formatos no lleva argumentos fijos de encoder', () => {
      for (const id of FORMAT_IDS) {
        if (id === 'opus') continue
        expect(getFormat(id).encoderArgs, id).toBeUndefined()
      }
    })
  })

  it('produce argumentos para todos los formatos del catálogo', () => {
    for (const format of FORMAT_IDS) {
      const spec = getFormat(format)
      const args = buildArgs('pista.wav', opts({ format, bitrateKbps: spec.defaultBitrateKbps, bitDepth: spec.defaultBitDepth }))
      expect(args.at(-1), format).toBe(`output.${spec.extension}`)
      expect(args, format).toContain('-c:a')
    }
  })
})

describe('downloadFilename', () => {
  it('sustituye la extensión conservando el nombre', () => {
    expect(downloadFilename('Pista 01.flac', opts({ format: 'mp3' }))).toBe('Pista 01.mp3')
  })

  it('respeta los puntos internos del nombre', () => {
    expect(downloadFilename('a.b.c.flac', opts({ format: 'wav' }))).toBe('a.b.c.wav')
  })

  it('AAC y ALAC comparten el contenedor .m4a', () => {
    expect(downloadFilename('x.wav', opts({ format: 'aac' }))).toBe('x.m4a')
    expect(downloadFilename('x.wav', opts({ format: 'alac' }))).toBe('x.m4a')
  })

  it('da un nombre por defecto si el archivo no tiene base', () => {
    expect(downloadFilename('.flac', opts({ format: 'mp3' }))).toBe('audio.mp3')
  })
})

describe('parseTimeFromLog', () => {
  it('extrae los segundos de la línea de progreso de ffmpeg', () => {
    expect(parseTimeFromLog('size= 1024kB time=00:01:23.45 bitrate= 192.0kbits/s')).toBeCloseTo(83.45)
    expect(parseTimeFromLog('time=01:00:00.00')).toBe(3600)
  })

  it('ignora las líneas que no llevan time=', () => {
    expect(parseTimeFromLog('Stream #0:0: Audio: flac')).toBeUndefined()
  })
})
