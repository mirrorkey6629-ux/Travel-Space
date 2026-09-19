import type { PlaceIconKey } from './placeIcons'

// Ключ дня «Без даты». Единственное место объявления: App.tsx, тултип, список
// дней и карта обязаны сравнивать даты с одним и тем же значением.
export const UNSCHEDULED_KEY = 'unscheduled'

export type PlaceDraft = { name: string; icon: PlaceIconKey; date: string }
