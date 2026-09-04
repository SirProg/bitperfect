import { describe, expect, it } from 'vitest'

import { checkSourceUrl, checkWorkerUrl, hostOf, normaliseWorkerUrl } from './validate'

describe('checkSourceUrl', () => {
  it('acepta direcciones http y https', () => {
    expect(checkSourceUrl('https://www.youtube.com/watch?v=abc')).toBeNull()
    expect(checkSourceUrl('http://example.com/a.mp3')).toBeNull()
  })

  it('ignora los espacios alrededor', () => {
    expect(checkSourceUrl('  https://example.com  ')).toBeNull()
  })

  it('señala el campo vacío', () => {
    expect(checkSourceUrl('')).toBe('empty')
    expect(checkSourceUrl('   ')).toBe('empty')
  })

  it('rechaza lo que no es una URL', () => {
    expect(checkSourceUrl('esto no es una url')).toBe('not-a-url')
    expect(checkSourceUrl('youtube.com/watch')).toBe('not-a-url')
  })

  it('rechaza esquemas que no son http', () => {
    for (const url of ['file:///etc/passwd', 'ftp://x.com/a', 'javascript:alert(1)']) {
      expect(checkSourceUrl(url), url).toBe('bad-scheme')
    }
  })
})

describe('checkWorkerUrl', () => {
  it('acepta la URL de un worker desplegado y uno local', () => {
    expect(checkWorkerUrl('https://mi-worker.fly.dev')).toBeNull()
    expect(checkWorkerUrl('http://localhost:8080')).toBeNull()
  })

  it('rechaza vacío y esquemas raros', () => {
    expect(checkWorkerUrl('')).toBe('empty')
    expect(checkWorkerUrl('mi-worker.fly.dev')).toBe('not-a-url')
    expect(checkWorkerUrl('ws://mi-worker.fly.dev')).toBe('bad-scheme')
  })
})

describe('normaliseWorkerUrl', () => {
  it('quita las barras finales para poder concatenar rutas', () => {
    expect(normaliseWorkerUrl('https://x.fly.dev/')).toBe('https://x.fly.dev')
    expect(normaliseWorkerUrl('https://x.fly.dev///')).toBe('https://x.fly.dev')
    expect(normaliseWorkerUrl('  https://x.fly.dev  ')).toBe('https://x.fly.dev')
  })

  it('deja intacta una URL ya normalizada', () => {
    expect(normaliseWorkerUrl('https://x.fly.dev')).toBe('https://x.fly.dev')
  })
})

describe('hostOf', () => {
  it('devuelve el dominio sin www', () => {
    expect(hostOf('https://www.youtube.com/watch?v=x')).toBe('youtube.com')
    expect(hostOf('https://vm.tiktok.com/abc')).toBe('vm.tiktok.com')
  })

  it('devuelve null si no se puede leer', () => {
    expect(hostOf('no es una url')).toBeNull()
  })
})
