import { Icon } from './Icon'
import { cachePercent, type CacheState } from '../offline/cacheState'

// Кольцо рисуется штрихом по окружности: dasharray задаёт «закрашено / всего».
const RADIUS = 8
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const BLOCK_TITLES = {
  quota: 'Не хватило места, поездка сохранена не полностью',
  network: 'Докачка прервалась, продолжим при следующем открытии',
}

export function CacheIndicator({ state, online }: { state: CacheState; online: boolean }) {
  if (!online) {
    const title = 'Нет интернета — поездка открыта из кэша'
    return <span className="cache-indicator" title={title} role="img" aria-label={title}><Icon name="cloud-off" size={20} /></span>
  }
  if (state.kind !== 'prefetching' && state.kind !== 'blocked') return null
  const percent = cachePercent(state)
  const title = state.kind === 'blocked' ? BLOCK_TITLES[state.reason] : `Готовим поездку для оффлайна — ${percent}%`
  return (
    <span className={`cache-indicator${state.kind === 'blocked' ? ' is-blocked' : ''}`} title={title} role="img" aria-label={title}>
      <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true">
        <circle className="cache-indicator-track" cx="10" cy="10" r={RADIUS} />
        <circle className="cache-indicator-value" cx="10" cy="10" r={RADIUS} strokeDasharray={`${(CIRCUMFERENCE * percent) / 100} ${CIRCUMFERENCE}`} />
      </svg>
    </span>
  )
}
