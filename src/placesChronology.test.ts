import { describe, expect, it } from 'vitest'
import { chronologicalDayPlaces } from './places'

describe('chronologicalDayPlaces', () => {
  it('ставит приезд до отеля и мест, а отъезд — после них', () => {
    expect(chronologicalDayPlaces(['музей', 'парк'], 'вокзал: приезд', 'отель', 'вокзал: отъезд')).toEqual([
      'вокзал: приезд',
      'отель',
      'музей',
      'парк',
      'вокзал: отъезд',
    ])
  })

  it('не создаёт пустых слотов, если события нет', () => {
    expect(chronologicalDayPlaces(['музей'])).toEqual(['музей'])
  })
})
