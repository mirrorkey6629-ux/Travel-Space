import { describe, expect, it } from 'vitest'
import { PLACE_ICONS, normalizePlaceIcon } from './places.js'

describe('normalizePlaceIcon', () => {
  it('содержит ровно восемь ключей', () => {
    expect(PLACE_ICONS).toEqual(['default', 'sightseeing', 'food', 'cafe', 'hotel', 'shopping', 'nature', 'transport'])
  })

  it('пропускает известный ключ', () => {
    expect(normalizePlaceIcon('food')).toBe('food')
  })

  it('подставляет default, когда значение не передано', () => {
    expect(normalizePlaceIcon(undefined)).toBe('default')
    expect(normalizePlaceIcon('')).toBe('default')
    expect(normalizePlaceIcon(null)).toBe('default')
  })

  it('возвращает undefined для неизвестного ключа', () => {
    expect(normalizePlaceIcon('casino')).toBeUndefined()
    expect(normalizePlaceIcon(42)).toBeUndefined()
  })
})
