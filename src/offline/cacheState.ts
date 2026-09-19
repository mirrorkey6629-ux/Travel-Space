export type CacheBlockReason = 'quota' | 'network'

export type CacheState =
  | { kind: 'idle' }
  | { kind: 'prefetching'; tripId: string | null; done: number; total: number }
  | { kind: 'ready' }
  | { kind: 'blocked'; reason: CacheBlockReason; done: number; total: number }

export type CacheMessage =
  | { type: 'prefetch-progress'; tripId: string | null; done: number; total: number }
  | { type: 'prefetch-done'; tripId: string | null }
  | { type: 'prefetch-blocked'; tripId: string | null; reason: CacheBlockReason }

/**
 * Service worker один на все вкладки, поэтому сообщение может прийти про чужую
 * поездку — например, пока в соседней вкладке открыта другая. Такое сообщение
 * не должно двигать индикатор, поэтому `tripId` сверяется явно.
 */
export function cacheStateReducer(state: CacheState, message: CacheMessage, tripId: string | null): CacheState {
  if (message.tripId !== tripId) return state
  if (message.type === 'prefetch-progress') return { kind: 'prefetching', tripId, done: message.done, total: message.total }
  if (message.type === 'prefetch-done') return { kind: 'ready' }
  const done = state.kind === 'prefetching' ? state.done : 0
  const total = state.kind === 'prefetching' ? state.total : 0
  return { kind: 'blocked', reason: message.reason, done, total }
}

export function cachePercent(state: CacheState): number {
  if (state.kind === 'ready') return 100
  if (state.kind === 'idle') return 0
  return state.total > 0 ? Math.round((state.done / state.total) * 100) : 0
}
