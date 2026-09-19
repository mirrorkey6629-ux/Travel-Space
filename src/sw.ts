/// <reference lib="webworker" />
import { clientsClaim, type WorkboxPlugin } from 'workbox-core'
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate, type Strategy } from 'workbox-strategies'
import { classifyRequest, type CacheKind } from './offline/classifyRequest'
import { runPrefetch } from './offline/prefetchQueue'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

const scope = new URL(self.registration.scope)

const CACHES: Record<CacheKind, string> = {
  asset: 'travel-assets-v1',
  data: 'travel-data-v1',
  media: 'travel-media-v1',
  avatar: 'travel-avatars-v1',
}

// Приватные кэши сносятся при выходе из аккаунта: ключ Cache API — это URL, а не
// токен, поэтому иначе следующий пользователь того же браузера увидел бы чужую
// поездку. Кэш статики приватного не содержит и выход переживает.
const PRIVATE_CACHES = [CACHES.data, CACHES.media, CACHES.avatar]
const KNOWN_CACHES = new Set<string>(Object.values(CACHES))

// Без clientsClaim страница, на которой worker впервые установился, остаётся
// неуправляемой до конца своей жизни: перехвата нет, и переключение в оффлайн
// без перезагрузки ломает любой ещё не скачанный ресурс.
//
// Здесь это безопасно именно потому, что skipWaiting не вызывается: новый
// worker активируется только когда старых вкладок не осталось, поэтому
// захватывать страницу с чужой версией бандла ему не придётся. А при самой
// первой установке чужой версии просто нет.
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(
    names.filter((name) => name.startsWith('travel-') && !KNOWN_CACHES.has(name)).map((name) => caches.delete(name)),
  )))
})

async function broadcast(message: unknown) {
  // includeUncontrolled: на самой первой загрузке страница ещё не под
  // управлением worker-а, но прогресс докачки ей уже нужен.
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
  clients.forEach((client) => client.postMessage(message))
}

// Состояние сети берётся из реальных запросов, а не из navigator.onLine: тот
// показывает «онлайн» и при Wi-Fi без интернета.
let online = true
function setOnline(value: boolean) {
  if (online === value) return
  online = value
  void broadcast({ type: 'network', online: value })
}

const networkSignal: WorkboxPlugin = {
  fetchDidSucceed: async ({ response }) => { setOnline(true); return response },
  fetchDidFail: async () => { setOnline(false) },
}

const strategies: Record<CacheKind, Strategy> = {
  asset: new CacheFirst({ cacheName: CACHES.asset }),
  // Документ по id неизменяем: правка создаёт новую строку с новым id.
  media: new CacheFirst({ cacheName: CACHES.media }),
  // Аватар меняется по тому же URL, поэтому отдаём кэш и обновляем следом.
  avatar: new StaleWhileRevalidate({ cacheName: CACHES.avatar }),
  // Свежесть данных важнее кэша, но на плохой сети поездка всё равно откроется.
  data: new NetworkFirst({ cacheName: CACHES.data, networkTimeoutSeconds: 4, plugins: [networkSignal] }),
}

// Прямой заход на /travel/view/<token> должен открываться и оффлайн: сервер на
// такие пути отдаёт index.html, и worker обязан делать то же самое.
registerRoute(new NavigationRoute(createHandlerBoundToURL(`${scope.pathname}index.html`), {
  denylist: [new RegExp(`^${scope.pathname}api/`)],
}))

for (const kind of Object.keys(strategies) as CacheKind[]) {
  registerRoute(({ request, url }) => classifyRequest(request.method, url, scope) === kind, strategies[kind])
}

type PrefetchMessage = { type: 'prefetch'; tripId: string | null; token: string; urls: string[] }
type PrefetchTask = { tripId: string | null; token: string; cancelled: boolean }

let task: PrefetchTask | null = null

self.addEventListener('message', (event) => {
  const data = event.data as { type?: string } | null
  if (!data || typeof data !== 'object') return
  if (data.type === 'prefetch') event.waitUntil(prefetch(data as PrefetchMessage))
  if (data.type === 'clear-private') event.waitUntil(Promise.all(PRIVATE_CACHES.map((name) => caches.delete(name))))
})

/**
 * Кладёт один ресурс в его кэш.
 *
 * Токен подставляется только приватным эндпоинтам и живёт исключительно в
 * памяти worker-а: ни в кэш, ни в IndexedDB он не попадает.
 *
 * Ответ не-2xx сбоем докачки не считается: удалённый документ не должен ронять
 * всю очередь. Пробрасываются только настоящие сетевые ошибки и нехватка
 * места — на них останавливаться осмысленно.
 */
async function store(url: string, token: string) {
  const target = new URL(url, scope)
  const kind = classifyRequest('GET', target, scope)
  if (!kind) return
  const headers = new Headers()
  if (kind !== 'asset' && token) headers.set('Authorization', `Bearer ${token}`)
  let response: Response
  try {
    response = await fetch(target, { headers, credentials: 'same-origin' })
  } catch (reason) {
    setOnline(false)
    throw reason
  }
  setOnline(true)
  if (!response.ok) return
  const cache = await caches.open(CACHES[kind])
  await cache.put(target.toString(), response)
}

async function prefetch({ tripId, token, urls }: PrefetchMessage) {
  if (task) task.cancelled = true
  const current: PrefetchTask = { tripId, token, cancelled: false }
  task = current

  await runPrefetch(tripId, urls, {
    classify: (url) => classifyRequest('GET', new URL(url, scope), scope),
    has: async (kind, url) => Boolean(await caches.open(CACHES[kind]).then((cache) => cache.match(url))),
    store: (_kind, url) => store(url, current.token),
    report: (message) => { void broadcast(message) },
    cancelled: () => current.cancelled,
  })

  if (task === current) task = null
}
