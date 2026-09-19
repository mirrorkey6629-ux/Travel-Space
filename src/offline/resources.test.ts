import { describe, expect, it } from 'vitest'
import type { ApiDocument, ApiMember, ApiTripDetails, ApiTripSummary } from '../api'
import { STATIC_OFFLINE_ASSETS, tripResourceUrls, tripsListResourceUrls } from './resources'

const base = '/travel/'

const document = (id: string, category: string): ApiDocument =>
  ({ id, city_id: null, category, original_name: `${id}.pdf`, created_by: 'u', created_by_name: 'U', created_at: '2026-09-19' })

const member = (id: string, hasAvatar: boolean): ApiMember =>
  ({ id, email: `${id}@example.com`, display_name: id, role: 'member', joined_at: '2026-09-19', has_avatar: hasAvatar })

const trip = {
  id: 'trip-1',
  documents: [document('doc-ticket', 'train-in:city-1'), document('doc-bg', 'trip-background'), document('doc-city', 'city-image')],
  members: [member('m-1', true), member('m-2', false)],
} as unknown as ApiTripDetails

describe('tripResourceUrls', () => {
  it('ставит картинки раньше тяжёлых документов', () => {
    const urls = tripResourceUrls({ trip, base, hasOwnAvatar: true })
    const background = urls.indexOf('/travel/api/documents/doc-bg/download')
    const cityImage = urls.indexOf('/travel/api/documents/doc-city/download')
    const ticket = urls.indexOf('/travel/api/documents/doc-ticket/download')
    expect(background).toBeGreaterThan(-1)
    expect(cityImage).toBeLessThan(ticket)
    expect(background).toBeLessThan(ticket)
  })

  it('включает JSON поездки, статику и аватары только тех, у кого они есть', () => {
    const urls = tripResourceUrls({ trip, base, hasOwnAvatar: true })
    expect(urls).toContain('/travel/api/trips/trip-1')
    expect(urls).toContain('/travel/assets/autumn-garden.jpg')
    expect(urls).toContain('/travel/api/trips/trip-1/members/m-1/avatar')
    expect(urls).not.toContain('/travel/api/trips/trip-1/members/m-2/avatar')
    expect(urls).toContain('/travel/api/me/avatar')
  })

  it('не просит свой аватар, когда его нет', () => {
    expect(tripResourceUrls({ trip, base, hasOwnAvatar: false })).not.toContain('/travel/api/me/avatar')
  })

  it('в публичном режиме ходит по токену и не трогает приватные эндпоинты', () => {
    const urls = tripResourceUrls({ trip, base, hasOwnAvatar: true, publicToken: 'tok en' })
    expect(urls).toContain('/travel/api/public-trips/tok%20en')
    expect(urls).toContain('/travel/api/public-trips/tok%20en/documents/doc-bg')
    expect(urls.some((url) => url.includes('/members/'))).toBe(false)
    expect(urls).not.toContain('/travel/api/me/avatar')
  })

  it('не повторяет один URL дважды', () => {
    const urls = tripResourceUrls({ trip, base, hasOwnAvatar: true })
    expect(new Set(urls).size).toBe(urls.length)
    expect(STATIC_OFFLINE_ASSETS.length).toBeGreaterThan(0)
  })
})

describe('tripsListResourceUrls', () => {
  const summary = (id: string, backgroundId: string | null, removed = false): ApiTripSummary =>
    ({ id, name: id, start_date: '2026-09-19', end_date: '2026-09-20', time_zone: 'UTC', role: 'owner', background_document_id: backgroundId, background_removed: removed })

  it('берёт фоны поездок и пропускает снятые', () => {
    const urls = tripsListResourceUrls([summary('a', 'bg-a'), summary('b', null), summary('c', 'bg-c', true)], base)
    expect(urls).toContain('/travel/api/trips')
    expect(urls).toContain('/travel/api/documents/bg-a/download')
    expect(urls).not.toContain('/travel/api/documents/bg-c/download')
  })
})
