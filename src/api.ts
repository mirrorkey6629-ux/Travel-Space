// Базовый URL API выводится из vite base, а не задаётся отдельной константой:
// иначе префикс приложения пришлось бы менять в двух местах.
const API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api`
const TOKEN_KEY = 'travel-api-token'

export type ApiRole = 'owner' | 'member'

export type ApiTripSummary = {
  id: string
  name: string
  start_date: string
  end_date: string
  role: ApiRole
  background_removed?: boolean
  background_document_id?: string | null
}

export type ApiCity = {
  id: string
  trip_id: string
  name: string
  position: number
  arrival_date: string
  departure_date: string
  arrival_period: 'morning' | 'day' | 'evening'
  departure_period: 'morning' | 'day' | 'evening'
  hotel_not_needed: boolean
  hotel: string
  hotel_url: string
  hotel_check_in_time: string
  hotel_check_out_time: string
  hotel_notes: string
  train_in: string
  train_out: string
  transport_in_type: TransportType | null
  transport_out_type: TransportType | null
  transport_in_departure_time: string
  transport_in_arrival_time: string
  transport_out_departure_time: string
  transport_out_arrival_time: string
  transport_in_departure_station: string
  transport_in_departure_station_url: string
  transport_in_arrival_station: string
  transport_in_arrival_station_url: string
  transport_out_departure_station: string
  transport_out_departure_station_url: string
  transport_out_arrival_station: string
  transport_out_arrival_station_url: string
  transport_in_notes: string
  transport_out_notes: string
  transport_in_ticket_on_site: boolean
  transport_out_ticket_on_site: boolean
}

export type TransportType = 'train' | 'plane' | 'bus' | 'ship'

export type ApiPlace = {
  id: string
  city_id: string
  visit_date: string | null
  name: string
  google_maps_url: string
  latitude: number | null
  longitude: number | null
  position: number
}

export type ApiTask = {
  id: string
  city_id: string | null
  title: string
  done: boolean
}

export type ApiDayNote = {
  trip_id: string
  day_date: string
  description: string
}

export type ApiDocument = {
  id: string
  city_id: string | null
  category: string
  original_name: string
  created_by: string
  created_by_name: string
  created_at: string
}

export type ApiMember = {
  id: string
  email: string
  display_name: string
  role: ApiRole
  joined_at: string
  has_avatar: boolean
}

export type ApiTripDetails = ApiTripSummary & {
  owner_id: string
  cities: ApiCity[]
  places: ApiPlace[]
  tasks: ApiTask[]
  day_notes: ApiDayNote[]
  documents: ApiDocument[]
  members: ApiMember[]
}

export const session = {
  get token() { return localStorage.getItem(TOKEN_KEY) ?? '' },
  set token(value: string) { value ? localStorage.setItem(TOKEN_KEY, value) : localStorage.removeItem(TOKEN_KEY) },
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (session.token) headers.set('Authorization', `Bearer ${session.token}`)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(payload.error || `Ошибка сервера (${response.status})`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

async function checkedResponse(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (session.token) headers.set('Authorization', `Bearer ${session.token}`)
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(payload.error || `Ошибка сервера (${response.status})`)
  }
  return response
}

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) })

export const api = {
  register: (email: string, password: string, displayName: string) => request<{ token: string }>('/auth/register', json('POST', { email, password, displayName })),
  login: (email: string, password: string) => request<{ token: string }>('/auth/login', json('POST', { email, password })),
  me: () => request<{ user: { id: string; email: string; displayName: string; hasAvatar: boolean } }>('/me'),
  updateProfile: (value: { displayName: string; email: string; password?: string }) => request<{ user: { id: string; email: string; displayName: string; hasAvatar: boolean } }>('/me', json('PATCH', value)),
  uploadAvatar: (file: File) => { const form = new FormData(); form.append('file', file); return request<{ ok: true }>('/me/avatar', { method: 'POST', body: form }) },
  downloadAvatar: () => checkedResponse('/me/avatar').then((response) => response.blob()),
  trips: () => request<{ trips: ApiTripSummary[] }>('/trips'),
  trip: (id: string) => request<{ trip: ApiTripDetails }>(`/trips/${id}`),
  createTrip: (value: { name: string; startDate: string; endDate: string; backgroundRemoved?: boolean }) => request<{ trip: ApiTripSummary }>('/trips', json('POST', value)),
  updateTrip: (id: string, value: { name: string; startDate: string; endDate: string; backgroundRemoved?: boolean }) => request<{ trip: ApiTripSummary }>(`/trips/${id}`, json('PATCH', value)),
  deleteTrip: (id: string, confirmation: string) => request<void>(`/trips/${id}`, json('DELETE', { confirmation })),
  createInvitation: (id: string, expiresInHours: number) => request<{ invitation: { id: string; url: string; expiresAt: string } }>(`/trips/${id}/invitations`, json('POST', { expiresInHours })),
  removeMember: (tripId: string, memberId: string) => request<void>(`/trips/${tripId}/members/${memberId}`, { method: 'DELETE' }),
  downloadMemberAvatar: (tripId: string, memberId: string) => checkedResponse(`/trips/${tripId}/members/${memberId}/avatar`).then((response) => response.blob()),
  exportTrip: async (tripId: string) => {
    const response = await checkedResponse(`/trips/${tripId}/export`)
    return response.blob()
  },
  importTrip: async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<{ trip: ApiTripSummary }>('/trips/import', { method: 'POST', body: form })
  },
  createCity: (tripId: string, value: Record<string, unknown>) => request<{ city: ApiCity }>(`/trips/${tripId}/cities`, json('POST', value)),
  updateCity: (tripId: string, cityId: string, value: Record<string, unknown>) => request<{ city: ApiCity }>(`/trips/${tripId}/cities/${cityId}`, json('PATCH', value)),
  deleteCity: (tripId: string, cityId: string) => request<void>(`/trips/${tripId}/cities/${cityId}`, { method: 'DELETE' }),
  createPlace: (tripId: string, cityId: string, value: { name: string; googleMapsUrl: string; visitDate?: string; latitude?: number; longitude?: number }) => request<{ place: ApiPlace }>(`/trips/${tripId}/cities/${cityId}/places`, json('POST', value)),
  updatePlace: (tripId: string, placeId: string, value: { name?: string; googleMapsUrl?: string; visitDate?: string; latitude?: number; longitude?: number }) => request<{ place: ApiPlace }>(`/trips/${tripId}/places/${placeId}`, json('PATCH', value)),
  updateDayDescription: (tripId: string, date: string, description: string) => request<{ note: ApiDayNote | null }>(`/trips/${tripId}/days/${date}`, json('PUT', { description })),
  createTask: (tripId: string, value: { cityId?: string; dueDate?: string; title: string }) => request<{ task: ApiTask }>(`/trips/${tripId}/tasks`, json('POST', value)),
  uploadDocument: async (tripId: string, cityId: string | undefined, category: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const query = new URLSearchParams({ tripId, category })
    if (cityId) query.set('cityId', cityId)
    return request<{ document: ApiDocument }>(`/documents?${query}`, { method: 'POST', body: form })
  },
  downloadDocument: (documentId: string) => checkedResponse(`/documents/${documentId}/download`).then((response) => response.blob()),
  deleteDocument: (documentId: string) => request<void>(`/documents/${documentId}`, { method: 'DELETE' }),
  acceptInvitation: (token: string) => request<{ tripId: string }>(`/invitations/${token}/accept`, { method: 'POST' }),
}
