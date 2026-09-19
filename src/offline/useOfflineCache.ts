import { useEffect, useRef, useState } from 'react'
import { session } from '../api'
import { cacheStateReducer, type CacheMessage, type CacheState } from './cacheState'

// Пятнадцать секунд — компромисс: реже, чем пользователь успевает заметить, что
// сеть вернулась, и достаточно редко, чтобы не бить по батарее в самолёте.
const RECONNECT_PROBE_MS = 15_000

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

  // Вернуться в онлайн само по себе событие `online` не поможет: если пропал
  // только интернет, а сеть осталась, браузер его не пришлёт — с его точки
  // зрения ничего не менялось. А правки в этот момент скрыты, и пользователю
  // нечем спровоцировать запрос, который вернул бы приложение в строй. Поэтому
  // связь опрашивается сами: раз в интервал и сразу при возврате во вкладку.
  useEffect(() => {
    if (online) return
    let cancelled = false
    const probe = async () => {
      try {
        // /api/health намеренно не кэшируется, иначе ответ приходил бы из кэша
        // и проверка всегда говорила бы «связь есть».
        const response = await fetch(`${import.meta.env.BASE_URL}api/health`, { cache: 'no-store' })
        if (!cancelled && response.ok) setOnline(true)
      } catch {
        // Всё ещё оффлайн — ждём следующей попытки.
      }
    }
    const onFocus = () => void probe()
    // Только возвращение вкладки, не уход из неё: в скрытой вкладке проверять
    // связь незачем, за это отвечает интервал.
    const onVisible = () => { if (document.visibilityState === 'visible') void probe() }
    const timer = window.setInterval(() => void probe(), RECONNECT_PROBE_MS)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [online])

  // Смена поездки обнуляет индикатор: прогресс прошлой к новой отношения не имеет.
  useEffect(() => { setState({ kind: 'idle' }) }, [tripId])

  return { state, online }
}
