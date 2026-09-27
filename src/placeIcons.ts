export type PlaceIconKey = 'default' | 'sightseeing' | 'entertainment' | 'food' | 'cafe' | 'hotel' | 'shopping' | 'nature' | 'transport'

export type PlaceIconOption = { key: PlaceIconKey; label: string; file: string }

// Порядок задаёт порядок кнопок в тултипе, поэтому базовая идёт первой.
export const PLACE_ICON_OPTIONS: PlaceIconOption[] = [
  { key: 'default', label: 'Общая', file: 'pin' },
  { key: 'sightseeing', label: 'Историческое', file: 'foundation' },
  { key: 'entertainment', label: 'Развлечения', file: 'attractions' },
  { key: 'food', label: 'Поесть', file: 'soup-kitchen' },
  { key: 'cafe', label: 'Кофейня', file: 'local-cafe' },
  { key: 'shopping', label: 'Шопинг', file: 'shopping-bag' },
  { key: 'nature', label: 'Природа', file: 'cannabis' },
  { key: 'transport', label: 'Транспорт', file: 'train' },
]

const iconFiles = new Map<PlaceIconKey, string>([
  ...PLACE_ICON_OPTIONS.map((option) => [option.key, option.file] as const),
  ['hotel', 'pin-home'],
])
const PLACE_ICON_ASSET_VERSION = '20260927-8'

export const placeIconFile = (key: PlaceIconKey) => iconFiles.get(key) ?? 'pin'

export const placeIconUrl = (key: PlaceIconKey) => `${import.meta.env.BASE_URL}assets/icons/${placeIconFile(key)}.svg?v=${PLACE_ICON_ASSET_VERSION}`

export const managedPlaceIconUrl = (key: 'hotel' | 'transport') => `${import.meta.env.BASE_URL}assets/icons/${key === 'hotel' ? 'pin-home' : 'pin-transport'}.svg?v=${PLACE_ICON_ASSET_VERSION}`

const googleTypeIcons: Record<string, PlaceIconKey> = {
  restaurant: 'food', meal_takeaway: 'food', meal_delivery: 'food', bakery: 'food',
  cafe: 'cafe', coffee_shop: 'cafe', bar: 'cafe',
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
