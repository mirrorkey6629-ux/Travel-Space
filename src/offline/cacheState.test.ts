import { describe, expect, it } from 'vitest'
import { cachePercent, cacheStateReducer, type CacheState } from './cacheState'

describe('cacheStateReducer', () => {
  it('переводит из idle в прогресс и в готовность', () => {
    const idle: CacheState = { kind: 'idle' }
    const progress = cacheStateReducer(idle, { type: 'prefetch-progress', tripId: 't', done: 3, total: 12 }, 't')
    expect(progress).toEqual({ kind: 'prefetching', tripId: 't', done: 3, total: 12 })
    expect(cacheStateReducer(progress, { type: 'prefetch-done', tripId: 't' }, 't')).toEqual({ kind: 'ready' })
  })

  it('игнорирует сообщения про другую поездку', () => {
    const progress: CacheState = { kind: 'prefetching', tripId: 't', done: 3, total: 12 }
    expect(cacheStateReducer(progress, { type: 'prefetch-done', tripId: 'other' }, 't')).toBe(progress)
  })

  it('запоминает, на чём остановилась докачка', () => {
    const progress: CacheState = { kind: 'prefetching', tripId: 't', done: 9, total: 12 }
    expect(cacheStateReducer(progress, { type: 'prefetch-blocked', tripId: 't', reason: 'quota' }, 't'))
      .toEqual({ kind: 'blocked', reason: 'quota', done: 9, total: 12 })
  })
})

describe('cachePercent', () => {
  it('считает долю файлов и не делит на ноль', () => {
    expect(cachePercent({ kind: 'prefetching', tripId: 't', done: 3, total: 12 })).toBe(25)
    expect(cachePercent({ kind: 'blocked', reason: 'network', done: 9, total: 12 })).toBe(75)
    expect(cachePercent({ kind: 'prefetching', tripId: 't', done: 0, total: 0 })).toBe(0)
    expect(cachePercent({ kind: 'ready' })).toBe(100)
    expect(cachePercent({ kind: 'idle' })).toBe(0)
  })
})
