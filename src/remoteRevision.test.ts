import { describe, expect, it } from 'vitest'
import { hasDifferentProtectedData, protectedDataSignature, type ProtectedTripState } from './remoteRevision'

const trip = (hotel = '123'): ProtectedTripState => ({
  name: 'Токио',
  startDate: '2026-10-01',
  endDate: '2026-10-10',
  timeZone: 'Asia/Tokyo',
  backgroundRemoved: false,
  cities: [{ id: 'city-1', updatedAt: 'version-1', name: 'Токио', hotel, places: {}, files: [] }],
})

describe('protected data comparison', () => {
  it('замечает реальное расхождение полей отеля', () => {
    expect(hasDifferentProtectedData(trip('123'), trip('12345678'))).toBe(true)
  })

  it('не считает разные версии и незащищённый контент расхождением формы', () => {
    const remote = trip()
    remote.cities[0].updatedAt = 'version-2'
    remote.cities[0].places = { day: [{ id: 'place-1' }] }
    expect(hasDifferentProtectedData(remote, trip())).toBe(false)
  })

  it('даёт одинаковую подпись для одинаковых защищённых данных', () => {
    expect(protectedDataSignature(trip())).toBe(protectedDataSignature(trip()))
  })
})
