export const PLACE_ICONS = ['default', 'sightseeing', 'entertainment', 'food', 'cafe', 'hotel', 'shopping', 'nature', 'transport'] as const

export type PlaceIcon = (typeof PLACE_ICONS)[number]

// Отсутствие значения — это не ошибка, а базовая иконка. Неизвестная строка —
// ошибка, поэтому у неё отдельный результат, который вызывающий код превращает в 400.
export function normalizePlaceIcon(value: unknown): PlaceIcon | undefined {
  if (value === undefined || value === null || value === '') return 'default'
  return PLACE_ICONS.includes(value as PlaceIcon) ? (value as PlaceIcon) : undefined
}

export function normalizeGoogleMapsUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  try {
    const url = new URL(value.trim())
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '')
    url.hash = ''
    url.pathname = url.pathname.replace(/\/+$/, '') || '/'
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith('utm_') || ['entry', 'g_st', 'source'].includes(key)) url.searchParams.delete(key)
    }
    url.searchParams.sort()
    return `${url.hostname}${url.pathname}${url.search}`
  } catch {
    return value.trim().replace(/\/+$/, '').toLocaleLowerCase()
  }
}

export function hasDuplicatePlaceUrl(rows: readonly { id?: string; google_maps_url: string }[], url: string, excludeId?: string): boolean {
  const key = normalizeGoogleMapsUrl(url)
  return Boolean(key) && rows.some((row) => row.id !== excludeId && normalizeGoogleMapsUrl(row.google_maps_url) === key)
}

export type OrderedPlace = { id: string; visit_date: string | null; position: number }

// Ключ дня: null и пустая строка должны схлопываться в одно ведро «без даты»,
// поэтому сравниваем не сами значения, а нормализованный ключ.
const dayKey = (value: string | null) => value ?? ''

/**
 * Возвращает новые значения visit_date и position для точек тех дней, которых
 * коснулся перенос. Дни, не участвующие в переносе, не возвращаются — их незачем
 * переписывать в базе.
 */
export function reorderPlaces<T extends OrderedPlace>(
  places: readonly T[],
  placeId: string,
  targetDate: string | null,
  targetPosition: number,
): OrderedPlace[] {
  const moved = places.find((place) => place.id === placeId)
  if (!moved) throw new Error(`Точка ${placeId} не найдена среди мест города`)

  const sourceKey = dayKey(moved.visit_date)
  const targetKey = dayKey(targetDate)

  const bucket = (key: string) =>
    places
      .filter((place) => dayKey(place.visit_date) === key)
      // id как вторичный ключ сортировки: позиции в базе могут дублироваться,
      // и без него порядок оказался бы недетерминированным.
      .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id))
      .map((place) => place.id)

  const source = bucket(sourceKey)
  const target = sourceKey === targetKey ? source : bucket(targetKey)

  source.splice(source.indexOf(placeId), 1)
  target.splice(Math.max(0, Math.min(targetPosition, target.length)), 0, placeId)

  const renumber = (ids: string[], date: string | null) =>
    ids.map((id, index) => ({ id, visit_date: date, position: index }))

  return sourceKey === targetKey
    ? renumber(target, targetDate)
    : [...renumber(source, moved.visit_date), ...renumber(target, targetDate)]
}
