import type { CacheBlockReason, CacheMessage } from './cacheState'
import type { CacheKind } from './classifyRequest'

/**
 * Зависимости очереди вынесены наружу, чтобы её можно было прогнать в vitest:
 * внутри service worker ни Cache API, ни клиентов не подделать.
 */
export type PrefetchDeps = {
  classify: (url: string) => CacheKind | null
  has: (kind: CacheKind, url: string) => Promise<boolean>
  store: (kind: CacheKind, url: string) => Promise<void>
  report: (message: CacheMessage) => void
  /** Проверяется перед каждым файлом: открытие другой поездки отменяет докачку. */
  cancelled: () => boolean
}

// Два параллельных потока: больше не ускоряет мобильную сеть, но заметно мешает
// обычным запросам страницы.
const CONCURRENCY = 2

// Нехватка места — это конец докачки: повторять бессмысленно, пока место не
// освободится. Всё остальное считаем сетевым сбоем и пробуем при следующем
// открытии поездки.
const blockReason = (reason: unknown): CacheBlockReason =>
  reason instanceof DOMException && reason.name === 'QuotaExceededError' ? 'quota' : 'network'

/**
 * Докачивает недостающие ресурсы поездки и отчитывается о прогрессе.
 *
 * Прогресс считается по числу файлов, а не по байтам: размер заранее неизвестен,
 * а счётчик файлов честно доходит до конца и не прыгает.
 */
export async function runPrefetch(tripId: string | null, urls: string[], deps: PrefetchDeps): Promise<void> {
  const pending: Array<{ kind: CacheKind; url: string }> = []
  let done = 0

  for (const url of urls) {
    const kind = deps.classify(url)
    if (!kind) continue
    if (await deps.has(kind, url)) done += 1
    else pending.push({ kind, url })
  }
  if (deps.cancelled()) return

  const total = done + pending.length
  deps.report({ type: 'prefetch-progress', tripId, done, total })
  if (!pending.length) {
    deps.report({ type: 'prefetch-done', tripId })
    return
  }

  let index = 0
  let blocked: CacheBlockReason | null = null
  const worker = async () => {
    while (!deps.cancelled() && !blocked) {
      const item = pending[index++]
      if (item === undefined) return
      try {
        await deps.store(item.kind, item.url)
      } catch (reason) {
        blocked = blockReason(reason)
        return
      }
      done += 1
      deps.report({ type: 'prefetch-progress', tripId, done, total })
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  if (deps.cancelled()) return
  if (blocked) deps.report({ type: 'prefetch-blocked', tripId, reason: blocked })
  else deps.report({ type: 'prefetch-done', tripId })
}
