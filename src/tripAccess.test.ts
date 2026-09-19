import { describe, expect, it } from 'vitest'
import { tripAccess } from './tripAccess'

describe('tripAccess', () => {
  it('владелец онлайн может всё', () => {
    expect(tripAccess({ publicView: false, offline: false, role: 'owner' }))
      .toEqual({ canBrowse: true, canEdit: true, canManageTrip: true })
  })

  it('участник онлайн наполняет поездку, но не управляет ею', () => {
    expect(tripAccess({ publicView: false, offline: false, role: 'member' }))
      .toEqual({ canBrowse: true, canEdit: true, canManageTrip: false })
  })

  it('оффлайн запрещает правки, но оставляет переходы внутрь поездки', () => {
    expect(tripAccess({ publicView: false, offline: true, role: 'owner' }))
      .toEqual({ canBrowse: true, canEdit: false, canManageTrip: false })
    expect(tripAccess({ publicView: false, offline: true, role: 'member' }))
      .toEqual({ canBrowse: true, canEdit: false, canManageTrip: false })
  })

  it('публичный просмотр по ссылке запрещает и переходы, и правки', () => {
    expect(tripAccess({ publicView: true, offline: false }))
      .toEqual({ canBrowse: false, canEdit: false, canManageTrip: false })
  })

  it('роль владельца в публичном просмотре ничего не открывает', () => {
    expect(tripAccess({ publicView: true, offline: false, role: 'owner' }))
      .toEqual({ canBrowse: false, canEdit: false, canManageTrip: false })
  })
})
