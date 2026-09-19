export type CacheKind = 'asset' | 'data' | 'media' | 'avatar'

/**
 * Определяет, в какой кэш попадает запрос, или `null` — если он обслуживается
 * только сетью.
 *
 * Живёт отдельным модулем, а не внутри `sw.ts`: в service worker эту логику
 * нечем покрыть тестами, а она решает, что вообще окажется доступно оффлайн.
 *
 * `scope` приходит из `self.registration.scope`, поэтому префикс публикации не
 * задаётся здесь константой: он уже определён в `vite.config.ts` и в конфиге API.
 */
export function classifyRequest(method: string, url: URL, scope: URL): CacheKind | null {
  if (method !== 'GET') return null
  if (url.origin !== scope.origin) return null
  if (!url.pathname.startsWith(scope.pathname)) return null
  const rest = url.pathname.slice(scope.pathname.length)
  if (rest.startsWith('assets/')) return 'asset'
  if (!rest.startsWith('api/')) return null
  const endpoint = rest.slice('api/'.length)
  // Экспорт поездки — разовая выгрузка архива. Класть её в кэш данных значит
  // удвоить вес всех документов ради файла, который нужен один раз.
  if (/^trips\/[^/]+\/export$/.test(endpoint)) return null
  if (endpoint.endsWith('/avatar')) return 'avatar'
  if (/^documents\/[^/]+\/download$/.test(endpoint)) return 'media'
  if (/^public-trips\/[^/]+\/documents\/[^/]+$/.test(endpoint)) return 'media'
  return 'data'
}
