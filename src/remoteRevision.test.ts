import { describe, expect, it } from 'vitest'
import type { ApiTripRevision } from './api'
import { hasNewerProtectedData, protectedDataSignature } from './remoteRevision'

const revision = (patch: Partial<ApiTripRevision> = {}): ApiTripRevision => ({
  id: 'trip-1',
  name: 'Токио',
  start_date: '2026-10-01',
  end_date: '2026-10-10',
  time_zone: 'Asia/Tokyo',
  background_removed: false,
  updated_at: '2026-09-28T06:00:01.000Z',
  cities: [{ id: 'city-1', updated_at: '2026-09-28T06:00:00.000Z' }],
  ...patch,
})

const local = (cityVersion = '2026-09-28T06:00:00.000Z') => ({
  name: 'Токио',
  startDate: '2026-10-01',
  endDate: '2026-10-10',
  timeZone: 'Asia/Tokyo',
  backgroundRemoved: false,
  cityVersions: new Map([['city-1', cityVersion]]),
})

describe('remote revision', () => {
  it('не считает собственную уже известную правку новыми данными', () => {
    expect(hasNewerProtectedData(revision(), local())).toBe(false)
  })

  it('замечает более новую версию города и правку поездки', () => {
    expect(hasNewerProtectedData(revision(), local('2026-09-28T05:59:59.000Z'))).toBe(true)
    expect(hasNewerProtectedData(revision({ name: 'Киото' }), local())).toBe(true)
  })

  it('включает в подпись версии городов', () => {
    expect(protectedDataSignature(revision())).not.toBe(protectedDataSignature(revision({ cities: [{ id: 'city-1', updated_at: '2026-09-28T06:00:02.000Z' }] })))
  })
})
