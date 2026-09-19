import { describe, expect, it, vi } from 'vitest'
import type { CacheMessage } from './cacheState'
import type { CacheKind } from './classifyRequest'
import { runPrefetch, type PrefetchDeps } from './prefetchQueue'

function harness(overrides: Partial<PrefetchDeps> = {}) {
  const messages: CacheMessage[] = []
  const stored: string[] = []
  const deps: PrefetchDeps = {
    classify: (url) => url.includes('skip') ? null : 'media',
    has: async () => false,
    store: async (_kind, url) => { stored.push(url) },
    report: (message) => { messages.push(message) },
    cancelled: () => false,
    ...overrides,
  }
  return { deps, messages, stored }
}

const progress = (messages: CacheMessage[]) =>
  messages.filter((item) => item.type === 'prefetch-progress').map((item) => `${item.done}/${item.total}`)

describe('runPrefetch', () => {
  it('качает недостающее и заканчивает готовностью', async () => {
    const { deps, messages, stored } = harness()
    await runPrefetch('t', ['a', 'b', 'c'], deps)
    expect(stored.sort()).toEqual(['a', 'b', 'c'])
    expect(progress(messages)).toEqual(['0/3', '1/3', '2/3', '3/3'])
    expect(messages.at(-1)).toEqual({ type: 'prefetch-done', tripId: 't' })
  })

  it('считает уже закэшированное сделанным', async () => {
    const { deps, messages, stored } = harness({ has: async (_kind, url) => url === 'a' })
    await runPrefetch('t', ['a', 'b'], deps)
    expect(stored).toEqual(['b'])
    expect(progress(messages)).toEqual(['1/2', '2/2'])
  })

  it('при полном кэше сразу сообщает готовность и ничего не качает', async () => {
    const { deps, messages, stored } = harness({ has: async () => true })
    await runPrefetch('t', ['a', 'b'], deps)
    expect(stored).toEqual([])
    expect(progress(messages)).toEqual(['2/2'])
    expect(messages.at(-1)).toEqual({ type: 'prefetch-done', tripId: 't' })
  })

  it('пропускает адреса, которым не место в кэше', async () => {
    const { deps, messages, stored } = harness()
    await runPrefetch('t', ['a', 'skip-me', 'b'], deps)
    expect(stored.sort()).toEqual(['a', 'b'])
    expect(progress(messages).at(0)).toBe('0/2')
  })

  it('останавливается на нехватке места', async () => {
    const store = vi.fn(async (_kind: CacheKind, url: string) => {
      if (url === 'b') throw new DOMException('no room', 'QuotaExceededError')
    })
    const { deps, messages } = harness({ store, classify: () => 'media' })
    await runPrefetch('t', ['a', 'b', 'c', 'd'], deps)
    expect(messages.at(-1)).toEqual({ type: 'prefetch-blocked', tripId: 't', reason: 'quota' })
  })

  it('сетевую ошибку отличает от нехватки места', async () => {
    const store = vi.fn(async (_kind: CacheKind, url: string) => {
      if (url === 'a') throw new TypeError('Failed to fetch')
    })
    const { deps, messages } = harness({ store, classify: () => 'media' })
    await runPrefetch('t', ['a', 'b'], deps)
    expect(messages.at(-1)).toEqual({ type: 'prefetch-blocked', tripId: 't', reason: 'network' })
  })

  it('отменённая задача молчит', async () => {
    const { deps, messages, stored } = harness({ cancelled: () => true })
    await runPrefetch('t', ['a', 'b'], deps)
    expect(stored).toEqual([])
    expect(messages).toEqual([])
  })

  it('не роняет очередь из-за удалённого документа', async () => {
    const store = vi.fn(async (_kind: CacheKind, url: string) => {
      // store сам глотает ответы не-2xx, поэтому очередь просто идёт дальше.
      if (url === 'gone') return
    })
    const { deps, messages } = harness({ store, classify: () => 'media' })
    await runPrefetch('t', ['gone', 'b'], deps)
    expect(messages.at(-1)).toEqual({ type: 'prefetch-done', tripId: 't' })
  })
})
