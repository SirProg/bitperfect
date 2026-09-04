import { useCallback, useState } from 'react'

import { EMPTY_SETTINGS, type WorkerSettings } from './types'

const STORAGE_KEY = 'bitperfect.worker'

/**
 * Los ajustes del worker viven en `localStorage`.
 *
 * Es una comodidad por navegador, no un almacén de secretos: el token da acceso
 * a un worker que ya es del propio usuario, y cualquier script capaz de leerlo
 * podría llamar al worker de todas formas. Se guarda para no tener que pegarlo
 * en cada visita.
 */
export function loadSettings(): WorkerSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_SETTINGS
    const parsed = JSON.parse(raw) as Partial<WorkerSettings>
    return {
      url: typeof parsed.url === 'string' ? parsed.url : '',
      token: typeof parsed.token === 'string' ? parsed.token : '',
    }
  } catch {
    // Modo privado, almacenamiento bloqueado o un valor corrupto de otra versión.
    return EMPTY_SETTINGS
  }
}

export function saveSettings(settings: WorkerSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Sin persistencia la función sigue sirviendo durante esta sesión.
  }
}

export function clearSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nada que hacer, y nada que romper.
  }
}

export function isConfigured(settings: WorkerSettings): boolean {
  return settings.url.trim().length > 0
}

export function useWorkerSettings() {
  // Inicializador perezoso: la app es solo cliente, así que no hay hidratación
  // que respetar y leerlo ya en el primer render evita que la pestaña de URL
  // parpadee mostrando «sin configurar» a quien sí lo tiene.
  const [settings, setSettings] = useState<WorkerSettings>(loadSettings)

  const update = useCallback((next: WorkerSettings) => {
    setSettings(next)
    saveSettings(next)
  }, [])

  const forget = useCallback(() => {
    setSettings(EMPTY_SETTINGS)
    clearSettings()
  }, [])

  return { settings, update, forget, configured: isConfigured(settings) }
}
