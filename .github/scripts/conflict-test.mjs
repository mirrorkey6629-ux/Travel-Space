const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000/travel'

async function call(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = await response.json().catch(() => ({}))
  return { status: response.status, payload }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const email = `conflict-${Date.now()}@smoke.local`
const password = 'smoke-password-123'
const registered = await call('/auth/register', { method: 'POST', body: { email, password, displayName: 'Smoke owner' } })
assert(registered.status === 201, `registration returned ${registered.status}`)
const firstToken = registered.payload.token
const loggedIn = await call('/auth/login', { method: 'POST', body: { email, password } })
assert(loggedIn.status === 200, `second login returned ${loggedIn.status}`)
const secondToken = loggedIn.payload.token

const createdTrip = await call('/trips', {
  method: 'POST',
  token: firstToken,
  body: { name: 'Conflict smoke', startDate: '2026-10-01', endDate: '2026-10-10', timeZone: 'UTC' },
})
assert(createdTrip.status === 201, `trip creation returned ${createdTrip.status}`)
const tripId = createdTrip.payload.trip.id
const createdCity = await call(`/trips/${tripId}/cities`, {
  method: 'POST',
  token: firstToken,
  body: { name: 'Tokyo', arrivalDate: '2026-10-01', departureDate: '2026-10-10', arrivalPeriod: 'morning', departurePeriod: 'evening' },
})
assert(createdCity.status === 201, `city creation returned ${createdCity.status}`)
const cityId = createdCity.payload.city.id

const firstSnapshot = await call(`/trips/${tripId}`, { token: firstToken })
const secondSnapshot = await call(`/trips/${tripId}`, { token: secondToken })
const firstVersion = firstSnapshot.payload.trip.cities[0].updated_at
const staleVersion = secondSnapshot.payload.trip.cities[0].updated_at
assert(firstVersion === staleVersion, 'sessions did not start from the same city version')

const firstSave = await call(`/trips/${tripId}/cities/${cityId}`, {
  method: 'PATCH', token: firstToken, body: { hotel: '123', expectedUpdatedAt: firstVersion },
})
assert(firstSave.status === 200, `first save returned ${firstSave.status}`)
const staleSave = await call(`/trips/${tripId}/cities/${cityId}`, {
  method: 'PATCH', token: secondToken, body: { hotel: '12345678', expectedUpdatedAt: staleVersion },
})
assert(staleSave.status === 409, `stale save returned ${staleSave.status}, expected 409`)
const versionlessSave = await call(`/trips/${tripId}/cities/${cityId}`, {
  method: 'PATCH', token: secondToken, body: { hotel: 'must-not-save' },
})
assert(versionlessSave.status === 409, `versionless save returned ${versionlessSave.status}, expected 409`)

const finalState = await call(`/trips/${tripId}`, { token: firstToken })
assert(finalState.payload.trip.cities[0].hotel === '123', `stale data reached the database: ${finalState.payload.trip.cities[0].hotel}`)
assert(finalState.payload.trip.last_change?.actor_name === 'Smoke owner', 'latest change has no actor name')
assert(finalState.payload.trip.last_change?.city_name === 'Tokyo', 'latest change has no city name')
assert(finalState.payload.trip.last_change?.sections?.includes('hotel'), 'latest change does not identify the hotel section')

const memberEmail = `member-${Date.now()}@smoke.local`
const memberRegistration = await call('/auth/register', { method: 'POST', body: { email: memberEmail, password, displayName: 'Smoke member' } })
assert(memberRegistration.status === 201, `member registration returned ${memberRegistration.status}`)
const invitation = await call(`/trips/${tripId}/invitations`, { method: 'POST', token: firstToken, body: { expiresInHours: 1 } })
assert(invitation.status === 201, `invitation returned ${invitation.status}`)
const invitationToken = invitation.payload.invitation.url.split('/join/').at(-1)
const accepted = await call(`/invitations/${invitationToken}/accept`, { method: 'POST', token: memberRegistration.payload.token })
assert(accepted.status === 200, `invitation acceptance returned ${accepted.status}`)
const memberSnapshot = await call(`/trips/${tripId}`, { token: memberRegistration.payload.token })
const memberId = memberSnapshot.payload.trip.members.find((member) => member.display_name === 'Smoke member')?.id
assert(memberId, 'accepted member is missing from the trip')
const memberSave = await call(`/trips/${tripId}/cities/${cityId}`, {
  method: 'PATCH', token: memberRegistration.payload.token, body: { hotel: 'Member hotel', expectedUpdatedAt: memberSnapshot.payload.trip.cities[0].updated_at },
})
assert(memberSave.status === 200, `member hotel save returned ${memberSave.status}`)
const memberTransportSave = await call(`/trips/${tripId}/cities/${cityId}`, {
  method: 'PATCH',
  token: memberRegistration.payload.token,
  body: {
    name: 'Tokyo',
    arrivalDate: '2026-10-01',
    departureDate: '2026-10-10',
    arrivalPeriod: 'morning',
    departurePeriod: 'evening',
    transportOutName: 'Member train',
    transportOutDepartureDate: '',
    transportOutArrivalDate: '',
    ticketAssigneeIds: [],
    hotelAssigneeIds: [],
    planAssigneeIds: [],
    expectedUpdatedAt: memberSave.payload.city.updated_at,
  },
})
assert(memberTransportSave.status === 200, `member transport save returned ${memberTransportSave.status}`)
const memberRouteSave = await call(`/trips/${tripId}/cities/${cityId}`, {
  method: 'PATCH', token: memberRegistration.payload.token, body: { name: 'Forbidden city rename', expectedUpdatedAt: memberTransportSave.payload.city.updated_at },
})
assert(memberRouteSave.status === 403, `member route change returned ${memberRouteSave.status}, expected 403`)
const memberTransportDateSave = await call(`/trips/${tripId}/cities/${cityId}`, {
  method: 'PATCH', token: memberRegistration.payload.token, body: { transportOutDepartureDate: '2026-10-09', expectedUpdatedAt: memberTransportSave.payload.city.updated_at },
})
assert(memberTransportDateSave.status === 403, `member transport date change returned ${memberTransportDateSave.status}, expected 403`)
const memberAssigneeSave = await call(`/trips/${tripId}/cities/${cityId}`, {
  method: 'PATCH', token: memberRegistration.payload.token, body: { ticketAssigneeIds: [memberId], expectedUpdatedAt: memberTransportSave.payload.city.updated_at },
})
assert(memberAssigneeSave.status === 403, `member assignee change returned ${memberAssigneeSave.status}, expected 403`)
const afterMemberSave = await call(`/trips/${tripId}`, { token: firstToken })
assert(afterMemberSave.payload.trip.cities[0].hotel === 'Member hotel', 'member hotel change was not saved')
assert(afterMemberSave.payload.trip.cities[0].transport_out_name === 'Member train', 'member transport change was not saved')
assert(afterMemberSave.payload.trip.cities[0].name === 'Tokyo', 'member changed the protected route')
assert(!afterMemberSave.payload.trip.cities[0].transport_out_departure_date, 'member changed a protected transport date')
assert(afterMemberSave.payload.trip.last_change?.actor_name === 'Smoke member', 'member change has the wrong actor')
assert(afterMemberSave.payload.trip.last_change?.sections?.includes('transport-out'), 'member change does not identify the transport section')

const tripSave = await call(`/trips/${tripId}`, {
  method: 'PATCH',
  token: firstToken,
  body: {
    name: 'Conflict smoke updated',
    startDate: '2026-10-01',
    endDate: '2026-10-10',
    timeZone: 'UTC',
    expectedUpdatedAt: afterMemberSave.payload.trip.updated_at,
  },
})
assert(tripSave.status === 200, `trip save returned ${tripSave.status}`)
const tripChangeState = await call(`/trips/${tripId}`, { token: firstToken })
assert(tripChangeState.payload.trip.last_change?.sections?.includes('trip'), 'latest change does not identify trip settings')
console.log('Two-session conflict protection passed.')
