import { useCallback, useEffect, useRef, useState } from 'react'

import { convert, ConversionCancelled } from '../core/ffmpeg/convert'
import { readMetadata, releaseMetadata } from '../core/metadata/read'
import { validateFile, type FileRejection } from '../core/formats/quality'
import type { ConversionOptions, QueueItem } from '../types'

export interface RejectedFile {
  name: string
  reason: FileRejection
}

let counter = 0
const nextId = () => `item-${++counter}`

/**
 * Cola de conversión que procesa **un archivo a la vez**, tal y como anuncia el
 * README: ffmpeg.wasm ya satura un núcleo por sí solo y lanzar varias
 * conversiones en paralelo multiplicaría el uso de memoria sin ir más rápido.
 */
export function useConversionQueue() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [rejected, setRejected] = useState<RejectedFile[]>([])

  /**
   * La cola vive en el ref y el estado es solo su reflejo para pintar. Si el
   * ref fuese al revés (un espejo del estado) quedaría un tick por detrás, y
   * `pump` podría volver a coger un archivo que acaba de terminar.
   */
  const itemsRef = useRef<QueueItem[]>([])
  const runningRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const unmountedRef = useRef(false)

  const commit = useCallback((next: QueueItem[]) => {
    itemsRef.current = next
    setItems(next)
  }, [])

  const patch = useCallback(
    (id: string, changes: Partial<QueueItem>) => {
      commit(itemsRef.current.map((it) => (it.id === id ? { ...it, ...changes } : it)))
    },
    [commit],
  )

  /**
   * Toma el siguiente item en cola y lo convierte. Reentrante-seguro.
   *
   * Es un bucle imperativo sobre refs, no un valor derivado del render: el
   * compilador de React no puede demostrar que la memoización se mantiene y
   * avisa, pero aquí `useCallback` está por estabilidad de identidad, no por
   * rendimiento — `addFiles` y `retry` lo necesitan estable.
   */
  // oxlint-disable-next-line react/preserve-manual-memoization
  const pump = useCallback(async () => {
    if (runningRef.current) return
    const next = itemsRef.current.find((it) => it.status === 'queued')
    if (!next) return

    runningRef.current = true
    const controller = new AbortController()
    abortRef.current = controller
    const startedAt = performance.now()

    try {
      patch(next.id, { status: 'reading-metadata', progress: 0 })
      const metadata = next.sourceMetadata ?? (await readMetadata(next.file))
      if (controller.signal.aborted) throw new ConversionCancelled()

      patch(next.id, { status: 'converting', sourceMetadata: metadata })

      const result = await convert({
        file: next.file,
        options: next.options,
        metadata,
        cover: next.cover,
        signal: controller.signal,
        onProgress: (progress) => {
          if (!unmountedRef.current) patch(next.id, { progress })
        },
      })

      patch(next.id, {
        status: 'done',
        progress: 1,
        result,
        elapsedMs: performance.now() - startedAt,
      })
    } catch (error) {
      if (error instanceof ConversionCancelled || controller.signal.aborted) {
        patch(next.id, { status: 'cancelled', progress: 0 })
      } else {
        patch(next.id, {
          status: 'error',
          progress: 0,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    } finally {
      runningRef.current = false
      abortRef.current = null
      // Encadena el siguiente sin bloquear el render de este.
      if (!unmountedRef.current) queueMicrotask(() => void pump())
    }
  }, [patch])

  const addFiles = useCallback(
    (files: File[], options: ConversionOptions, cover?: Blob) => {
      const accepted: QueueItem[] = []
      const refused: RejectedFile[] = []

      for (const file of files) {
        const reason = validateFile(file)
        if (reason) {
          refused.push({ name: file.name, reason })
          continue
        }
        accepted.push({
          id: nextId(),
          file,
          cover,
          status: 'queued',
          progress: 0,
          options: { ...options },
          sourceUrl: URL.createObjectURL(file),
        })
      }

      setRejected(refused)
      if (accepted.length > 0) {
        commit([...itemsRef.current, ...accepted])
        void pump()
      }
    },
    [commit, pump],
  )

  /** Reintenta un item fallido o cancelado, opcionalmente con otras opciones. */
  const retry = useCallback(
    (id: string, options?: ConversionOptions) => {
      const previous = itemsRef.current.find((it) => it.id === id)
      // El resultado anterior deja de ser accesible: hay que soltar su URL.
      if (previous?.result) URL.revokeObjectURL(previous.result.url)
      commit(
        itemsRef.current.map((it) =>
          it.id === id
            ? {
                ...it,
                status: 'queued',
                progress: 0,
                error: undefined,
                result: undefined,
                options: options ?? it.options,
              }
            : it,
        ),
      )
      void pump()
    },
    [commit, pump],
  )

  const cancel = useCallback((id: string) => {
    const item = itemsRef.current.find((it) => it.id === id)
    if (!item) return
    if (item.status === 'converting' || item.status === 'reading-metadata') {
      // ffmpeg.wasm no sabe abortar un exec() a medias: se tira el worker.
      abortRef.current?.abort()
    } else {
      patch(id, { status: 'cancelled' })
    }
  }, [patch])

  /** Libera todo lo que ocupa memoria en un item. */
  const releaseItem = useCallback((item: QueueItem) => {
    if (item.sourceUrl) URL.revokeObjectURL(item.sourceUrl)
    if (item.result) URL.revokeObjectURL(item.result.url)
    releaseMetadata(item.sourceMetadata)
  }, [])

  const remove = useCallback(
    (id: string) => {
      const item = itemsRef.current.find((it) => it.id === id)
      if (item) {
        if (item.status === 'converting') abortRef.current?.abort()
        releaseItem(item)
      }
      commit(itemsRef.current.filter((it) => it.id !== id))
    },
    [commit, releaseItem],
  )

  const clearCompleted = useCallback(() => {
    const doneIds = new Set<string>()
    for (const item of itemsRef.current) {
      if (item.status === 'done' || item.status === 'error' || item.status === 'cancelled') {
        releaseItem(item)
        doneIds.add(item.id)
      }
    }
    commit(itemsRef.current.filter((it) => !doneIds.has(it.id)))
  }, [commit, releaseItem])

  // "Sin rastro": al desmontar no debe quedar ninguna object URL viva.
  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
      abortRef.current?.abort()
      for (const item of itemsRef.current) releaseItem(item)
    }
  }, [releaseItem])

  const isBusy = items.some((it) => it.status === 'converting' || it.status === 'reading-metadata')

  return { items, rejected, isBusy, addFiles, cancel, remove, retry, clearCompleted }
}
