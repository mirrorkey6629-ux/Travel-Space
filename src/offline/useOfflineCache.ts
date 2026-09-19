import { useEffect, useRef, useState } from 'react'
import { session } from '../api'
import { cacheStateReducer, type CacheMessage, type CacheState } from './cacheState'

const supported = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator

async function activeWorker(): Promise<ServiceWorker | null> {
  if (!supported()) return null
  // getRegistration до ready: без зарегистрированного worker-а (в dev его нет)
  // navigator.serviceWorker.ready не резолвится никогда.
  const existing = await navigator.serviceWorker.getRegistration()
  if (!existing) return null
  const registration = await navigator.serviceWorker.ready
  return registration.active
}

/** Просит worker докачать список ресурсов. Новая задача отменяет предыдущую. */
export async function requestPrefetch(tripId: string | null, urls: string[]) {
  if (!urls.length) return
  const worker = await activeWorker()
  worker?.postMessage({ type: 'prefetch', tripId, token: session.token, urls })
}

/** Сносит приватные кэши при выходе из аккаунта. */
export async function clearPrivateCaches() {
  const worker = await activeWorker()
  worker?.postMessage({ type: 'clear-private' })
}

/**
 * Один раз просит браузер не вытеснять наш кэш. Установленной PWA Chrome
 * выдаёт разрешение молча, обычной вкладке — отказывает, и это не ошибка.
 */
export function keepStorage() {
  void navigator.storage?.persist?.().catch(() => undefined)
}

export function useOfflineCache(tripId: string | null) {
  const [state, setState] = useState<CacheState>({ kind: 'idle' })
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  const tripIdRef = useRef(tripId)
  tripIdRef.current = tripId

  // Два источника намеренно: события окна реагируют мгновенно на выключенный
  // Wi-Fi, а сообщения worker-а ловят случай «сеть есть, интернета нет».
  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  useEffect(() => {
    if (!supported()) return
    const onMessage = (event: MessageEvent) => {
      const data = event.data as (CacheMessage | { type: 'network'; online: boolean }) | null
      if (!data || typeof data !== 'object') return
      if (data.type === 'network') { setOnline(data.online); return }
      setState((current) => cacheStateReducer(current, data, tripIdRef.current))
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [])

  // Смена поездки обнуляет индикатор: прогресс прошлой к новой отношения не имеет.
  useEffect(() => { setState({ kind: 'idle' }) }, [tripId])

  return { state, online }
}
