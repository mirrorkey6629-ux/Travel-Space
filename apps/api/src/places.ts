export const PLACE_ICONS = ['default', 'sightseeing', 'food', 'cafe', 'hotel', 'shopping', 'nature', 'transport'] as const

export type PlaceIcon = (typeof PLACE_ICONS)[number]

// Отсутствие значения — это не ошибка, а базовая иконка. Неизвестная строка —
// ошибка, поэтому у неё отдельный результат, который вызывающий код превращает в 400.
export function normalizePlaceIcon(value: unknown): PlaceIcon | undefined {
  if (value === undefined || value === null || value === '') return 'default'
  return PLACE_ICONS.includes(value as PlaceIcon) ? (value as PlaceIcon) : undefined
}
