import { describe, expect, it } from 'vitest'
import { PLACE_ICON_OPTIONS, iconForGoogleTypes } from './placeIcons'

describe('PLACE_ICON_OPTIONS', () => {
  it('описывает восемь вариантов с подписями и файлами', () => {
    expect(PLACE_ICON_OPTIONS).toHaveLength(8)
    expect(PLACE_ICON_OPTIONS[0]).toEqual({ key: 'default', label: 'Базовая', file: 'place' })
    expect(PLACE_ICON_OPTIONS.every((option) => option.label && option.file)).toBe(true)
  })
})

describe('iconForGoogleTypes', () => {
  it('узнаёт заведения', () => {
    expect(iconForGoogleTypes(['restaurant'])).toBe('food')
    expect(iconForGoogleTypes(['cafe'])).toBe('cafe')
    expect(iconForGoogleTypes(['lodging'])).toBe('hotel')
    expect(iconForGoogleTypes(['shopping_mall'])).toBe('shopping')
    expect(iconForGoogleTypes(['park'])).toBe('nature')
    expect(iconForGoogleTypes(['subway_station'])).toBe('transport')
    expect(iconForGoogleTypes(['museum'])).toBe('sightseeing')
  })

  it('берёт первый распознанный тип из списка', () => {
    expect(iconForGoogleTypes(['point_of_interest', 'establishment', 'cafe'])).toBe('cafe')
  })

  it('падает в базовую иконку для незнакомого набора', () => {
    expect(iconForGoogleTypes(['establishment'])).toBe('default')
    expect(iconForGoogleTypes([])).toBe('default')
    expect(iconForGoogleTypes(undefined)).toBe('default')
  })
})
