export type PlaceIconKey = 'default' | 'sightseeing' | 'food' | 'cafe' | 'hotel' | 'shopping' | 'nature' | 'transport'

export type PlaceIconOption = { key: PlaceIconKey; label: string; file: string }

// Порядок задаёт порядок кнопок в тултипе, поэтому базовая идёт первой.
export const PLACE_ICON_OPTIONS: PlaceIconOption[] = [
  { key: 'default', label: 'Базовая', file: 'place' },
  { key: 'sightseeing', label: 'Посмотреть', file: 'attractions' },
  { key: 'food', label: 'Поесть', file: 'restaurant' },
  { key: 'cafe', label: 'Кофе', file: 'local-cafe' },
  { key: 'hotel', label: 'Отель', file: 'hotel' },
  { key: 'shopping', label: 'Шопинг', file: 'shopping-bag' },
  { key: 'nature', label: 'Природа', file: 'park' },
  { key: 'transport', label: 'Транспорт', file: 'directions-transit' },
]

const iconFiles = new Map(PLACE_ICON_OPTIONS.map((option) => [option.key, option.file]))

export const placeIconFile = (key: PlaceIconKey) => iconFiles.get(key) ?? 'place'

export const placeIconUrl = (key: PlaceIconKey) => `${import.meta.env.BASE_URL}assets/icons/${placeIconFile(key)}.svg`

const googleTypeIcons: Record<string, PlaceIconKey> = {
  restaurant: 'food', meal_takeaway: 'food', meal_delivery: 'food', bakery: 'food',
  cafe: 'cafe', coffee_shop: 'cafe', bar: 'cafe',
  lodging: 'hotel', hotel: 'hotel', guest_house: 'hotel',
  store: 'shopping', shopping_mall: 'shopping', department_store: 'shopping', supermarket: 'shopping',
  park: 'nature', natural_feature: 'nature', campground: 'nature', beach: 'nature',
  train_station: 'transport', subway_station: 'transport', bus_station: 'transport',
  airport: 'transport', transit_station: 'transport', light_rail_station: 'transport',
  tourist_attraction: 'sightseeing', museum: 'sightseeing', art_gallery: 'sightseeing',
  church: 'sightseeing', place_of_worship: 'sightseeing', zoo: 'sightseeing', aquarium: 'sightseeing',
}

// Google отдаёт типы от частного к общему, поэтому берём первое совпадение:
// у кафе список выглядит как ['cafe','food','point_of_interest','establishment'].
export function iconForGoogleTypes(types: readonly string[] | undefined): PlaceIconKey {
  for (const type of types ?? []) {
    const icon = googleTypeIcons[type]
    if (icon) return icon
  }
  return 'default'
}
