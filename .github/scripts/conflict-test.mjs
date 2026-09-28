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
console.log('Two-session conflict protection passed.')
