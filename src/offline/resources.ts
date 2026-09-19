import type { ApiTripDetails, ApiTripSummary } from '../api'

// Категории документов, которые видны на экране сразу. Они качаются первыми,
// чтобы поездка выглядела целой раньше, чем докачаются PDF билетов.
const IMAGE_CATEGORIES = new Set(['trip-background', 'city-image'])

/**
 * Статика, которую не кладём в precache: `autumn-garden.jpg` весит 5.4 МБ и
 * растянул бы установку приложения. Забирается фоновой докачкой.
 */
export const STATIC_OFFLINE_ASSETS = [
  'assets/autumn-garden.jpg',
  'assets/city-placeholder.png',
  'assets/hotel-placeholder.png',
  'assets/ticket-placeholder.png',
  'assets/person-default.png',
  'assets/person-member.png',
  'assets/person-owner.png',
]

const unique = (urls: string[]) => [...new Set(urls)]

/**
 * Полный список того, что нужно поездке оффлайн.
 *
 * Список строит клиент, а не service worker: клиент и так разбирает
 * `ApiTripDetails`, поэтому знание о форме API остаётся в одном месте, а SW
 * остаётся простым загрузчиком.
 *
 * `base` передаётся параметром, а не читается из `import.meta.env`, чтобы
 * функция оставалась чистой и проверялась в node-окружении vitest.
 */
export function tripResourceUrls({ trip, base, hasOwnAvatar, publicToken }: {
  trip: ApiTripDetails
  base: string
  hasOwnAvatar: boolean
  publicToken?: string
}): string[] {
  const api = `${base}api`
  const token = publicToken ? encodeURIComponent(publicToken) : ''
  const documentUrl = (id: string) => publicToken ? `${api}/public-trips/${token}/documents/${id}` : `${api}/documents/${id}/download`
  const images = trip.documents.filter((item) => IMAGE_CATEGORIES.has(item.category))
  const rest = trip.documents.filter((item) => !IMAGE_CATEGORIES.has(item.category))
  return unique([
    ...STATIC_OFFLINE_ASSETS.map((path) => `${base}${path}`),
    // JSON поездки входит в докачку намеренно: на первой загрузке страница ещё
    // не под управлением SW, и обычный перехват fetch её не увидит.
    publicToken ? `${api}/public-trips/${token}` : `${api}/trips/${trip.id}`,
    ...images.map((item) => documentUrl(item.id)),
    ...(publicToken ? [] : trip.members.filter((item) => item.has_avatar).map((item) => `${api}/trips/${trip.id}/members/${item.id}/avatar`)),
    ...(!publicToken && hasOwnAvatar ? [`${api}/me/avatar`] : []),
    ...rest.map((item) => documentUrl(item.id)),
  ])
}

/** Фоны для экрана списка поездок — без них список оффлайн выглядит пустым. */
export function tripsListResourceUrls(trips: ApiTripSummary[], base: string): string[] {
  const api = `${base}api`
  return unique([
    `${api}/trips`,
    `${api}/me`,
    ...trips
      .filter((trip) => trip.background_document_id && !trip.background_removed)
      .map((trip) => `${api}/documents/${trip.background_document_id}/download`),
  ])
}
