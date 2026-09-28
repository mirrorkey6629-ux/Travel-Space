import type { ApiTripRevision } from './api'

export type LocalProtectedRevision = {
  name: string
  startDate: string
  endDate: string
  timeZone: string
  backgroundRemoved?: boolean
  cityVersions: Map<string, string>
}

export const protectedDataSignature = (source: ApiTripRevision) => JSON.stringify([
  source.name,
  source.start_date.slice(0, 10),
  source.end_date.slice(0, 10),
  source.time_zone,
  source.background_removed,
  ...source.cities.map((city) => `${city.id}:${city.updated_at}`).sort(),
])

export const hasNewerProtectedData = (remote: ApiTripRevision, local: LocalProtectedRevision) => {
  if (remote.name !== local.name || remote.start_date.slice(0, 10) !== local.startDate || remote.end_date.slice(0, 10) !== local.endDate || remote.time_zone !== local.timeZone || remote.background_removed !== Boolean(local.backgroundRemoved)) return true
  return remote.cities.some((city) => {
    const localVersion = local.cityVersions.get(city.id)
    return !localVersion || Date.parse(city.updated_at) > Date.parse(localVersion)
  })
}
