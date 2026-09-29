import { CSSProperties, FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ACCESS_DENIED_EVENT, api, ApiRequestError, ApiTripChange, ApiTripDetails, ApiTripSummary, isConflictError, session, TransportType } from './api'
import { Button, IconButton } from './components/Button'
import { AddRow } from './components/AddRow'
import { DateInput, Input, Select, Textarea, TimeZoneInput } from './components/FormControls'
import { InfoRow } from './components/InfoRow'
import { InfoRowList } from './components/InfoRowList'
import { TypographyGroup } from './components/TypographyGroup'
import { UpdateNotification } from './components/UpdateNotification'
import { ErrorNotification } from './components/ErrorNotification'
import { SuccessNotification } from './components/SuccessNotification'
import { Icon, type IconName } from './components/Icon'
import { UNSCHEDULED_KEY } from './places'
import { PlacesMap } from './components/PlacesMap'
import { PlaceDayList } from './components/PlaceDayList'
import { managedPlaceIconUrl, placeIconUrl, type PlaceIconKey } from './placeIcons'
import { CacheIndicator } from './components/CacheIndicator'
import { CheckboxTextRow, TextRow } from './components/TextRow'
import { ItemList } from './components/ItemList'
import { FormControlList, FormControlRow } from './components/FormControlList'
import { TextareaList } from './components/TextareaList'
import { FormPanelGroup, FormPanelHeader, FormPanelLayout, FormPanelNote } from './components/FormPanel'
import { FilePicker, ImageFilePicker } from './components/ImageFilePicker'
import { Avatar } from './components/Avatar'
import { AuthPanel } from './components/AuthPanel'
import { tripResourceUrls, tripsListResourceUrls } from './offline/resources'
import { clearPrivateCaches, keepStorage, requestPrefetch, useOfflineCache } from './offline/useOfflineCache'
import type { CacheState } from './offline/cacheState'
import { AccessContext, tripAccess, useAccess } from './tripAccess'
import { hasDifferentProtectedData } from './remoteRevision'

type Place = { id: string; name: string; url: string; icon: PlaceIconKey; notes: string; latitude?: number; longitude?: number }
type TravelFile = { id: string; name: string; category: string; uploadedBy?: string; uploadedAt?: string }
type HotelDetails = { name: string; url: string; checkInTime: string; checkOutTime: string; notes: string; payerIds: string[]; totalAmountRubles: number }
type TransportDetails = { type?: TransportType; name: string; departureDate: string; arrivalDate: string; departureTime: string; arrivalTime: string; departureTimeZone: string; arrivalTimeZone: string; departureStation: string; departureStationUrl: string; arrivalStation: string; arrivalStationUrl: string; notes: string; ticketOnSite: boolean; payerIds: string[]; totalAmountRubles: number }
type TripMember = { id: string; email: string; displayName: string; role: 'owner' | 'member'; hasAvatar?: boolean; avatarUrl?: string }
type CurrentUser = { id: string; email: string; displayName: string; hasAvatar: boolean; avatarUrl?: string }
type DayPeriod = 'morning' | 'day' | 'evening'
type ErrorNotice = { title: string; message: string; retry?: () => void; retryLabel?: string; actionIcon?: 'retry' | 'refresh'; closable?: boolean }
type City = {
  id: string
  updatedAt?: string
  name: string
  googleMapsUrl: string
  arrival: string
  departure: string
  arrivalPeriod?: DayPeriod
  departurePeriod?: DayPeriod
  hotelNotNeeded: boolean
  hotel: string
  hotelUrl: string
  hotelCheckInTime: string
  hotelCheckOutTime: string
  hotelNotes: string
  hotelPayerIds: string[]
  hotelTotalAmountRubles: number
  trainIn: string
  trainOut: string
  transportIn: TransportDetails
  transportOut: TransportDetails
  ticketAssigneeIds: string[]
  hotelAssigneeIds: string[]
  planAssigneeIds: string[]
  places: Record<string, Place[]>
  files: TravelFile[]
  image?: TravelFile
  imageUrl?: string
  imageFile?: File
  imageDeleteId?: string
}
type Trip = { id?: string; updatedAt?: string; role?: 'owner' | 'member'; name: string; startDate: string; endDate: string; timeZone: string; accentColor: string; cities: City[]; deletedCityIds?: string[]; dayDescriptions: Record<string, string>; members?: TripMember[]; memberCount?: number; background?: TravelFile; backgroundUrl?: string; backgroundFile?: File; backgroundRemoved?: boolean; backgroundDeleteId?: string }
type Screen = 'start' | 'login' | 'join' | 'trips' | 'setup' | 'dashboard' | 'profile' | 'view'
type RemoteUpdateNotice = { message: string }
export type { IconName } from './components/Icon'

const deletionErrorMessages = new Set([
  'Место не найдено',
  'Файл не найден',
  'Поездка не найдена',
  'Участник не найден',
  'Удалить файл может его автор или владелец поездки',
])

const deletionErrorCopy: Record<string, string> = {
  'Удалить файл может его автор или владелец поездки': 'Удалить файл может его автор или\u00a0владелец\u00a0поездки',
}

const deletionErrorMessage = (reason: unknown) => {
  if (!(reason instanceof ApiRequestError) || !deletionErrorMessages.has(reason.message)) return 'Попробуйте ещё раз'
  if (isMissingDeletionError(reason)) return 'Обновитесь до последней версии поездки'
  return deletionErrorCopy[reason.message] ?? reason.message
}

const isMissingDeletionError = (reason: unknown) => reason instanceof ApiRequestError && [
  'Место не найдено',
  'Файл не найден',
  'Поездка не найдена',
  'Участник не найден',
].includes(reason.message)

const isMissingCityError = (reason: unknown) => reason instanceof ApiRequestError && reason.message === 'Город не найден'
const isStaleTripDataError = (reason: unknown) => isMissingCityError(reason) || (reason instanceof ApiRequestError && [
  'Даты города должны находиться внутри поездки',
  'Ответственный должен быть участником поездки',
].includes(reason.message))
const isTripDatesExcludeCitiesError = (reason: unknown) => reason instanceof ApiRequestError && reason.message === 'Сначала перенесите даты городов внутрь нового диапазона'
const isDuplicatePlaceError = (reason: unknown) => reason instanceof ApiRequestError && reason.message === 'Эта точка уже добавлена на выбранный день'
const duplicatePlaceTitle = 'Дважды никак в один день'
const duplicatePlaceMessage = 'Выберите другую дату для точки'
const staleTripMessage = 'Обновитесь до последней версии поездки'
const staleTripOptions = { retryLabel: 'Обновить данные', actionIcon: 'refresh' as const, closable: false }

const uploadErrorMessage = (reason: unknown) => {
  if (!(reason instanceof ApiRequestError)) return undefined
  if (reason.message === 'Файл не выбран') return 'Нужно выбрать'
  if (reason.message === 'Фото должно быть изображением' || reason.message === 'Аватар должен быть изображением') return 'Нужно в формате JPG, PNG или WEBP'
  if (reason.status === 413 || /превышает допустимый размер|file too large/i.test(reason.message)) return 'Должен быть до 15 МБ'
  return undefined
}

const uploadErrorTitle = (message?: string) => message === 'Должен быть до 15 МБ'
  ? 'Какой огромный файл'
  : message === 'Нужно в формате JPG, PNG или WEBP'
    ? 'Кажется, это не картинка'
    : message === 'Нужно выбрать'
      ? 'Кажется, вы не выбрали файл'
    : 'Эх, файл не загрузился'

const isNonRetryableUploadMessage = (message?: string) => message === 'Нужно в формате JPG, PNG или WEBP' || message === 'Должен быть до 15 МБ' || message === 'Нужно выбрать'
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
const imageFileError = (file: File) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
  ? 'Проверьте формат файла'
  : file.size > MAX_UPLOAD_BYTES ? 'Слишком тяжёлый файл' : undefined
const imageRowErrorMessage = (reason: unknown) => uploadErrorMessage(reason) === 'Нужно в формате JPG, PNG или WEBP'
  ? 'Проверьте формат файла'
  : uploadErrorMessage(reason) === 'Должен быть до 15 МБ' ? 'Слишком тяжёлый файл' : uploadErrorMessage(reason) ?? 'Попробуйте загрузить ещё раз'

const invalidImportMessages = new Set([
  'В файле указаны некорректные данные поездки',
  'Некорректные данные города в файле',
  'Некорректное место в файле',
  'Дата места находится за пределами дат города',
  'Некорректное описание дня в файле',
  'Некорректный документ в файле',
  'Неизвестная иконка места в файле поездки',
])

const importErrorContent = (reason: unknown) => {
  if (!(reason instanceof ApiRequestError)) return undefined
  if (reason.message === 'Файл импорта не выбран') return { title: 'Кажется, вы не выбрали файл', message: 'Нужно выбрать' }
  if (reason.message === 'Файл поездки повреждён или имеет неверный формат') return { title: 'Кажется, файл повреждён', message: 'Попробуйте загрузить другой файл' }
  if (reason.message === 'Неподдерживаемый формат файла поездки') return { title: 'Не тот формат файла', message: 'Нужен формат .travelspace' }
  if (invalidImportMessages.has(reason.message)) return { title: 'Эх, поездка не загружается', message: 'В ней есть некорректные данные' }
  return undefined
}

const STORAGE_KEY = 'tabi-trip-v1'
const ADMIN_EMAIL = 'mirrorkey6629@gmail.com'
const appVersion = (import.meta.env.VITE_APP_VERSION || 'dev').slice(0, 7)
const defaultTripBackground = `${import.meta.env.BASE_URL}assets/autumn-garden.jpg`
const cityPlaceholder = `${import.meta.env.BASE_URL}assets/city-placeholder.png`
const ruMonths = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const ruWeekdays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
const greetings = ['Привет', 'Hello', 'Hola', 'Bonjour', 'Ciao', 'Hallo', 'Olá', 'こんにちは', '안녕하세요', '你好', 'Namaste', 'Merhaba', 'Hej', 'Hei', 'Ahoj', 'Cześć', 'Γεια σου', 'Shalom', 'Marhaba', 'Sawubona']


const uid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
const parseDate = (value: string) => new Date(`${value}T12:00:00`)
const isoDate = (date: Date) => date.toISOString().slice(0, 10)
const daysBetween = (from: string, to: string) => Math.max(0, Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86400000))
const periodOrder: Record<DayPeriod, number> = { morning: 0, day: 1, evening: 2 }
const periodDayPart: Record<DayPeriod, number> = { morning: 0, day: 0.5, evening: 1 }
const cityDays = (city: City) => {
  const dateDays = daysBetween(city.arrival, city.departure)
  const arrivalPeriod = city.arrivalPeriod ?? 'morning'
  const departurePeriod = city.departurePeriod ?? 'evening'
  const duration = dateDays + periodDayPart[departurePeriod] - periodDayPart[arrivalPeriod]
  return Math.max(0, Math.round(duration * 2) / 2)
}
const compareCitiesByDate = (left: City, right: City) => {
  const arrival = left.arrival.localeCompare(right.arrival)
  if (arrival !== 0) return arrival
  const arrivalPeriod = periodOrder[left.arrivalPeriod ?? 'morning'] - periodOrder[right.arrivalPeriod ?? 'morning']
  if (arrivalPeriod !== 0) return arrivalPeriod
  const departure = left.departure.localeCompare(right.departure)
  if (departure !== 0) return departure
  return periodOrder[left.departurePeriod ?? 'evening'] - periodOrder[right.departurePeriod ?? 'evening']
}
const sortCitiesByDate = (cities: City[]) => [...cities].sort(compareCitiesByDate)
const formatDays = (value: number) => {
  if (!Number.isInteger(value)) return `${String(value).replace('.', ',')} дня`
  const mod100 = Math.abs(value) % 100
  const mod10 = mod100 % 10
  const word = mod100 >= 11 && mod100 <= 14 ? 'дней' : mod10 === 1 ? 'день' : mod10 >= 2 && mod10 <= 4 ? 'дня' : 'дней'
  return `${value} ${word}`
}
const formatParticipants = (value: number) => {
  const mod100 = Math.abs(value) % 100
  const mod10 = mod100 % 10
  const word = mod100 >= 11 && mod100 <= 14 ? 'участников' : mod10 === 1 ? 'участник' : mod10 >= 2 && mod10 <= 4 ? 'участника' : 'участников'
  return `${value} ${word}`
}
const formatLocations = (value: number) => {
  const mod100 = Math.abs(value) % 100
  const mod10 = mod100 % 10
  const word = mod100 >= 11 && mod100 <= 14 ? 'локаций' : mod10 === 1 ? 'локация' : mod10 >= 2 && mod10 <= 4 ? 'локации' : 'локаций'
  return `${value} ${word}`
}
const DEFAULT_TRIP_ACCENT_COLOR = '#4D4FAB'
const TRIP_ACCENT_COLORS = [
  '#FA6B61', '#F78B2D', '#F5C30F', '#5AC840', '#36C976', '#26C4B4', '#56B2FF', '#A89BFF', '#EC82C1', '#F66591',
  '#E73F3E', '#D35F00', '#CFA53F', '#369E44', '#489E5F', '#46978E', '#3188DF', '#7869FA', '#BC58A0', '#CE4D7B',
  '#8C2B24', '#853618', '#A87A2D', '#33652E', '#33623E', '#2E5F59', '#2352A0', '#4D4FAB', '#793568', '#88294B',
]
const cityInLocative = (value: string) => {
  const name = value.trim()
  const ending = name.at(-1)?.toLowerCase()
  if (!ending) return name
  if (ending === 'а' || ending === 'я') return `${name.slice(0, -1)}е`
  if (ending === 'ь') return `${name.slice(0, -1)}и`
  if (ending === 'й') return `${name.slice(0, -1)}е`
  if ('оеёуыию'.includes(ending)) return name
  return `${name}е`
}
const tripChangeMessage = (change?: ApiTripChange | null) => {
  if (!change) return 'В поездке появились новые данные'
  const actor = change.actor_name || 'Другой участник'
  const city = change.city_name?.trim()
  const sections = new Set(change.sections)
  if (sections.size === 1 && sections.has('hotel')) return [actor, 'Отель', city].filter(Boolean).join(' · ')
  if (sections.size === 1 && (sections.has('transport-in') || sections.has('transport-out'))) return [actor, 'Транспорт', city].filter(Boolean).join(' · ')
  if (sections.size === 1 && sections.has('city')) return [actor, 'Город', city].filter(Boolean).join(' · ')
  if (sections.has('trip')) return `${actor} · Поездка`
  return [actor, 'Несколько разделов', city].filter(Boolean).join(' · ')
}
const formatDate = (value: string) => {
  const date = parseDate(value)
  return `${date.getDate()} ${ruMonths[date.getMonth()]}`
}
const formatDateWithWeekday = (value: string) => `${formatDate(value)} · ${ruWeekdays[parseDate(value).getDay()]}`
const formatCompactNumericDate = (value: string) => {
  const [, month, day] = value.split('-').map(Number)
  if (!month || !day) return 'Дата'
  return `${formatDate(value)} · ${ruWeekdays[parseDate(value).getDay()]}`
}
const formatTravelDuration = (departureTime: string, arrivalTime: string, departureDate?: string, arrivalDate?: string, departureTimeZone?: string, arrivalTimeZone?: string) => {
  const parseTime = (value: string) => {
    const match = value?.match(/^(\d{2}):(\d{2})$/)
    if (!match) return undefined
    const hours = Number(match[1])
    const minutes = Number(match[2])
    return hours < 24 && minutes < 60 ? hours * 60 + minutes : undefined
  }
  const departureMinutes = parseTime(departureTime)
  const arrivalMinutes = parseTime(arrivalTime)
  if (departureMinutes === undefined || arrivalMinutes === undefined) return undefined
  if (departureDate && arrivalDate && departureTimeZone && arrivalTimeZone) {
    const timestamp = (date: string, time: string, zone: string) => {
      const [year, month, day] = date.split('-').map(Number)
      const [hour, minute] = time.split(':').map(Number)
      const desired = Date.UTC(year, month - 1, day, hour, minute)
      let guess = desired
      for (let iteration = 0; iteration < 2; iteration += 1) {
        const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess)).map((part) => [part.type, part.value]))
        const observed = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute))
        guess += desired - observed
      }
      return guess
    }
    const duration = Math.round((timestamp(arrivalDate, arrivalTime, arrivalTimeZone) - timestamp(departureDate, departureTime, departureTimeZone)) / 60000)
    if (duration >= 0) return `В пути ${Math.floor(duration / 60)} ч ${duration % 60} мин`
  }
  let duration = arrivalMinutes - departureMinutes
  if (departureDate && arrivalDate) duration += Math.round((parseDate(arrivalDate).getTime() - parseDate(departureDate).getTime()) / 86400000) * 1440
  if (duration < 0) duration += 1440
  return `В пути ${Math.floor(duration / 60)} ч ${duration % 60} мин`
}
const formatTravelTimes = (departureTime: string, arrivalTime: string) => {
  if (departureTime && arrivalTime) return `${departureTime} – ${arrivalTime}`
  if (departureTime) return `Отъезд ${departureTime}`
  if (arrivalTime) return `Прибытие ${arrivalTime}`
  return ''
}
const transportEventIcon = (type?: TransportType): IconName => type === 'train' || type === 'bus' ? 'train' : type === 'plane' ? 'plane' : type === 'ship' ? 'sailing' : 'rocket-launch'
const formatShortRange = (from: string, to: string) => {
  const start = parseDate(from)
  const end = parseDate(to)
  const startDay = start.getDate()
  const endDay = end.getDate()
  const startMonth = ruMonths[start.getMonth()].slice(0, 3)
  const endMonth = ruMonths[end.getMonth()].slice(0, 3)
  if (from === to) return `${startDay} ${startMonth}`
  return start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
    ? `${startDay}–${endDay} ${endMonth}`
    : `${startDay} ${startMonth}–${endDay} ${endMonth}`
}
const formatLongRange = (from: string, to: string) => {
  const start = parseDate(from)
  const end = parseDate(to)
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()}–${end.getDate()} ${ruMonths[end.getMonth()]}`
  }
  return `${formatDate(from)}–${formatDate(to)}`
}
const dateRange = (from: string, to: string) => {
  const result: string[] = []
  const cursor = parseDate(from)
  const end = parseDate(to)
  while (cursor <= end) {
    result.push(isoDate(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return result
}

const tripBackgroundSource = (trip: Trip) => trip.backgroundRemoved ? '' : trip.backgroundUrl || defaultTripBackground
const tripBackgroundStyle = (trip: Trip): CSSProperties => ({ '--trip-background-image': trip.backgroundRemoved ? 'none' : `url("${tripBackgroundSource(trip)}")` } as CSSProperties)
const decodedTripBackgrounds = new Set<string>()

function useTripBackgroundReady(trip: Trip) {
  const source = tripBackgroundSource(trip)
  const [readySource, setReadySource] = useState(() => decodedTripBackgrounds.has(source) ? source : '')
  const ready = !source || decodedTripBackgrounds.has(source) || readySource === source
  useEffect(() => {
    if (!source || decodedTripBackgrounds.has(source)) {
      setReadySource(source)
      return
    }
    let cancelled = false
    const image = new Image()
    const reveal = () => {
      if (cancelled) return
      decodedTripBackgrounds.add(source)
      requestAnimationFrame(() => requestAnimationFrame(() => { if (!cancelled) setReadySource(source) }))
    }
    image.onload = reveal
    image.onerror = reveal
    image.src = source
    if (image.decode) void image.decode().then(reveal, () => undefined)
    return () => { cancelled = true }
  }, [source])
  return ready
}

const tripBackgroundClassName = (className: string, ready: boolean) => `${className} trip-background-${ready ? 'ready' : 'loading'}`


const fromApiTrip = (source: ApiTripDetails): Trip => {
  const backgroundDocument = source.documents.find((document) => !document.city_id && document.category === 'trip-background')
  const cities = source.cities.map<City>((city) => {
    const places: Record<string, Place[]> = {}
    source.places.filter((place) => place.city_id === city.id).forEach((place) => {
      const key = place.visit_date?.slice(0, 10) || UNSCHEDULED_KEY
      ;(places[key] ??= []).push({ id: place.id, name: place.name, url: place.google_maps_url, icon: place.icon ?? 'default', notes: place.notes ?? '', latitude: place.latitude ?? undefined, longitude: place.longitude ?? undefined })
    })
    const documents = source.documents.filter((document) => document.city_id === city.id)
    const trainIn = documents.find((document) => document.category.startsWith('train-in:'))?.original_name || city.train_in
    const trainOut = documents.find((document) => document.category.startsWith('train-out:'))?.original_name || city.train_out
    const imageDocument = documents.find((document) => document.category === 'city-image')
    return {
      id: city.id,
      updatedAt: city.updated_at,
      name: city.name,
      googleMapsUrl: city.google_maps_url ?? '',
      arrival: city.arrival_date.slice(0, 10),
      departure: city.departure_date.slice(0, 10),
      arrivalPeriod: city.arrival_period,
      departurePeriod: city.departure_period,
      hotelNotNeeded: Boolean(city.hotel_not_needed),
      hotel: city.hotel,
      hotelUrl: city.hotel_url,
      hotelCheckInTime: city.hotel_check_in_time ?? '',
      hotelCheckOutTime: city.hotel_check_out_time ?? '',
      hotelNotes: city.hotel_notes ?? '',
      hotelPayerIds: city.hotel_payer_ids ?? [],
      hotelTotalAmountRubles: city.hotel_total_amount_rubles ?? 0,
      trainIn,
      trainOut,
      transportIn: { type: city.transport_in_type ?? undefined, name: city.transport_in_name ?? '', departureDate: city.transport_in_departure_date, arrivalDate: city.transport_in_arrival_date, departureTime: city.transport_in_departure_time, arrivalTime: city.transport_in_arrival_time, departureTimeZone: city.transport_in_departure_time_zone, arrivalTimeZone: city.transport_in_arrival_time_zone, departureStation: city.transport_in_departure_station, departureStationUrl: city.transport_in_departure_station_url, arrivalStation: city.transport_in_arrival_station, arrivalStationUrl: city.transport_in_arrival_station_url, notes: city.transport_in_notes ?? '', ticketOnSite: Boolean(city.transport_in_ticket_on_site), payerIds: city.transport_in_payer_ids ?? [], totalAmountRubles: city.transport_in_total_amount_rubles ?? 0 },
      transportOut: { type: city.transport_out_type ?? undefined, name: city.transport_out_name ?? '', departureDate: city.transport_out_departure_date, arrivalDate: city.transport_out_arrival_date, departureTime: city.transport_out_departure_time, arrivalTime: city.transport_out_arrival_time, departureTimeZone: city.transport_out_departure_time_zone, arrivalTimeZone: city.transport_out_arrival_time_zone, departureStation: city.transport_out_departure_station, departureStationUrl: city.transport_out_departure_station_url, arrivalStation: city.transport_out_arrival_station, arrivalStationUrl: city.transport_out_arrival_station_url, notes: city.transport_out_notes ?? '', ticketOnSite: Boolean(city.transport_out_ticket_on_site), payerIds: city.transport_out_payer_ids ?? [], totalAmountRubles: city.transport_out_total_amount_rubles ?? 0 },
      ticketAssigneeIds: city.ticket_assignee_ids ?? [],
      hotelAssigneeIds: city.hotel_assignee_ids ?? [],
      planAssigneeIds: city.plan_assignee_ids ?? [],
      places,
      files: documents.map((document) => ({ id: document.id, name: document.original_name, category: document.category, uploadedBy: document.created_by_name, uploadedAt: document.created_at })),
      image: imageDocument ? { id: imageDocument.id, name: imageDocument.original_name, category: imageDocument.category, uploadedBy: imageDocument.created_by_name, uploadedAt: imageDocument.created_at } : undefined,
    }
  }).sort(compareCitiesByDate)
  return { id: source.id, updatedAt: source.updated_at, role: source.role, name: source.name, startDate: source.start_date.slice(0, 10), endDate: source.end_date.slice(0, 10), timeZone: source.time_zone || 'UTC', accentColor: source.accent_color || DEFAULT_TRIP_ACCENT_COLOR, cities, deletedCityIds: [], dayDescriptions: Object.fromEntries(source.day_notes.map((note) => [note.day_date.slice(0, 10), note.description])), members: source.members.map((member) => ({ id: member.id, email: member.email, displayName: member.display_name, role: member.role, hasAvatar: member.has_avatar })), memberCount: source.member_count ?? source.members.length, background: backgroundDocument ? { id: backgroundDocument.id, name: backgroundDocument.original_name, category: backgroundDocument.category } : undefined, backgroundUrl: source.background_removed ? undefined : defaultTripBackground, backgroundRemoved: Boolean(source.background_removed) }
}

// BASE_URL — это vite base, всегда со слэшем на конце. Строки, которые JS собирает
// сам, Vite префиксом не дополняет, в отличие от путей в HTML и CSS.
export function GalaxyBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const workerRef = useRef<Worker | null>(null)
  const terminateTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (terminateTimerRef.current !== null) {
      window.clearTimeout(terminateTimerRef.current)
      terminateTimerRef.current = null
    }

    if (!workerRef.current && 'transferControlToOffscreen' in canvas) {
      const worker = new Worker(new URL('./galaxy.worker.ts', import.meta.url), { type: 'module' })
      const offscreen = canvas.transferControlToOffscreen()
      worker.postMessage({ type: 'init', canvas: offscreen, reduced }, [offscreen])
      workerRef.current = worker
    }
    const worker = workerRef.current
    if (!worker) return

    let inputFrame = 0
    let resizePending = true
    let pointerPending = false
    let pointerX = 0
    let pointerY = 0
    const flushInput = () => {
      inputFrame = 0
      if (resizePending) {
        resizePending = false
        worker.postMessage({ type: 'resize', width: window.innerWidth, height: window.innerHeight, ratio: Math.min(window.devicePixelRatio || 1, 1.5) })
      }
      if (pointerPending) {
        pointerPending = false
        worker.postMessage({ type: 'pointer', x: pointerX, y: pointerY })
      }
    }
    const scheduleInput = () => {
      if (!inputFrame) inputFrame = requestAnimationFrame(flushInput)
    }
    const handlePointerMove = (event: PointerEvent) => {
      pointerX = event.clientX
      pointerY = event.clientY
      pointerPending = true
      scheduleInput()
    }
    const handleResize = () => {
      resizePending = true
      scheduleInput()
    }
    const handleVisibilityChange = () => {
      worker.postMessage({ type: 'visible', value: !document.hidden })
    }
    worker.postMessage({ type: 'visible', value: !document.hidden })
    scheduleInput()
    window.addEventListener('resize', handleResize)
    window.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      cancelAnimationFrame(inputFrame)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      worker.postMessage({ type: 'visible', value: false })
      terminateTimerRef.current = window.setTimeout(() => {
        if (workerRef.current !== worker) return
        worker.terminate()
        workerRef.current = null
        terminateTimerRef.current = null
      }, 0)
    }
  }, [])

  return <canvas className="galaxy-background" ref={canvasRef} aria-hidden="true" />
}

function AuthShell({ children, onBack }: { children: React.ReactNode; onBack?: () => void }) {
  return (
    <main className="screen auth-screen">
      <GalaxyBackground />
      <div className="auth-brand" aria-label="Travel Space">
        <Icon name="planet" size={24} />
        <span className="type-head-m">Travel Space</span>
      </div>
      {onBack && <IconButton className="back-button" size="l" icon={<Icon name="arrow-back" />} onClick={onBack} aria-label="Назад" />}
      {children}
    </main>
  )
}

function StartScreen({ onLogin, onJoin }: { onLogin: () => void; onJoin: () => void }) {
  return (
    <div className="choice-grid">
      <button className="glass choice-card" onClick={onLogin}>Войти</button>
      <button className="glass choice-card" onClick={onJoin}>Присоединиться</button>
    </div>
  )
}

function RandomGreetingTitle({ defaultTitle }: { defaultTitle: string }) {
  const [title, setTitle] = useState(defaultTitle)
  const [spinning, setSpinning] = useState(false)
  const randomize = () => {
    if (spinning) return
    setSpinning(true)
  }
  const finishRandomize = () => {
    const variants = greetings.filter((greeting) => greeting !== title)
    setTitle(variants[Math.floor(Math.random() * variants.length)])
    setSpinning(false)
  }
  return (
    <button className="auth-greeting-title" type="button" onClick={randomize} aria-label={`${title}. Показать приветствие на другом языке`} aria-busy={spinning} title="Другое приветствие">
      <h1>{title}</h1>
      <span className={`auth-greeting-button${spinning ? ' spinning' : ''}`} aria-hidden="true" onAnimationEnd={finishRandomize}><Icon name="casino" size={24} /></span>
    </button>
  )
}

function LoginScreen({ onSubmit, onOperationError }: { onSubmit: () => Promise<void>; onOperationError: (title: string, retry: () => void) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [busy, setBusy] = useState(false)
  const emailError = !/^\S+@\S+\.\S+$/.test(email.trim()) || error === 'Такая почта не зарегистрирована' ? 'Такая почта не зарегистрирована' : error === 'Аккаунт с такой почтой уже есть' ? 'Аккаунт с такой почтой уже есть' : ''
  const nameError = mode === 'register' && !name.trim() ? 'Нужно ввести имя' : ''
  const passwordError = password.length < 8 ? 'В пароле должно быть не меньше 8 символов' : password.length > 256 ? mode === 'login' ? 'Неправильный пароль' : 'В пароле должно быть меньше 256 символов' : error === 'Неправильный пароль' ? 'Неправильный пароль' : ''
  const authenticate = async () => {
    setError(''); setBusy(true)
    try {
      const result = mode === 'register'
        ? await api.register(email, password, name)
        : await api.login(email, password)
      session.token = result.token
      await onSubmit()
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : ''
      if (accountFieldErrors.has(message)) setError(message)
      else onOperationError('Ох, что-то отвалилось', () => void authenticate())
    }
    finally { setBusy(false) }
  }
  const submit = (event: FormEvent) => {
    event.preventDefault(); setShowErrors(true)
    if (emailError || nameError || passwordError) return
    void authenticate()
  }
  return (
    <AuthPanel as="form" onSubmit={submit}>
      {mode === 'login' ? <RandomGreetingTitle defaultTitle="И снова здравствуйте" /> : <h1>Регистрация</h1>}
      <FormControlList>
        {mode === 'register' && <FormControlRow><Input icon={<Icon name="face" />} value={name} onChange={(event) => setName(event.target.value)} placeholder="Как тебя называть" autoComplete="name" autoFocus error={showErrors ? nameError : undefined} /></FormControlRow>}
        <FormControlRow><Input icon={<Icon name="email" />} type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError('') }} placeholder="Email" autoComplete="email" autoFocus={mode === 'login'} error={showErrors || error.includes('email') ? emailError : undefined} /></FormControlRow>
        <FormControlRow><Input icon={<Icon name="encrypted" />} type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} placeholder="Пароль — минимум 8 символов" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} error={showErrors || error === 'Неправильный пароль' ? passwordError : undefined} /></FormControlRow>
      </FormControlList>
      <Button type="submit" disabled={busy}>{busy ? 'Подожди…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}</Button>
      <Button size="m" theme="transparent" type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
        {mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
      </Button>
      {error && !emailError && !passwordError && <p className="form-hint">{error}</p>}
    </AuthPanel>
  )
}

const accountFieldErrors = new Set(['Такая почта не зарегистрирована', 'Неправильный пароль', 'Аккаунт с такой почтой уже есть'])

function JoinScreen({ onSubmit, initialLink = '', serverError = '', onClearError }: { onSubmit: (link: string, name: string, email: string, password: string, mode: 'login' | 'register') => Promise<void>; initialLink?: string; serverError?: string; onClearError: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('register')
  const [link, setLink] = useState(initialLink)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const valid = link.trim() && email.trim() && password.length >= 8 && (mode === 'login' || name.trim())
  return (
    <AuthPanel as="form" onSubmit={async (event) => { event.preventDefault(); setShowErrors(true); if (valid && /^\S+@\S+\.\S+$/.test(email.trim()) && password.length <= 256) await onSubmit(link, name, email, password, mode) }}>
      <RandomGreetingTitle defaultTitle="Добро пожаловать" />
      <FormControlList>
        <FormControlRow><Input icon={<Icon name="link" />} value={link} onChange={(event) => { setLink(event.target.value); onClearError() }} placeholder="Ссылка на поездку" error={serverError === 'Неправильная ссылка' ? serverError : showErrors && !link.includes('/join/') ? 'Неправильная ссылка' : undefined} /></FormControlRow>
        {mode === 'register' && <FormControlRow><Input icon={<Icon name="face" />} value={name} onChange={(event) => setName(event.target.value)} placeholder="Как тебя называть" autoComplete="name" error={showErrors && !name.trim() ? 'Нужно ввести имя' : undefined} /></FormControlRow>}
        <FormControlRow><Input icon={<Icon name="email" />} type="email" value={email} onChange={(event) => { setEmail(event.target.value); onClearError() }} placeholder="Email" autoComplete="email" error={serverError === 'Такая почта не зарегистрирована' || serverError === 'Аккаунт с такой почтой уже есть' ? serverError : showErrors && !/^\S+@\S+\.\S+$/.test(email.trim()) ? 'Такая почта не зарегистрирована' : undefined} /></FormControlRow>
        <FormControlRow><Input icon={<Icon name="encrypted" />} type="password" value={password} onChange={(event) => { setPassword(event.target.value); onClearError() }} placeholder="Пароль — минимум 8 символов" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} error={serverError === 'Неправильный пароль' ? serverError : showErrors ? password.length < 8 ? 'В пароле должно быть не меньше 8 символов' : password.length > 256 ? mode === 'login' ? 'Неправильный пароль' : 'В пароле должно быть меньше 256 символов' : undefined : undefined} /></FormControlRow>
      </FormControlList>
      <Button type="submit">Я в деле</Button>
      <Button size="m" theme="transparent" type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); onClearError() }}>
        {mode === 'login' ? 'Создать новый аккаунт' : 'У меня уже есть аккаунт'}
      </Button>
    </AuthPanel>
  )
}

function ProfileScreen({ user, onBack, onSave, onAvatar, onLogout, onOperationError }: { user: CurrentUser; onBack: () => void; onSave: (value: { displayName: string; email: string; password?: string }) => Promise<void>; onAvatar: (file: File) => Promise<string>; onLogout: () => void; onOperationError: (title: string, retry: () => void, message?: string, options?: { retryable?: boolean }) => void }) {
  const [displayName, setDisplayName] = useState(user.displayName)
  const [email, setEmail] = useState(user.email)
  const [password, setPassword] = useState('')
  const access = useAccess()
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || `${import.meta.env.BASE_URL}assets/person-owner.png`)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const saved = message === 'Изменения сохранены'
  const profileChanged = displayName.trim() !== user.displayName || email.trim().toLowerCase() !== user.email.toLowerCase() || Boolean(password)
  const changed = profileChanged || Boolean(avatarFile)
  const valid = displayName.trim() && /^\S+@\S+\.\S+$/.test(email.trim()) && (!password || (password.length >= 8 && password.length <= 256))
  const submitProfile = async () => {
    setBusy(true)
    setMessage('')
    try {
      if (profileChanged) await onSave({ displayName: displayName.trim(), email: email.trim().toLowerCase(), ...(password ? { password } : {}) })
      if (avatarFile) {
        const savedUrl = await onAvatar(avatarFile)
        setAvatarUrl(savedUrl)
        setAvatarFile(null)
      }
      setPassword('')
      setMessage('Изменения сохранены')
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : ''
      if (message === 'Аккаунт с такой почтой уже есть') setMessage(message)
      else {
        const uploadMessage = avatarFile ? uploadErrorMessage(reason) : undefined
        onOperationError(uploadMessage ? uploadErrorTitle(uploadMessage) : 'Эх, не сохраняется', () => void submitProfile(), uploadMessage, isNonRetryableUploadMessage(uploadMessage) ? { retryable: false } : undefined)
      }
    } finally {
      setBusy(false)
    }
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    setShowErrors(true)
    if (!changed || !valid) return
    void submitProfile()
  }
  return (
    <main className="screen auth-screen profile-screen">
      <GalaxyBackground />
      <IconButton className="back-button" size="l" icon={<Icon name="arrow-back" />} onClick={onBack} aria-label="Назад" title="Назад" />
      <form className="profile-form" onSubmit={submit}>
        <FormPanelLayout className="setup-transition" contentHeight action={<Button type="submit" disabled={busy || !changed || !access.canEdit}>{busy ? 'Сохраняем…' : saved ? 'Изменения сохранены' : 'Сохранить'}</Button>}>
          <FormPanelHeader title="Профиль" action={<IconButton type="button" icon={<Icon name="door-open" />} onClick={onLogout} aria-label="Выйти из аккаунта" title="Выйти из аккаунта" />} />
          <FormPanelGroup className="profile-avatar-group">
            <ImageFilePicker disabled={!access.canEdit} onSelect={(file, previewUrl) => { setAvatarUrl(previewUrl); setAvatarFile(file); setMessage('') }}>
              {({ open }) => <Avatar src={avatarUrl} alt="Аватар профиля" shape="circle" size={200} hoverEffect onClick={open} disabled={!access.canEdit} actionLabel="Загрузить новый аватар" />}
            </ImageFilePicker>
          </FormPanelGroup>
          <FormPanelGroup>
            <FormControlList>
              <FormControlRow><Input icon={<Icon name="face" />} aria-label="Имя" placeholder="Имя" value={displayName} onChange={(event) => { setDisplayName(event.target.value); setMessage('') }} autoComplete="name" error={showErrors && !displayName.trim() ? 'Нужно ввести имя' : undefined} /></FormControlRow>
              <FormControlRow><Input icon={<Icon name="email" />} aria-label="Почта" placeholder="Почта" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setMessage('') }} autoComplete="email" error={message.includes('Аккаунт с такой почтой') ? 'Аккаунт с такой почтой уже есть' : showErrors && !/^\S+@\S+\.\S+$/.test(email.trim()) ? 'Такая почта не зарегистрирована' : undefined} /></FormControlRow>
              <FormControlRow><Input icon={<Icon name="encrypted" />} aria-label="Новый пароль" type="password" value={password} onChange={(event) => { setPassword(event.target.value); setMessage('') }} placeholder="Новый пароль" autoComplete="new-password" error={showErrors && password ? password.length < 8 ? 'В пароле должно быть не меньше 8 символов' : password.length > 256 ? 'В пароле должно быть меньше 256 символов' : undefined : undefined} /></FormControlRow>
            </FormControlList>
          </FormPanelGroup>
          {message && !saved && <FormPanelNote centered>{message}</FormPanelNote>}
        </FormPanelLayout>
      </form>
    </main>
  )
}

function TripsScreen({ trips, canCreate, deleteTarget, onOpen, onCreate, onClose, onDelete, onCloseDelete, onConfirmDelete, onExport, onImport }: { trips: ApiTripSummary[]; canCreate: boolean; deleteTarget: ApiTripSummary | null; onOpen: (id: string) => void; onCreate: () => void; onClose: () => void; onDelete: (trip: ApiTripSummary) => void; onCloseDelete: () => void; onConfirmDelete: () => Promise<void>; onExport: (trip: ApiTripSummary) => Promise<void>; onImport: (file: File) => Promise<void> }) {
  const access = useAccess()
  const [backgroundUrls, setBackgroundUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    let active = true
    const objectUrls: string[] = []
    setBackgroundUrls({})
    void Promise.all(trips.map(async (item) => {
      if (!item.background_document_id || item.background_removed) return
      try {
        const blob = await api.downloadDocument(item.background_document_id)
        const url = URL.createObjectURL(blob)
        if (!active) {
          URL.revokeObjectURL(url)
          return
        }
        objectUrls.push(url)
        setBackgroundUrls((current) => ({ ...current, [item.id]: url }))
      } catch {
        // The trip row remains usable even if its optional preview cannot be loaded.
      }
    }))
    return () => {
      active = false
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [trips])
  return (
    <main className="screen auth-screen trips-screen">
      <GalaxyBackground />
      <IconButton className="back-button" size="l" icon={<Icon name="arrow-back" />} onClick={onClose} aria-label="Назад" title="Назад" />
      {deleteTarget
        ? <DeleteTripDialog key={deleteTarget.id} trip={deleteTarget} onClose={onCloseDelete} onConfirm={onConfirmDelete} />
        : <FormPanelLayout className="setup-transition" contentHeight>
          <FormPanelHeader title="Мои поездки" />
          <FormPanelGroup gap={8}>
            <InfoRowList>
              {trips.map((item) => <InfoRow key={item.id} image={item.background_removed ? undefined : item.background_document_id ? backgroundUrls[item.id] : defaultTripBackground} imageAlt={item.background_removed ? '' : `Фон поездки ${item.name}`} title={item.name} subtitle={<>{item.role === 'owner' ? 'Владелец' : 'Гость'} · {formatLongRange(item.start_date.slice(0, 10), item.end_date.slice(0, 10))}</>} onClick={() => onOpen(item.id)} hoverEffect actionTheme="secondary" actions={item.role === 'owner' && access.canEdit ? [{ icon: <Icon name="download" />, label: `Экспортировать поездку ${item.name}`, title: 'Экспортировать', onClick: () => void onExport(item) }, { icon: <Icon name="delete-forever" />, label: `Удалить поездку ${item.name}`, title: 'Удалить', onClick: () => onDelete(item) }] : []} />)}
              {canCreate && access.canEdit && <AddRow icon={<Icon name="add-plus" />} onClick={onCreate} aria-label="Создать ещё одну поездку" />}
            </InfoRowList>
          </FormPanelGroup>
          {canCreate && access.canEdit && <FormPanelGroup align="center">
            <FilePicker accept=".travelspace,application/vnd.travel-space+json,application/json" onSelect={(file) => void onImport(file)}>
              {({ open }) => <Button size="m" theme="transparent" onClick={open}>Импортировать поездку из файла</Button>}
            </FilePicker>
          </FormPanelGroup>}
        </FormPanelLayout>}
    </main>
  )
}

function DeleteTripDialog({ trip, onClose, onConfirm }: { trip: ApiTripSummary; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [showError, setShowError] = useState(false)
  return (
    <FormPanelLayout className="setup-transition" contentHeight action={<Button disabled={busy} onClick={async () => { setShowError(true); if (confirmation !== trip.name) return; setBusy(true); try { await onConfirm() } finally { setBusy(false) } }}>{busy ? 'Удаляем…' : 'Удалить поездку'}</Button>}>
      <FormPanelHeader title={`Удалить «${trip.name}»?`} text="Все данные поездки будут удалены без возможности восстановления. Для подтверждения введите её название." action={<IconButton icon={<Icon name="close" />} onClick={onClose} aria-label="Закрыть" />} />
      <FormPanelGroup><FormControlList><FormControlRow><Input showLabel={false} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={trip.name} autoFocus error={showError && confirmation !== trip.name ? 'Такой поездки не существует' : undefined} /></FormControlRow></FormControlList></FormPanelGroup>
    </FormPanelLayout>
  )
}

function DeleteCityDialog({ city, onClose, onConfirm }: { city: City; onClose: () => void; onConfirm: () => void }) {
  const [confirmation, setConfirmation] = useState('')
  const [showError, setShowError] = useState(false)
  return (
    <FormPanelLayout className="setup-transition" contentHeight action={<Button onClick={() => { setShowError(true); if (confirmation === city.name) onConfirm() }}>Удалить город</Button>}>
      <FormPanelHeader title={`Удалить ${city.name}?`} text="Все локации и файлы из него будут удалены. Для подтверждения введите название города." action={<IconButton icon={<Icon name="close" />} onClick={onClose} aria-label="Закрыть" />} />
      <FormPanelGroup><FormControlList><FormControlRow><Input showLabel={false} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={city.name} autoFocus error={showError && confirmation !== city.name ? 'Такого города не существует' : undefined} /></FormControlRow></FormControlList></FormPanelGroup>
    </FormPanelLayout>
  )
}

function InviteScreen({ trip, onBack, onCreate, onViewLink, onRemove, onRefresh, onOperationError }: { trip: Trip; onBack: () => void; onCreate: (hours: number) => Promise<{ url: string; expiresAt: string }>; onViewLink: () => Promise<string>; onRemove: (member: TripMember) => Promise<void>; onRefresh: () => Promise<void>; onOperationError: (title: string, retry: () => void, message?: string, options?: { retryLabel?: string; actionIcon?: 'retry' | 'refresh'; closable?: boolean; retryable?: boolean }) => void }) {
  const [invite, setInvite] = useState<{ url: string; expiresAt: string } | null>(null)
  const access = useAccess()
  const [viewLink, setViewLink] = useState('')
  const [busy, setBusy] = useState(false)
  const backgroundReady = useTripBackgroundReady(trip)
  // Список участников читается из кэша поездки, поэтому экран полезен и оффлайн.
  // Ссылки же создаются только на сервере — без сети их блок просто не нужен.
  const isOwner = trip.role === 'owner' && access.canEdit
  const members = [...(trip.members ?? [])].sort((left, right) => {
    if (left.role === right.role) return 0
    return left.role === 'owner' ? -1 : 1
  })
  const loadViewLink = () => void onViewLink().then(setViewLink).catch(() => { setViewLink(''); onOperationError('Ох, что-то отвалилось', loadViewLink) })
  const createInvitation = async () => {
    setBusy(true)
    try { setInvite(await onCreate(24)) }
    catch { onOperationError('Ох, что-то отвалилось', () => void createInvitation()) }
    finally { setBusy(false) }
  }
  const removeMember = async (member: TripMember) => {
    try { await onRemove(member) }
    catch (reason) {
      const missing = isMissingDeletionError(reason)
      onOperationError(missing ? 'Кажется, данные устарели' : 'Эх, не удаляется', missing ? () => void onRefresh() : () => void removeMember(member), deletionErrorMessage(reason), missing ? { retryLabel: 'Обновить данные', actionIcon: 'refresh', closable: false } : undefined)
    }
  }
  useEffect(() => { if (isOwner) loadViewLink() }, [isOwner])
  return <main className={tripBackgroundClassName('screen trip-background setup-screen', backgroundReady)} style={tripBackgroundStyle(trip)}>
    <IconButton className="back-button" size="l" icon={<Icon name="arrow-back" />} onClick={onBack} aria-label="Назад" title="Назад" />
    <FormPanelLayout className="setup-transition" contentHeight>
      <FormPanelHeader title={`Участники «${trip.name}»`} />
      <FormPanelGroup>
        {members.length > 0
          ? <InfoRowList>{members.map((member) => <InfoRow key={member.id} image={member.avatarUrl || `${import.meta.env.BASE_URL}assets/${member.role === 'owner' ? 'person-owner.png' : 'person-member.png'}`} imageAlt={`Аватар ${member.displayName}`} imageShape="circle" title={member.displayName} titleStyle="text" subtitle={member.email} actionTheme="secondary" actions={!isOwner || member.role === 'owner' ? [] : [{ icon: <Icon name="delete-forever" />, label: `Удалить ${member.displayName} из поездки`, title: 'Удалить участника', onClick: () => { if (window.confirm(`Удалить ${member.displayName} из поездки?`)) void removeMember(member) } }]} />)}</InfoRowList>
          : <FormPanelNote centered>Не удалось загрузить список участников.</FormPanelNote>}
      </FormPanelGroup>
      {isOwner && <>
        <FormPanelGroup>
          <FormControlList headline="Ссылка-приглашение" text="Действует 24 часа, при повторном создании прошлая ссылка сбросится">
          {invite && <>
            <FormControlRow><Input aria-label="Активная ссылка приглашения" icon={<Icon name="link" />} type="url" readOnly value={invite.url} trailingIcon={<Icon name="content-copy" />} trailingIconLabel="Скопировать ссылку" onTrailingIconClick={() => void navigator.clipboard.writeText(invite.url)} /></FormControlRow>
          </>}
          <FormControlRow><Button size="l" disabled={busy} onClick={() => void createInvitation()}>{busy ? 'Создаём…' : invite ? 'Создать новую ссылку' : 'Создать ссылку'}</Button></FormControlRow>
          </FormControlList>
        </FormPanelGroup>
        <FormPanelGroup>
          <FormControlList headline="Доступ на просмотр" text="Постоянная ссылка без присоединения к поездке"><FormControlRow><Input icon={<Icon name="link" />} type="url" readOnly value={viewLink} trailingIcon={viewLink ? <Icon name="content-copy" /> : undefined} trailingIconLabel="Скопировать ссылку на просмотр" onTrailingIconClick={viewLink ? () => void navigator.clipboard.writeText(viewLink) : undefined} /></FormControlRow></FormControlList>
        </FormPanelGroup>
      </>}
    </FormPanelLayout>
  </main>
}

const emptyTransport = (): TransportDetails => ({ name: '', departureDate: '', arrivalDate: '', departureTime: '', arrivalTime: '', departureTimeZone: '', arrivalTimeZone: '', departureStation: '', departureStationUrl: '', arrivalStation: '', arrivalStationUrl: '', notes: '', ticketOnSite: false, payerIds: [], totalAmountRubles: 0 })

const transportPayload = (city: City) => ({
  transportInType: city.transportIn?.type,
  transportOutType: city.transportOut?.type,
  transportInName: city.transportIn?.name ?? '',
  transportOutName: city.transportOut?.name ?? '',
  transportInDepartureTime: city.transportIn?.departureTime ?? '',
  transportInArrivalTime: city.transportIn?.arrivalTime ?? '',
  transportInDepartureDate: city.transportIn?.departureDate ?? '',
  transportInArrivalDate: city.transportIn?.arrivalDate ?? '',
  transportInDepartureTimeZone: city.transportIn?.departureTimeZone ?? '',
  transportInArrivalTimeZone: city.transportIn?.arrivalTimeZone ?? '',
  transportOutDepartureTime: city.transportOut?.departureTime ?? '',
  transportOutArrivalTime: city.transportOut?.arrivalTime ?? '',
  transportOutDepartureDate: city.transportOut?.departureDate ?? '',
  transportOutArrivalDate: city.transportOut?.arrivalDate ?? '',
  transportOutDepartureTimeZone: city.transportOut?.departureTimeZone ?? '',
  transportOutArrivalTimeZone: city.transportOut?.arrivalTimeZone ?? '',
  transportInDepartureStation: city.transportIn?.departureStation ?? '',
  transportInDepartureStationUrl: city.transportIn?.departureStationUrl ?? '',
  transportInArrivalStation: city.transportIn?.arrivalStation ?? '',
  transportInArrivalStationUrl: city.transportIn?.arrivalStationUrl ?? '',
  transportOutDepartureStation: city.transportOut?.departureStation ?? '',
  transportOutDepartureStationUrl: city.transportOut?.departureStationUrl ?? '',
  transportOutArrivalStation: city.transportOut?.arrivalStation ?? '',
  transportOutArrivalStationUrl: city.transportOut?.arrivalStationUrl ?? '',
  transportInNotes: city.transportIn?.notes ?? '',
  transportOutNotes: city.transportOut?.notes ?? '',
  transportInTicketOnSite: city.transportIn?.ticketOnSite ?? false,
  transportOutTicketOnSite: city.transportOut?.ticketOnSite ?? false,
  transportInPayerIds: city.transportIn?.payerIds ?? [],
  transportOutPayerIds: city.transportOut?.payerIds ?? [],
  transportInTotalAmountRubles: city.transportIn?.totalAmountRubles ?? 0,
  transportOutTotalAmountRubles: city.transportOut?.totalAmountRubles ?? 0,
})
const hotelPayload = (city: City) => ({ hotelNotNeeded: city.hotelNotNeeded, hotel: city.hotel, hotelUrl: city.hotelUrl, hotelCheckInTime: city.hotelCheckInTime ?? '', hotelCheckOutTime: city.hotelCheckOutTime ?? '', hotelNotes: city.hotelNotes ?? '', hotelPayerIds: city.hotelPayerIds ?? [], hotelTotalAmountRubles: city.hotelTotalAmountRubles ?? 0 })
const assignmentPayload = (city: City) => ({ ticketAssigneeIds: city.ticketAssigneeIds, hotelAssigneeIds: city.hotelNotNeeded ? [] : city.hotelAssigneeIds, planAssigneeIds: city.planAssigneeIds })
const cityLocationPayload = (city: City) => ({ googleMapsUrl: city.googleMapsUrl.trim() })
const resetPlacesOutsideCityDates = (places: Record<string, Place[]>, arrival: string, departure: string) => {
  if (!arrival || !departure) return places
  const unscheduled = [...(places[UNSCHEDULED_KEY] ?? [])]
  const next: Record<string, Place[]> = {}
  for (const [date, items] of Object.entries(places)) {
    if (date === UNSCHEDULED_KEY) continue
    if (date < arrival || date > departure) unscheduled.push(...items)
    else next[date] = items
  }
  if (unscheduled.length) next[UNSCHEDULED_KEY] = unscheduled
  return next
}
const emptyCity = (): City => ({ id: uid(), name: '', googleMapsUrl: '', arrival: '', departure: '', arrivalPeriod: 'morning', departurePeriod: 'evening', hotelNotNeeded: false, hotel: '', hotelUrl: '', hotelCheckInTime: '', hotelCheckOutTime: '', hotelNotes: '', hotelPayerIds: [], hotelTotalAmountRubles: 0, trainIn: '', trainOut: '', transportIn: emptyTransport(), transportOut: emptyTransport(), ticketAssigneeIds: [], hotelAssigneeIds: [], planAssigneeIds: [], places: {}, files: [] })

const assigneeOptions = (members: TripMember[]) => members.map((member) => ({ value: member.id, label: member.displayName }))

function CityEditor({ trip, initial, rowError, onClearRowError, onSave, onClose }: { trip: Trip; initial?: City; rowError?: string; onClearRowError: () => void; onSave: (city: City) => void; onClose: () => void }) {
  const [city, setCity] = useState<City>(() => initial ? { ...initial, arrivalPeriod: initial.arrivalPeriod ?? 'morning', departurePeriod: initial.departurePeriod ?? 'evening' } : emptyCity())
  const [imageError, setImageError] = useState<string | undefined>(rowError)
  const [showErrors, setShowErrors] = useState(false)
  useEffect(() => {
    if (initial) setCity({ ...initial, arrivalPeriod: initial.arrivalPeriod ?? 'morning', departurePeriod: initial.departurePeriod ?? 'evening' })
  }, [initial?.updatedAt])
  const sameDayPeriodsValid = city.arrival !== city.departure || periodOrder[city.departurePeriod ?? 'evening'] >= periodOrder[city.arrivalPeriod ?? 'morning']
  const valid = city.name.trim() && city.arrival && city.departure && city.departure >= city.arrival && sameDayPeriodsValid
  const tripDates = dateRange(trip.startDate, trip.endDate)
  const departureDates = tripDates.filter((date) => !city.arrival || date >= city.arrival)
  const hasImage = Boolean(city.imageFile || city.image || city.imageUrl)
  const members = trip.members ?? []
  const canAssign = trip.role === 'owner' || !trip.id
  const initialCitySignature = initial ? JSON.stringify({ ...initial, arrivalPeriod: initial.arrivalPeriod ?? 'morning', departurePeriod: initial.departurePeriod ?? 'evening' }) : ''
  const cityChanged = JSON.stringify(city) !== initialCitySignature
  return (
    <form className="setup-transition" onSubmit={(event) => { event.preventDefault(); setShowErrors(true); if (valid && cityChanged) onSave(city) }}>
      <FormPanelLayout action={<Button type="submit" disabled={!valid || !cityChanged}>Сохранить город</Button>}>
        <FormPanelHeader title={initial ? city.name : 'Добавить город'} action={<IconButton type="button" icon={<Icon name="close" />} onClick={onClose} aria-label="Закрыть" />} />
        <ImageFilePicker onSelect={(file, previewUrl) => { const error = imageFileError(file); setImageError(error); if (!error) { onClearRowError(); setCity((current) => ({ ...current, imageFile: file, imageUrl: previewUrl })) } }}>
          {({ open, clearPreview }) => <InfoRow image={hasImage ? city.imageUrl || cityPlaceholder : undefined} imageAlt="Фото города" title="Фото города" titleStyle="text" subtitle={hasImage ? city.imageFile?.name || city.image?.name || 'Фото города' : 'В формате JPG, PNG, WEBP до 15 МБ'} error={imageError} actionTheme="secondary" actions={hasImage ? [{ icon: <Icon name="edit" />, label: 'Выбрать новое фото города', onClick: open }, { icon: <Icon name="delete-forever" />, label: 'Удалить фото города', onClick: () => { clearPreview(); setImageError(undefined); setCity((current) => ({ ...current, imageDeleteId: current.image?.id, image: undefined, imageFile: undefined, imageUrl: undefined })) } }] : [{ icon: <Icon name="add-plus" />, label: 'Прикрепить фото города', onClick: open }]} />}
        </ImageFilePicker>
        <FormPanelGroup>
          <FormControlList headline="Куда едем">
            <FormControlRow><Input label="Название города" icon={<Icon name="planet" />} value={city.name} onChange={(event) => setCity({ ...city, name: event.target.value })} placeholder="Например, Осака" error={showErrors && !city.name.trim() ? 'Нужно ввести название города' : undefined} /></FormControlRow>
            <FormControlRow><Input label="Ссылка Google Maps" icon={<Icon name="link" />} type="url" value={city.googleMapsUrl} onChange={(event) => setCity({ ...city, googleMapsUrl: event.target.value })} /></FormControlRow>
          </FormControlList>
        </FormPanelGroup>
        <FormPanelGroup>
          <FormControlList headline="Когда едем">
            <FormControlRow columns={2}>
              <Select type="date" label="Прибытие" placeholder="Приедем" icon={<Icon name="calendar-month" />} value={city.arrival} error={showErrors && !city.arrival ? 'Нужно выбрать дату прибытия' : undefined} onChange={(event) => { const arrival = event.target.value; setCity((current) => { const departure = current.departure < arrival ? '' : current.departure; return { ...current, arrival, departure, places: resetPlacesOutsideCityDates(current.places, arrival, departure) } }) }}>{tripDates.map((date) => <option key={date} value={date}>{formatDate(date)} · {ruWeekdays[parseDate(date).getDay()]}</option>)}</Select>
              <Select type="date" label="Отъезд" placeholder="Уедем" icon={<Icon name="calendar-month" />} value={city.departure} disabled={!city.arrival} error={showErrors && city.arrival && !city.departure ? 'Нужно выбрать дату отъезда' : showErrors && city.departure < city.arrival ? 'Дата отъезда не может быть раньше даты прибытия' : undefined} onChange={(event) => { const departure = event.target.value; setCity((current) => ({ ...current, departure, places: resetPlacesOutsideCityDates(current.places, current.arrival, departure) })) }}>{departureDates.map((date) => <option key={date} value={date}>{formatDate(date)} · {ruWeekdays[parseDate(date).getDay()]}</option>)}</Select>
            </FormControlRow>
            <FormControlRow columns={2}>
              <Select type="time" icon={<Icon name="time" />} aria-label="Время прибытия" value={city.arrivalPeriod ?? 'morning'} onChange={(event) => setCity((current) => ({ ...current, arrivalPeriod: event.target.value as DayPeriod }))}><option value="morning">Утро</option><option value="day">День</option><option value="evening">Вечер</option></Select>
              <Select type="time" icon={<Icon name="time" />} aria-label="Время отъезда" value={city.departurePeriod ?? 'evening'} error={showErrors && !sameDayPeriodsValid ? 'Время отъезда не может быть раньше времени прибытия' : undefined} onChange={(event) => setCity((current) => ({ ...current, departurePeriod: event.target.value as DayPeriod }))}><option value="morning">Утро</option><option value="day">День</option><option value="evening">Вечер</option></Select>
            </FormControlRow>
          </FormControlList>
        </FormPanelGroup>
        <FormPanelGroup>
          <FormControlList headline="Кто отвечает за город">
            <FormControlRow><Select type="assignee" options={assigneeOptions(members)} value={city.ticketAssigneeIds} icon={<Icon name="ticket" />} emptyLabel="Кто покупает билет" disabled={!canAssign} onValueChange={(ticketAssigneeIds) => setCity((current) => ({ ...current, ticketAssigneeIds }))} /></FormControlRow>
            <FormControlRow><Select type="assignee" options={assigneeOptions(members)} value={city.hotelAssigneeIds} icon={<Icon name="hotel" />} emptyLabel="Кто бронит отель" disabled={!canAssign || city.hotelNotNeeded} onValueChange={(hotelAssigneeIds) => setCity((current) => ({ ...current, hotelAssigneeIds }))} /></FormControlRow>
            <CheckboxTextRow checked={city.hotelNotNeeded} disabled={!canAssign} onClick={() => setCity((current) => ({ ...current, hotelNotNeeded: !current.hotelNotNeeded, hotelAssigneeIds: !current.hotelNotNeeded ? [] : current.hotelAssigneeIds }))}>Отель не нужен</CheckboxTextRow>
            <FormControlRow><Select type="assignee" options={assigneeOptions(members)} value={city.planAssigneeIds} icon={<Icon name="barefoot" />} emptyLabel="Кто составляет маршрут" disabled={!canAssign} onValueChange={(planAssigneeIds) => setCity((current) => ({ ...current, planAssigneeIds }))} /></FormControlRow>
          </FormControlList>
        </FormPanelGroup>
      </FormPanelLayout>
    </form>
  )
}

function AllCitiesEditor({ trip, onSave, onClose }: { trip: Trip; onSave: (cities: City[]) => void; onClose: () => void }) {
  const [cities, setCities] = useState(() => trip.cities.map((city) => ({ ...city })))
  const [showErrors, setShowErrors] = useState(false)
  const citiesSignature = trip.cities.map((city) => `${city.id}:${city.updatedAt ?? ''}`).join('|')
  useEffect(() => setCities(trip.cities.map((city) => ({ ...city }))), [citiesSignature])
  const tripDates = dateRange(trip.startDate, trip.endDate)
  const members = trip.members ?? []
  const canAssign = trip.role === 'owner'
  const updateCity = (id: string, patch: Partial<City>) => setCities((current) => current.map((city) => city.id === id ? { ...city, ...patch } : city))
  const valid = cities.every((city) => {
    const arrivalPeriod = city.arrivalPeriod ?? 'morning'
    const departurePeriod = city.departurePeriod ?? 'evening'
    return city.name.trim() && city.arrival && city.departure && city.departure >= city.arrival && (city.arrival !== city.departure || periodOrder[departurePeriod] >= periodOrder[arrivalPeriod])
  })
  const citiesChanged = JSON.stringify(cities) !== JSON.stringify(trip.cities)

  return (
    <form className="setup-editor-content setup-transition" onSubmit={(event) => { event.preventDefault(); setShowErrors(true); if (valid && citiesChanged) onSave(cities) }}>
      <section className="glass setup-card editing-all">
      <div className="all-cities-editor">
      <IconButton type="button" className="bulk-edit-button" icon={<Icon name="close" />} onClick={onClose} aria-label="Закрыть редактирование" />
      <div className="all-cities-scroll">
        <h2>Все города</h2>
        <div className="all-cities-list">
          {cities.map((city) => {
            const departureDates = tripDates.filter((date) => !city.arrival || date >= city.arrival)
            return (
              <FormControlList className="all-city-fields" gap={24} key={city.id}>
                <FormControlRow><Input label="Название города" icon={<Icon name="planet" />} value={city.name} onChange={(event) => updateCity(city.id, { name: event.target.value })} error={showErrors && !city.name.trim() ? 'Нужно ввести название города' : undefined} /></FormControlRow>
                <FormControlRow><Input label="Ссылка Google Maps" icon={<Icon name="link" />} type="url" value={city.googleMapsUrl} onChange={(event) => updateCity(city.id, { googleMapsUrl: event.target.value })} /></FormControlRow>
                <FormControlRow columns={2}>
                  <label className="field"><span>Прибытие</span><div className="date-time-fields"><Select type="date" placeholder="Приедем" icon={<Icon name="calendar-month" />} value={city.arrival} error={showErrors && !city.arrival ? 'Нужно выбрать дату прибытия' : undefined} onChange={(event) => { const arrival = event.target.value; const departure = city.departure < arrival ? '' : city.departure; updateCity(city.id, { arrival, departure, places: resetPlacesOutsideCityDates(city.places, arrival, departure) }) }}>{tripDates.map((date) => <option key={date} value={date}>{formatDate(date)} · {ruWeekdays[parseDate(date).getDay()]}</option>)}</Select><Select type="time" icon={<Icon name="time" />} aria-label={`Время прибытия в ${city.name}`} value={city.arrivalPeriod ?? 'morning'} onChange={(event) => updateCity(city.id, { arrivalPeriod: event.target.value as DayPeriod })}><option value="morning">Утро</option><option value="day">День</option><option value="evening">Вечер</option></Select></div></label>
                  <label className="field"><span>Отъезд</span><div className="date-time-fields"><Select type="date" placeholder="Уедем" icon={<Icon name="calendar-month" />} value={city.departure} disabled={!city.arrival} error={showErrors && city.arrival && !city.departure ? 'Нужно выбрать дату отъезда' : undefined} onChange={(event) => { const departure = event.target.value; updateCity(city.id, { departure, places: resetPlacesOutsideCityDates(city.places, city.arrival, departure) }) }}>{departureDates.map((date) => <option key={date} value={date}>{formatDate(date)} · {ruWeekdays[parseDate(date).getDay()]}</option>)}</Select><Select type="time" icon={<Icon name="time" />} aria-label={`Время отъезда из ${city.name}`} value={city.departurePeriod ?? 'evening'} error={showErrors && city.arrival === city.departure && periodOrder[city.departurePeriod ?? 'evening'] < periodOrder[city.arrivalPeriod ?? 'morning'] ? 'Время отъезда не может быть раньше времени прибытия' : undefined} onChange={(event) => updateCity(city.id, { departurePeriod: event.target.value as DayPeriod })}><option value="morning">Утро</option><option value="day">День</option><option value="evening">Вечер</option></Select></div></label>
                </FormControlRow>
                <FormControlRow><Select type="assignee" options={assigneeOptions(members)} value={city.ticketAssigneeIds} icon={<Icon name="ticket" />} emptyLabel="Кто покупает билет" disabled={!canAssign} onValueChange={(ticketAssigneeIds) => updateCity(city.id, { ticketAssigneeIds })} /></FormControlRow>
                <FormControlRow><Select type="assignee" options={assigneeOptions(members)} value={city.hotelAssigneeIds} icon={<Icon name="hotel" />} emptyLabel="Кто бронит отель" disabled={!canAssign || city.hotelNotNeeded} onValueChange={(hotelAssigneeIds) => updateCity(city.id, { hotelAssigneeIds })} /></FormControlRow>
                <FormControlRow><label className="city-hotel-toggle city-hotel-toggle-after-assignee"><input type="checkbox" checked={city.hotelNotNeeded} onChange={(event) => updateCity(city.id, { hotelNotNeeded: event.target.checked, ...(event.target.checked ? { hotelAssigneeIds: [] } : {}) })} /><span className={`document-check${city.hotelNotNeeded ? ' checked' : ''}`} aria-hidden="true" /><TextRow showIcon={false}>Отель не нужен</TextRow></label></FormControlRow>
                <FormControlRow><Select type="assignee" options={assigneeOptions(members)} value={city.planAssigneeIds} icon={<Icon name="barefoot" />} emptyLabel="Кто составляет маршрут" disabled={!canAssign} onValueChange={(planAssigneeIds) => updateCity(city.id, { planAssigneeIds })} /></FormControlRow>
              </FormControlList>
            )
          })}
        </div>
      </div>
      </div>
      </section>
      <Button type="submit" disabled={!valid || !citiesChanged}>Сохранить поездку</Button>
    </form>
  )
}

function SetupScreen({ initial, user, refreshToken, rowErrors, onClearRowError, onCreate, onCitySaved, onExit }: { initial: Trip | null; user: CurrentUser | null; refreshToken: number; rowErrors: Record<string, string>; onClearRowError: (key: string) => void; onCreate: (trip: Trip) => Promise<Trip | undefined>; onCitySaved: () => void; onExit: () => void }) {
  const [trip, setTrip] = useState<Trip>(initial ?? { name: '', startDate: '', endDate: '', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', accentColor: DEFAULT_TRIP_ACCENT_COLOR, cities: [], dayDescriptions: {}, members: user ? [{ id: user.id, email: user.email, displayName: user.displayName, role: 'owner', hasAvatar: user.hasAvatar, avatarUrl: user.avatarUrl }] : [] })
  const [showErrors, setShowErrors] = useState(false)
  const [savedSignature, setSavedSignature] = useState(() => initial ? JSON.stringify(initial) : '')
  const [hasSaved, setHasSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const accentColor = trip.accentColor || DEFAULT_TRIP_ACCENT_COLOR
  const [accentPaletteOpen, setAccentPaletteOpen] = useState(false)
  const [backgroundError, setBackgroundError] = useState<string | undefined>(rowErrors.background)
  useEffect(() => { if (rowErrors.background) setBackgroundError(rowErrors.background) }, [rowErrors.background])
  const [accentPalettePosition, setAccentPalettePosition] = useState({ right: 0, bottom: 0 })
  const accentPaletteRef = useRef<HTMLDivElement>(null)
  const [editing, setEditing] = useState<City | null | undefined>(undefined)
  const [editingAll, setEditingAll] = useState(false)
  const [deleteCityTarget, setDeleteCityTarget] = useState<City | null>(null)
  const backgroundReady = useTripBackgroundReady(trip)
  useEffect(() => {
    if (!initial || refreshToken === 0) return
    setTrip(initial)
    setSavedSignature(JSON.stringify(initial))
    setHasSaved(false)
    setEditing((current) => current === undefined || current === null ? current : initial.cities.find((city) => city.id === current.id))
  }, [initial, refreshToken])
  useEffect(() => {
    if (!accentPaletteOpen) return
    const close = (event: PointerEvent) => {
      if (!accentPaletteRef.current?.contains(event.target as Node)) setAccentPaletteOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [accentPaletteOpen])
  const access = useAccess()
  const datesValid = trip.startDate && trip.endDate && trip.endDate >= trip.startDate
  const cityDatesValid = (city: City) => Boolean(datesValid && city.arrival >= trip.startDate && city.departure <= trip.endDate)
  const allCityDatesValid = trip.cities.every(cityDatesValid)
  const tripDays = datesValid ? daysBetween(trip.startDate, trip.endDate) : 0
  const hasBackground = !trip.backgroundRemoved && Boolean(trip.backgroundFile || trip.background || trip.backgroundUrl)
  const upsertCity = (city: City) => {
    const exists = trip.cities.some((item) => item.id === city.id)
    const cities = exists ? trip.cities.map((item) => item.id === city.id ? city : item) : [...trip.cities, city]
    setTrip({ ...trip, cities: sortCitiesByDate(cities) })
    setEditing(undefined)
    onCitySaved()
  }
  const tripSignature = JSON.stringify(trip)
  return (
    <main className={tripBackgroundClassName('screen trip-background setup-screen', backgroundReady)} style={tripBackgroundStyle(trip)}>
      <IconButton className="back-button" size="l" icon={<Icon name="arrow-back" />} onClick={onExit} aria-label="Назад" />
      {editingAll ? (
          <AllCitiesEditor key={`all-cities:${refreshToken}`} trip={trip} onClose={() => setEditingAll(false)} onSave={(cities) => { setTrip((current) => ({ ...current, cities: sortCitiesByDate(cities) })); setEditingAll(false) }} />
        ) : deleteCityTarget ? (
          <DeleteCityDialog city={deleteCityTarget} onClose={() => setDeleteCityTarget(null)} onConfirm={() => { const city = deleteCityTarget; setTrip((current) => ({ ...current, cities: current.cities.filter((item) => item.id !== city.id), deletedCityIds: city.updatedAt ? [...new Set([...(current.deletedCityIds ?? []), city.id])] : current.deletedCityIds })); setDeleteCityTarget(null) }} />
        ) : editing !== undefined ? (
          <CityEditor key={`city:${editing?.id ?? 'new'}:${refreshToken}`} trip={trip} initial={editing ?? undefined} rowError={editing ? rowErrors[`city-image:${editing.id}`] : undefined} onClearRowError={() => { if (editing) onClearRowError(`city-image:${editing.id}`) }} onSave={upsertCity} onClose={() => setEditing(undefined)} />
        ) : (
          <FormPanelLayout className="setup-transition" action={trip.cities.length > 0 && <Button disabled={!access.canEdit || busy || savedSignature === tripSignature} onClick={() => { setShowErrors(true); if (!trip.name.trim() || !datesValid || !allCityDatesValid) return; setBusy(true); void onCreate(trip).then((saved) => { if (!saved) return; setTrip(saved); setSavedSignature(JSON.stringify(saved)); setHasSaved(true) }).finally(() => setBusy(false)) }}>{busy ? 'Сохраняем…' : hasSaved && savedSignature === tripSignature ? 'Изменения сохранены' : 'Сохранить поездку'}</Button>}>
            <FormPanelHeader title={trip.name || (initial ? 'Поездка' : 'Добавить поездку')} text={<>{datesValid && <>{formatDays(tripDays)} · </>}{formatTimeZoneOffset(trip.timeZone, trip.startDate)}</>} />
            <FormPanelGroup>
              <FormControlList headline="О поездке">
                <FormControlRow><Input label="Название поездки" icon={<Icon name="book" />} value={trip.name} onChange={(event) => setTrip((current) => ({ ...current, name: event.target.value }))} placeholder="Например, Аниме Тур" error={showErrors && !trip.name.trim() ? 'Нужно ввести название поезки' : undefined} /></FormControlRow>
                <FormControlRow columns={2}>
                  <DateInput label="Начало" icon={<Icon name="calendar-month" />} value={trip.startDate} displayValue={trip.startDate ? `${formatDate(trip.startDate)} · ${ruWeekdays[parseDate(trip.startDate).getDay()]}` : 'Выбрать дату'} error={showErrors && !trip.startDate ? 'Нужно выбрать дату начала' : undefined} onChange={(event) => { const value = event.target.value; setTrip((current) => ({ ...current, startDate: value, endDate: current.endDate < value ? '' : current.endDate })) }} />
                  <DateInput label="Окончание" icon={<Icon name="calendar-month" />} min={trip.startDate} disabled={!trip.startDate} value={trip.endDate} displayValue={trip.endDate ? `${formatDate(trip.endDate)} · ${ruWeekdays[parseDate(trip.endDate).getDay()]}` : 'Выбрать дату'} error={showErrors && trip.startDate && !trip.endDate ? 'Нужно выбрать дату окончания' : showErrors && trip.endDate < trip.startDate ? 'Дата окончания не может быть раньше даты начала' : undefined} onChange={(event) => { const value = event.target.value; setTrip((current) => ({ ...current, endDate: value })) }} />
                </FormControlRow>
              </FormControlList>
            </FormPanelGroup>
            <FormPanelGroup gap={8}>
              <InfoRowList headline="Список городов">
                {trip.cities.map((city) => <InfoRow key={city.id} image={city.imageUrl || cityPlaceholder} imageAlt="Изображение города" imageFallback={cityPlaceholder} title={city.name} titleStyle="text" subtitle={`${formatShortRange(city.arrival, city.departure)} · ${formatDays(cityDays(city))}${city.hotelNotNeeded ? ' · Отель не нужен' : ''}`} error={showErrors && !cityDatesValid(city) ? 'Даты города находятся вне дат поездки' : rowErrors[`city-image:${city.id}`]} onClick={() => setEditing(city)} actionTheme="secondary" hoverEffect actions={[{ icon: <Icon name="delete-forever" />, label: `Удалить город ${city.name}`, onClick: () => { const hasContents = Object.values(city.places).some((places) => places.length > 0) || city.files.length > 0 || Boolean(city.image || city.imageFile); if (hasContents) { setDeleteCityTarget(city); return } if (!window.confirm(`Удалить город «${city.name}» из маршрута?`)) return; setTrip((current) => ({ ...current, cities: current.cities.filter((item) => item.id !== city.id), deletedCityIds: city.updatedAt ? [...new Set([...(current.deletedCityIds ?? []), city.id])] : current.deletedCityIds })) } }]} />)}
                <AddRow icon={<Icon name="add-plus" />} disabled={!datesValid} onClick={() => setEditing(null)} aria-label="Добавить город" />
              </InfoRowList>
            </FormPanelGroup>
            <FormPanelGroup>
              <FormControlList headline="Часовой пояс">
                <FormControlRow><Select type="time" icon={<Icon name="time" />} aria-label="Основной часовой пояс поездки" value={trip.timeZone} displayValue={formatTimeZoneOffset(trip.timeZone, trip.startDate)} onChange={(event) => setTrip((current) => ({ ...current, timeZone: event.target.value }))}>{timeZones.map((zone) => <option key={zone} value={zone}>{formatTimeZoneOption(zone, trip.startDate)}</option>)}</Select></FormControlRow>
              </FormControlList>
            </FormPanelGroup>
            <InfoRowList className="trip-appearance-rows" headline="Оформление">
              <ImageFilePicker onSelect={(file, previewUrl) => { const error = imageFileError(file); setBackgroundError(error); if (!error) { onClearRowError('background'); setTrip((current) => ({ ...current, backgroundFile: file, backgroundUrl: previewUrl, backgroundRemoved: false })) } }}>
                {({ open, clearPreview }) => <InfoRow image={hasBackground ? trip.backgroundUrl || defaultTripBackground : undefined} imageAlt="Фоновое фото поездки" title="Фоновое фото" titleStyle="text" subtitle={hasBackground ? trip.backgroundFile?.name || trip.background?.name || 'autumn-garden.jpg' : 'В формате JPG, PNG, WEBP до 15 МБ'} error={backgroundError} actionTheme="secondary" actions={hasBackground ? [{ icon: <Icon name="edit" />, label: 'Выбрать новое фоновое фото', onClick: open }, { icon: <Icon name="delete-forever" />, label: 'Удалить фоновое фото', onClick: () => { clearPreview(); setBackgroundError(undefined); setTrip((current) => ({ ...current, backgroundRemoved: true, backgroundDeleteId: current.background?.id, background: undefined, backgroundFile: undefined, backgroundUrl: undefined })) } }] : [{ icon: <Icon name="add-plus" />, label: 'Прикрепить фоновое фото', onClick: open }]} />}
              </ImageFilePicker>
              <InfoRow image={`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="24" fill="${accentColor}"/><g transform="translate(12 12)"><circle cx="12" cy="12" r="9" fill="none" stroke="white" stroke-width="2"/><path d="M9.66667 16H9C8.44772 16 8 15.5523 8 15V10.2019C8 9.8675 8.1671 9.55527 8.4453 9.3698L11.4453 7.3698C11.7812 7.14587 12.2188 7.14587 12.5547 7.3698L15.5547 9.3698C15.8329 9.55527 16 9.8675 16 10.2019V15C16 15.5523 15.5523 16 15 16H14.3333C13.781 16 13.3333 15.5523 13.3333 15V12.5C13.3333 12.2239 13.1095 12 12.8333 12H11.1667C10.8905 12 10.6667 12.2239 10.6667 12.5V15C10.6667 15.5523 10.219 16 9.66667 16Z" fill="white"/></g></svg>`)}`} imageAlt={`Цвет ${accentColor}`} imageShape="circle" title="Цвет поездки" titleStyle="text" subtitle="Будет применяться к точкам на карте и галочкам" actionTheme="secondary" actions={[{ icon: <Icon name="edit" />, label: 'Изменить цвет поездки', onClick: (event) => { const rect = event.currentTarget.getBoundingClientRect(); setAccentPalettePosition({ right: window.innerWidth - rect.right, bottom: window.innerHeight - rect.top + 4 }); setAccentPaletteOpen((open) => !open) } }, { icon: <Icon name="delete-forever" />, label: 'Сбросить цвет поездки', onClick: () => { setTrip((current) => ({ ...current, accentColor: DEFAULT_TRIP_ACCENT_COLOR })); setAccentPaletteOpen(false) } }]} />
            </InfoRowList>
            {accentPaletteOpen && createPortal(<div ref={accentPaletteRef} className="trip-color-palette glass" style={accentPalettePosition} role="listbox" aria-label="Цвет поездки">{TRIP_ACCENT_COLORS.map((color) => <button key={color} type="button" role="option" aria-selected={color === accentColor} aria-label={color} style={{ backgroundColor: color }} onClick={() => setTrip((current) => ({ ...current, accentColor: color }))} />)}</div>, document.body)}
          </FormPanelLayout>
        )}
    </main>
  )
}

function DocumentStatus({ checked, children, onClick }: { checked: boolean; children: React.ReactNode; onClick?: () => void }) {
  return <button type="button" className="document-row" onClick={onClick}><TextRow iconType="checkbox" checkboxState={checked ? 'on' : 'off'}>{children}</TextRow></button>
}

const isTransportComplete = (details: TransportDetails | undefined, ticketName: string) => Boolean(
  details
  && (ticketName.trim() || (details.type !== 'plane' && details.ticketOnSite))
  && (details.ticketOnSite || (details.departureTime.trim() && details.arrivalTime.trim())),
)

const isHotelComplete = (city: City) => Boolean(city.hotel.trim() && city.hotelUrl.trim() && city.hotelCheckInTime?.trim() && city.hotelCheckOutTime?.trim() && city.files.some((file) => file.category === 'hotel-booking'))

const transportEmoji: Record<TransportType, string> = { train: '🚆', plane: '✈️', bus: '🚌', ship: '⛴️' }
const TransportLabel = ({ label, type }: { label: string; type?: TransportType }) => <span className="transport-label">{type && <span className="transport-emoji" aria-hidden="true">{transportEmoji[type]}</span>}<span>{label}</span></span>
const assigneeNames = (ids: string[], members: TripMember[]) => members.filter((member) => ids.includes(member.id)).map((member) => member.displayName).join(', ')
const withAssignees = (label: string, ids: string[], members: TripMember[]) => {
  const names = assigneeNames(ids, members)
  return names ? `${label} (${names})` : label
}
const TICKET_ON_SITE_PAGE_TEXT = 'Билет купить на месте'
const TICKET_ON_SITE_SUMMARY_TEXT = '(купить на месте)'
const withTicketOnSiteSummary = (travelTimes: string, durationLabel: string | undefined, ticketOnSite: boolean | undefined) => {
  if (ticketOnSite) return TICKET_ON_SITE_SUMMARY_TEXT
  const duration = durationLabel ? `(${durationLabel.charAt(0).toLocaleLowerCase('ru-RU')}${durationLabel.slice(1)})` : ''
  return [travelTimes, duration].filter(Boolean).join(' ')
}
const withTicketDetails = (label: string, ticketOnSite: boolean | undefined, ids: string[], members: TripMember[]) => ticketOnSite ? `${label} ${TICKET_ON_SITE_SUMMARY_TEXT}` : withAssignees(label, ids, members)

function TripSidebar({ trip, user, tripCount, selectedCityId, cacheState, online, onCity, onHotel, onTransport, onExpenses, onEdit, onInvite, onTrips, onProfile }: { trip: Trip; user: CurrentUser | null; tripCount: number; selectedCityId?: string | null; cacheState: CacheState; online: boolean; onCity: (city: City) => void; onHotel: (city: City) => void; onTransport: (city: City, direction: 'in' | 'out') => void; onExpenses: () => void; onEdit: () => void; onInvite: () => void; onTrips: () => void; onProfile: () => void }) {
  const access = useAccess()
  const daysLeft = Math.ceil((parseDate(trip.startDate).getTime() - new Date().getTime()) / 86400000)
  const isAdmin = user?.email.toLowerCase() === ADMIN_EMAIL
  const showTrips = tripCount > 1 || isAdmin
  const members = trip.members ?? []
  const hotelCities = trip.cities.filter((city) => !city.hotelNotNeeded)
  const completedHotels = hotelCities.filter(isHotelComplete).length
  const completedArrival = trip.cities[0] && isTransportComplete(trip.cities[0].transportIn, trip.cities[0].trainIn) ? 1 : 0
  const completedTransfers = trip.cities.slice(0, -1).filter((city, index) => {
    const nextCity = trip.cities[index + 1]
    return isTransportComplete(city.transportOut, city.trainOut) || isTransportComplete(nextCity.transportIn, nextCity.trainIn)
  }).length
  const lastCity = trip.cities.at(-1)
  const completedDeparture = lastCity && isTransportComplete(lastCity.transportOut, lastCity.trainOut) ? 1 : 0
  const readinessTotal = trip.cities.length > 0 ? hotelCities.length + trip.cities.length + 1 : 0
  const readinessPercent = readinessTotal > 0 ? Math.round(((completedHotels + completedArrival + completedTransfers + completedDeparture) / readinessTotal) * 100) : 0
  const countdownText = daysLeft > 0 ? `Едем через ${formatDays(daysLeft)}` : daysLeft === 0 ? 'Поездка начинается сегодня' : 'Путешествие уже началось'
  return (
    <aside className="sidebar">
      <section className="glass sidebar-card trip-summary">
        <TypographyGroup title={<><CacheIndicator state={cacheState} online={online} />{trip.name}</>} text={<>{formatLongRange(trip.startDate, trip.endDate)} · {formatDays(daysBetween(trip.startDate, trip.endDate) + 1)} · {!access.canBrowse ? <span>{formatParticipants(Math.max(1, trip.memberCount ?? 0))}</span> : <button type="button" className="participants-link" onClick={onInvite}>{formatParticipants(Math.max(1, trip.members?.length ?? 0))}</button>}</>} />
        <InfoRowList rowTheme="transparent">{trip.cities.map((city, index) => {
          const previousCity = trip.cities[index - 1]
          const ticketComplete = previousCity
            ? isTransportComplete(previousCity.transportOut, previousCity.trainOut) || isTransportComplete(city.transportIn, city.trainIn)
            : isTransportComplete(city.transportIn, city.trainIn)
          const hotelComplete = isHotelComplete(city)
          return (
            <InfoRow
              key={city.id}
              className={city.id === selectedCityId ? 'selected' : ''}
              theme="transparent"
              image={city.imageUrl || cityPlaceholder}
              imageAlt="Изображение города"
              imageFallback={cityPlaceholder}
              title={city.name}
              subtitle={`${formatShortRange(city.arrival, city.departure)} · ${formatDays(cityDays(city))}`}
              onClick={access.canBrowse ? () => onCity(city) : undefined}
              actionTheme="secondary"
              hoverEffect
              showActionIndicators
              actions={access.canBrowse ? [
                ...(!city.hotelNotNeeded ? [{ icon: <Icon name="hotel" />, label: `Отель в ${city.name}`, title: `Отель в ${city.name}`, onClick: () => onHotel(city), complete: hotelComplete }] : []),
                { icon: <Icon name="ticket" />, label: `Билет в ${city.name}`, title: `Билет в ${city.name}`, onClick: () => previousCity ? onTransport(previousCity, 'out') : onTransport(city, 'in'), complete: ticketComplete },
              ] : []}
            />
          )
        })}</InfoRowList>
        {access.canManageTrip && <div className="trip-summary-actions">
          <Button size="m" onClick={onEdit}>Редактировать</Button>
          <Button size="m" theme="secondary" onClick={onInvite}>Участники и шеринг</Button>
        </div>}
      </section>
      {access.canBrowse && <section className="glass sidebar-card links-card">
        <TypographyGroup className="readiness-heading" title="Готовность к поездке" text={`${countdownText} · Готовность ${readinessPercent}%`} />
        {hotelCities.length > 0 && <ItemList headline="Жильё">{hotelCities.map((city) => <DocumentStatus key={city.id} checked={isHotelComplete(city)} onClick={() => onHotel(city)}>{withAssignees(city.name, city.hotelAssigneeIds, members)}</DocumentStatus>)}</ItemList>}
        <ItemList headline="Транспорт" className={hotelCities.length > 0 ? 'readiness-transport-list' : undefined}>
          {trip.cities[0] && <DocumentStatus checked={isTransportComplete(trip.cities[0].transportIn, trip.cities[0].trainIn)} onClick={() => onTransport(trip.cities[0], 'in')}><TransportLabel label={withTicketDetails(`Дом – ${trip.cities[0].name}`, trip.cities[0].transportIn?.ticketOnSite, trip.cities[0].ticketAssigneeIds, members)} type={trip.cities[0].transportIn?.type} /></DocumentStatus>}
          {trip.cities.slice(0, -1).map((city, index) => {
            const nextCity = trip.cities[index + 1]
            const checked = isTransportComplete(city.transportOut, city.trainOut) || isTransportComplete(nextCity.transportIn, nextCity.trainIn)
            const type = city.transportOut?.type ?? nextCity.transportIn?.type
            const ticketOnSite = city.transportOut?.ticketOnSite || nextCity.transportIn?.ticketOnSite
            return <DocumentStatus key={`${city.id}:${nextCity.id}`} checked={checked} onClick={() => onTransport(city, 'out')}><TransportLabel label={withTicketDetails(`${city.name} – ${nextCity.name}`, ticketOnSite, nextCity.ticketAssigneeIds, members)} type={type} /></DocumentStatus>
          })}
          {trip.cities.at(-1) && <DocumentStatus checked={isTransportComplete(trip.cities.at(-1)!.transportOut, trip.cities.at(-1)!.trainOut)} onClick={() => onTransport(trip.cities.at(-1)!, 'out')}><TransportLabel label={withTicketDetails(`${trip.cities.at(-1)!.name} – Дом`, trip.cities.at(-1)!.transportOut?.ticketOnSite, trip.cities.at(-1)!.ticketAssigneeIds, members)} type={trip.cities.at(-1)!.transportOut?.type} /></DocumentStatus>}
        </ItemList>
        <Button size="m" theme="secondary" onClick={onExpenses}>Посмотреть траты</Button>
      </section>}
      {user && <section className="glass sidebar-card profile-card">
        <InfoRow className="profile-info-row" theme="transparent" image={user.avatarUrl || `${import.meta.env.BASE_URL}assets/person-owner.png`} imageAlt="Аватар профиля" imageShape="circle" title={user.displayName} subtitle={user.email} onClick={onProfile} hoverEffect />
        {(showTrips || isAdmin) && <div className="profile-card-actions">
          {showTrips && <Button size="m" onClick={onTrips}>Мои поездки</Button>}
          {isAdmin && <Button size="m" theme="secondary" onClick={() => window.location.assign(`${import.meta.env.BASE_URL}components`)}>Компоненты</Button>}
          {isAdmin && <Button size="m" theme="secondary" onClick={() => window.location.assign(`${import.meta.env.BASE_URL}components?view=content`)}>Контент</Button>}
        </div>}
        {isAdmin && <p className="profile-card-version type-text-s">Версия {appVersion}</p>}
      </section>}
    </aside>
  )
}

type TripExpense = { id: string; title: string; payerIds: string[]; totalAmountRubles: number; transportType?: TransportType }

const hasExpense = (details: TransportDetails | undefined) => Boolean(details && details.totalAmountRubles > 0)
const formatRubles = (value: number) => `${value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`
const formatExpenseRecords = (count: number) => `${count} ${count % 10 === 1 && count % 100 !== 11 ? 'запись' : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? 'записи' : 'записей'}`

function tripExpenses(trip: Trip): { hotels: TripExpense[]; transport: TripExpense[] } {
  const hotels = trip.cities
    .filter((city) => city.hotelTotalAmountRubles > 0)
    .map((city) => ({ id: `hotel:${city.id}`, title: `🏨 ${city.name} — ${city.hotel.trim() || 'Жильё'}`, payerIds: city.hotelPayerIds, totalAmountRubles: city.hotelTotalAmountRubles }))
  const transport: TripExpense[] = []
  const firstCity = trip.cities[0]
  if (firstCity && hasExpense(firstCity.transportIn)) transport.push({ id: `transport-in:${firstCity.id}`, title: `Дом – ${firstCity.name}`, payerIds: firstCity.transportIn.payerIds, totalAmountRubles: firstCity.transportIn.totalAmountRubles, transportType: firstCity.transportIn.type })
  trip.cities.slice(0, -1).forEach((city, index) => {
    const nextCity = trip.cities[index + 1]
    const details = hasExpense(city.transportOut) ? city.transportOut : nextCity.transportIn
    if (!hasExpense(details)) return
    transport.push({ id: `transport:${city.id}:${nextCity.id}`, title: `${city.name} – ${nextCity.name}`, payerIds: details.payerIds, totalAmountRubles: details.totalAmountRubles, transportType: details.type })
  })
  const lastCity = trip.cities.at(-1)
  if (lastCity && hasExpense(lastCity.transportOut)) transport.push({ id: `transport-out:${lastCity.id}`, title: `${lastCity.name} – Дом`, payerIds: lastCity.transportOut.payerIds, totalAmountRubles: lastCity.transportOut.totalAmountRubles, transportType: lastCity.transportOut.type })
  return { hotels, transport }
}

function ExpensesScreen({ trip, onBack }: { trip: Trip; onBack: () => void }) {
  const backgroundReady = useTripBackgroundReady(trip)
  const expenses = tripExpenses(trip)
  const members = trip.members ?? []
  const allExpenses = [...expenses.hotels, ...expenses.transport]
  const memberExpenses = members.map((member) => {
    const records = allExpenses.filter((expense) => expense.payerIds.includes(member.id))
    return {
      member,
      records: records.length,
      totalAmountRubles: records.reduce((sum, expense) => sum + expense.totalAmountRubles / expense.payerIds.length, 0),
    }
  }).filter((summary) => summary.records > 0)
  const categoryTotal = (items: TripExpense[]) => items.reduce((sum, expense) => sum + expense.totalAmountRubles, 0)
  const expenseRow = (expense: TripExpense) => {
    const payers = assigneeNames(expense.payerIds, members) || 'Плательщик не указан'
    const paymentText = expense.payerIds.length === 1
      ? `${payers} · ${formatRubles(expense.totalAmountRubles)}`
      : expense.payerIds.length > 1
        ? `${payers} · По ${formatRubles(expense.totalAmountRubles / expense.payerIds.length)}`
        : payers
    return <InfoRow key={expense.id} title={expense.transportType ? <TransportLabel label={expense.title} type={expense.transportType} /> : expense.title} titleStyle="text" subtitle={paymentText} trailing={formatRubles(expense.totalAmountRubles)} />
  }
  return (
    <main className={tripBackgroundClassName('transport-editor-screen trip-background setup-transition', backgroundReady)} style={tripBackgroundStyle(trip)}>
      <IconButton type="button" className="back-button" size="l" icon={<Icon name="arrow-back" />} onClick={onBack} aria-label="Назад" title="Назад" />
      <FormPanelLayout>
        <FormPanelHeader title="Траты" text={`Всего ${formatRubles(allExpenses.reduce((sum, expense) => sum + expense.totalAmountRubles, 0))}`} />
        {allExpenses.length === 0 && <FormPanelGroup><FormPanelNote centered>Трат пока нет</FormPanelNote></FormPanelGroup>}
        {expenses.hotels.length > 0 && <FormPanelGroup><InfoRowList headline="Жильё" text={`Всего ${formatRubles(categoryTotal(expenses.hotels))}`}>{expenses.hotels.map(expenseRow)}</InfoRowList></FormPanelGroup>}
        {expenses.transport.length > 0 && <FormPanelGroup><InfoRowList headline="Транспорт" text={`Всего ${formatRubles(categoryTotal(expenses.transport))}`}>{expenses.transport.map(expenseRow)}</InfoRowList></FormPanelGroup>}
        {memberExpenses.length > 0 && <FormPanelGroup><InfoRowList headline="Итого по людям">{memberExpenses.map(({ member, records, totalAmountRubles }) => <InfoRow key={member.id} image={member.avatarUrl || `${import.meta.env.BASE_URL}assets/${member.role === 'owner' ? 'person-owner.png' : 'person-member.png'}`} imageAlt={`Аватар ${member.displayName}`} imageShape="circle" title={member.displayName} titleStyle="text" subtitle={formatExpenseRecords(records)} trailing={formatRubles(totalAmountRubles)} />)}</InfoRowList></FormPanelGroup>}
      </FormPanelLayout>
    </main>
  )
}

function DayCard({ date, cities, allCities, tripTimeZone, description, hidden, onEvent, onCity, onPlace, onDescriptionChange }: { date: string; cities: City[]; allCities: City[]; tripTimeZone: string; description: string; hidden: boolean; onEvent: (city: City, panel: 'hotel' | 'in' | 'out') => void; onCity: (city: City) => void; onPlace: (city: City, placeId: string) => void; onDescriptionChange: (description: string) => void }) {
  const day = parseDate(date)
  const [descriptionDraft, setDescriptionDraft] = useState(description)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const access = useAccess()
  useEffect(() => setDescriptionDraft(description), [description])
  useLayoutEffect(() => {
    const textarea = descriptionRef.current
    if (!textarea) return
    textarea.style.height = '0'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [descriptionDraft])
  type DayEvent = { key: string; title: string; subtitle?: string; icon?: IconName; city: City; panel?: 'hotel' | 'in' | 'out'; interactive?: boolean; kind: 'hotel-out' | 'transfer' | 'hotel-in' | 'city'; departureName?: string; departureUrl?: string; departureCity?: City; arrivalName?: string; arrivalUrl?: string; arrivalCity?: City }
  const events: DayEvent[] = []
  const transferCityIds = new Set<string>()
  allCities.slice(0, -1).forEach((departureCity, index) => {
    const arrivalCity = allCities[index + 1]
    if (departureCity.departure !== date || arrivalCity.arrival !== date) return
    transferCityIds.add(departureCity.id)
    transferCityIds.add(arrivalCity.id)
    if (!departureCity.hotelNotNeeded) {
      const checkOutTime = departureCity.hotelCheckOutTime.trim()
      events.push({ key: `${departureCity.id}:check-out`, title: departureCity.hotel.trim() || 'Отель', subtitle: checkOutTime ? `Выселение до ${checkOutTime}` : 'Выселение', icon: 'hotel', city: departureCity, panel: 'hotel', interactive: Boolean(departureCity.hotel.trim() || departureCity.hotelUrl.trim()), kind: 'hotel-out' })
    }
    const outgoing = departureCity.transportOut
    const incoming = arrivalCity.transportIn
    const departureTime = outgoing.departureTime.trim() || incoming.departureTime.trim()
    const arrivalTime = outgoing.arrivalTime.trim() || incoming.arrivalTime.trim()
    const durationLabel = formatTravelDuration(departureTime, arrivalTime, outgoing.departureDate || incoming.departureDate || departureCity.departure, outgoing.arrivalDate || incoming.arrivalDate || arrivalCity.arrival, outgoing.departureTimeZone || incoming.departureTimeZone || tripTimeZone, outgoing.arrivalTimeZone || incoming.arrivalTimeZone || tripTimeZone)
    const travelTimes = formatTravelTimes(departureTime, arrivalTime)
    const hasOutgoingDetails = Boolean(departureCity.trainOut || outgoing.type || outgoing.departureTime.trim() || outgoing.arrivalTime.trim() || outgoing.departureStation.trim() || outgoing.arrivalStation.trim())
    const hasIncomingDetails = Boolean(arrivalCity.trainIn || incoming.type || incoming.departureTime.trim() || incoming.arrivalTime.trim() || incoming.departureStation.trim() || incoming.arrivalStation.trim())
    const departurePlace = outgoing.departureStation.trim() || incoming.departureStation.trim() || departureCity.name
    const arrivalPlace = outgoing.arrivalStation.trim() || incoming.arrivalStation.trim() || arrivalCity.name
    const ticketOnSite = outgoing.ticketOnSite || incoming.ticketOnSite
    events.push({ key: `${departureCity.id}:${arrivalCity.id}:transfer`, title: `${departureCity.name} – ${arrivalCity.name}`, subtitle: withTicketOnSiteSummary(travelTimes, durationLabel, ticketOnSite), icon: transportEventIcon(outgoing.type || incoming.type), city: hasOutgoingDetails ? departureCity : arrivalCity, panel: hasOutgoingDetails ? 'out' : 'in', interactive: hasOutgoingDetails || hasIncomingDetails, kind: 'transfer', departureName: departurePlace, departureUrl: outgoing.departureStationUrl || incoming.departureStationUrl, departureCity, arrivalName: arrivalPlace, arrivalUrl: outgoing.arrivalStationUrl || incoming.arrivalStationUrl, arrivalCity })
    if (!arrivalCity.hotelNotNeeded) {
      const checkInTime = arrivalCity.hotelCheckInTime.trim()
      events.push({ key: `${arrivalCity.id}:check-in`, title: arrivalCity.hotel.trim() || 'Отель', subtitle: checkInTime ? `Заселение с ${checkInTime}` : 'Заселение', icon: 'hotel', city: arrivalCity, panel: 'hotel', interactive: Boolean(arrivalCity.hotel.trim() || arrivalCity.hotelUrl.trim()), kind: 'hotel-in' })
    }
    const arrivalPeriod = arrivalCity.arrivalPeriod ?? 'morning'
    const departurePeriod = arrivalCity.departurePeriod ?? 'evening'
    if (arrivalCity.arrival === date && arrivalCity.departure === date && periodOrder[departurePeriod] > periodOrder[arrivalPeriod]) {
      events.push({ key: `${arrivalCity.id}:city-day-between-transfers`, title: `День в ${cityInLocative(arrivalCity.name)}`, icon: 'footprint', city: arrivalCity, kind: 'city' })
    }
  })
  cities.forEach((city) => {
    if (transferCityIds.has(city.id)) return
    const result: DayEvent[] = []
    if (date === city.arrival) {
      const cityIndex = allCities.findIndex((item) => item.id === city.id)
      const previousCity = allCities[cityIndex - 1]
      const previousTransport = previousCity?.transportOut
      const departureTime = city.transportIn.departureTime.trim() || previousTransport?.departureTime.trim()
      const arrivalTime = city.transportIn.arrivalTime.trim() || previousTransport?.arrivalTime.trim()
      const departurePlace = city.transportIn.departureStation.trim() || previousTransport?.departureStation.trim() || previousCity?.name || 'Дом'
      const arrivalPlace = city.transportIn.arrivalStation.trim() || previousTransport?.arrivalStation.trim() || city.name
      const hasIncomingDetails = Boolean(city.trainIn || city.transportIn.type || city.transportIn.departureTime.trim() || city.transportIn.arrivalTime.trim() || city.transportIn.departureStation.trim() || city.transportIn.arrivalStation.trim())
      const durationLabel = formatTravelDuration(departureTime, arrivalTime, city.transportIn.departureDate || previousTransport?.departureDate || previousCity?.departure || city.arrival, city.transportIn.arrivalDate || previousTransport?.arrivalDate || city.arrival, city.transportIn.departureTimeZone || previousTransport?.departureTimeZone || tripTimeZone, city.transportIn.arrivalTimeZone || previousTransport?.arrivalTimeZone || tripTimeZone)
      const travelTimes = formatTravelTimes(departureTime, arrivalTime)
      const ticketOnSite = city.transportIn.ticketOnSite || previousTransport?.ticketOnSite
      const routeTitle = `${previousCity?.name || 'Дом'} – ${city.name}`
      result.push({ key: `${city.id}:arrival`, title: routeTitle, subtitle: withTicketOnSiteSummary(travelTimes, durationLabel, ticketOnSite), icon: transportEventIcon(city.transportIn.type || previousTransport?.type), city: hasIncomingDetails || !previousCity ? city : previousCity, panel: hasIncomingDetails || !previousCity ? 'in' : 'out', interactive: hasIncomingDetails || Boolean(previousTransport && (previousCity?.trainOut || previousTransport.type || previousTransport.departureTime.trim() || previousTransport.arrivalTime.trim() || previousTransport.departureStation.trim() || previousTransport.arrivalStation.trim())), kind: 'transfer', departureName: departurePlace, departureUrl: city.transportIn.departureStationUrl || previousTransport?.departureStationUrl, departureCity: previousCity ?? city, arrivalName: arrivalPlace, arrivalUrl: city.transportIn.arrivalStationUrl || previousTransport?.arrivalStationUrl, arrivalCity: city })
      if (!city.hotelNotNeeded) {
        const checkInTime = city.hotelCheckInTime.trim()
        result.push({ key: `${city.id}:check-in`, title: city.hotel.trim() || 'Отель', subtitle: checkInTime ? `Заселение с ${checkInTime}` : 'Заселение', icon: 'hotel', city, panel: 'hotel', interactive: Boolean(city.hotel.trim() || city.hotelUrl.trim()), kind: 'hotel-in' })
      }
    }
    if (date === city.departure) {
      if (!city.hotelNotNeeded) {
        const checkOutTime = city.hotelCheckOutTime.trim()
        result.push({ key: `${city.id}:check-out`, title: city.hotel.trim() || 'Отель', subtitle: checkOutTime ? `Выселение до ${checkOutTime}` : 'Выселение', icon: 'hotel', city, panel: 'hotel', interactive: Boolean(city.hotel.trim() || city.hotelUrl.trim()), kind: 'hotel-out' })
      }
      const departureTime = city.transportOut.departureTime.trim()
      const arrivalTime = city.transportOut.arrivalTime.trim()
      const departurePlace = city.transportOut.departureStation.trim() || city.name
      const cityIndex = allCities.findIndex((item) => item.id === city.id)
      const arrivalPlace = city.transportOut.arrivalStation.trim() || allCities[cityIndex + 1]?.name
      const durationLabel = formatTravelDuration(departureTime, arrivalTime, city.transportOut.departureDate || city.departure, city.transportOut.arrivalDate || city.departure, city.transportOut.departureTimeZone || tripTimeZone, city.transportOut.arrivalTimeZone || tripTimeZone)
      const travelTimes = formatTravelTimes(departureTime, arrivalTime)
      const routeTitle = `${city.name} – ${allCities[cityIndex + 1]?.name || 'Дом'}`
      result.push({ key: `${city.id}:departure`, title: routeTitle, subtitle: withTicketOnSiteSummary(travelTimes, durationLabel, city.transportOut.ticketOnSite), icon: transportEventIcon(city.transportOut.type), city, panel: 'out', interactive: Boolean(city.trainOut || city.transportOut.type || city.transportOut.departureTime.trim() || city.transportOut.arrivalTime.trim() || city.transportOut.departureStation.trim() || city.transportOut.arrivalStation.trim()), kind: 'transfer', departureName: departurePlace, departureUrl: city.transportOut.departureStationUrl, departureCity: city, arrivalName: arrivalPlace, arrivalUrl: city.transportOut.arrivalStationUrl, arrivalCity: allCities[cityIndex + 1] ?? city })
    }
    if (result.length === 0) result.push({ key: `${city.id}:city-day`, title: `День в ${cityInLocative(city.name)}`, icon: 'footprint', city, kind: 'city' })
    events.push(...result)
  })
  const places = cities.flatMap((city) => (city.places[date] ?? []).map((place) => ({ ...place, city })))
  type TimelineItem =
    | { type: 'event'; key: string; event: DayEvent }
    | { type: 'location'; key: string; name: string; url: string; icon: PlaceIconKey; city: City; placeId?: string; panel?: 'hotel' | 'in' | 'out'; interactive: boolean }
    | { type: 'arrow'; key: string }
  const managedUrls = new Set(allCities.flatMap((city) => [
    city.hotelUrl,
    city.transportIn.departureStationUrl,
    city.transportIn.arrivalStationUrl,
    city.transportOut.departureStationUrl,
    city.transportOut.arrivalStationUrl,
  ]).map((url) => url.trim()).filter(Boolean))
  const ordinaryPlaces = places.filter((place) => !managedUrls.has(place.url.trim()))
  const timeline: TimelineItem[] = []
  const pushArrow = (key: string) => timeline.push({ type: 'arrow', key })
  const pushLocation = (key: string, name: string | undefined, url: string | undefined, icon: PlaceIconKey, city: City, panel: 'hotel' | 'in' | 'out' | undefined, interactive: boolean) => {
    if (!name?.trim() && !url?.trim()) return
    const cleanUrl = url?.trim() || ''
    const cleanName = name?.trim() || city.name
    const linkedPlace = places.find((place) => place.icon === icon && (cleanUrl ? place.url.trim() === cleanUrl : place.name.trim() === cleanName))
    timeline.push({ type: 'location', key, name: cleanName, url: cleanUrl, icon, city: linkedPlace?.city ?? city, placeId: linkedPlace?.id, panel, interactive })
  }
  events.forEach((event) => {
    if (event.kind === 'hotel-out') {
      pushLocation(`${event.key}:hotel`, event.city.hotel || 'Отель', event.city.hotelUrl, 'hotel', event.city, 'hotel', Boolean(event.city.hotelUrl.trim()))
      timeline.push({ type: 'event', key: event.key, event })
      pushArrow(`${event.key}:arrow`)
      return
    }
    if (event.kind === 'transfer') {
      pushLocation(`${event.key}:departure`, event.departureName, event.departureUrl, 'transport', event.departureCity ?? event.city, event.panel, Boolean(event.interactive && event.departureUrl?.trim()))
      timeline.push({ type: 'event', key: event.key, event })
      pushLocation(`${event.key}:arrival`, event.arrivalName, event.arrivalUrl, 'transport', event.arrivalCity ?? event.city, event.panel, Boolean(event.interactive && event.arrivalUrl?.trim()))
      pushArrow(`${event.key}:arrow`)
      return
    }
    if (event.kind === 'city') {
      const cityPlaces = ordinaryPlaces.filter((place) => place.city.id === event.city.id)
      if (cityPlaces.length > 0) {
        cityPlaces.forEach((place) => timeline.push({ type: 'location', key: `${event.key}:${place.id}`, name: place.name, url: place.url, icon: place.icon, city: place.city, placeId: place.id, interactive: Boolean(place.url.trim()) }))
      } else {
        timeline.push({ type: 'event', key: event.key, event })
      }
      pushArrow(`${event.key}:arrow`)
      return
    }
    pushLocation(`${event.key}:hotel`, event.city.hotel || 'Отель', event.city.hotelUrl, 'hotel', event.city, 'hotel', Boolean(event.city.hotelUrl.trim()))
    timeline.push({ type: 'event', key: event.key, event })
  })
  while (timeline.at(-1)?.type === 'arrow') timeline.pop()
  return (
    <article className={`glass day-card${hidden ? ' past' : ''}`}>
      <div className="day-content">
        <div className="day-date-column"><h2>{day.getDate()} {ruMonths[day.getMonth()].slice(0, 3)}</h2><p>{ruWeekdays[day.getDay()]}</p></div>
        <div className="day-panels">
          <label className={`day-column day-description${access.canEdit ? '' : ' read-only'}`}>
            <h3>Заметки</h3>
            <textarea ref={descriptionRef} value={descriptionDraft} placeholder={access.canEdit ? 'Короткое описание дня' : ''} readOnly={!access.canEdit} onChange={(event) => setDescriptionDraft(event.target.value)} onBlur={() => { if (access.canEdit && descriptionDraft !== description) onDescriptionChange(descriptionDraft) }} />
          </label>
          <section className="day-column day-schedule" aria-label="События и локации дня">
            <h3>События и локации</h3>
            <div className="day-events">
              {cities.length === 0 ? <p className="day-empty-city">Добавьте город для посещения</p> : <>
                {timeline.length > 0 && <ItemList as="ol" className="day-timeline">{timeline.map((item) => {
                  if (item.type === 'arrow') return <li key={item.key} className="day-timeline-arrow" aria-hidden="true" />
                  if (item.type === 'event') {
                    const event = item.event
                    const eventText = `${event.title}${event.subtitle ? `${event.subtitle.startsWith('(') ? ' ' : ' · '}${event.subtitle}` : ''}`
                    const content = event.icon ? <TextRow iconType="icon" icon={<Icon name={event.icon} />}>{eventText}</TextRow> : <span>{eventText}</span>
                    return <li key={item.key}>{!access.canBrowse ? <span className="day-event-line read-only">{content}</span> : <button type="button" className="day-event-line" onClick={() => event.panel ? onEvent(event.city, event.panel) : onCity(event.city)}>{content}</button>}</li>
                  }
                  const managedPlaceId = item.icon === 'hotel'
                    ? `managed:hotel:${item.city.id}`
                    : item.icon === 'transport'
                      ? `managed:transport-${item.key.endsWith(':departure') ? 'out' : 'in'}:${item.city.id}`
                      : undefined
                  const targetPlaceId = managedPlaceId ?? item.placeId
                  const label = !item.interactive
                    ? <span>{item.name}</span>
                    : !access.canBrowse
                      ? (item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.name}</a> : <span>{item.name}</span>)
                      : <button type="button" onClick={() => targetPlaceId ? onPlace(item.city, targetPlaceId) : onCity(item.city)}>{item.name}</button>
                  const iconUrl = item.panel && (item.icon === 'hotel' || item.icon === 'transport') ? managedPlaceIconUrl(item.icon) : placeIconUrl(item.icon)
                  return <li key={item.key} className="day-location-line"><TextRow iconType="icon" icon={<img className="ui-icon" src={iconUrl} width={24} height={24} alt="" />}>{label}</TextRow></li>
                })}</ItemList>}
                {events.length === 0 && <p className="empty-text">В этот день пока нет событий</p>}
              </>}
            </div>
          </section>
        </div>
      </div>
    </article>
  )
}

const transportNames: Record<TransportType, string> = { train: 'Поезд', plane: 'Самолёт', bus: 'Автобус', ship: 'Корабль' }
const transportNamePlaceholders: Record<TransportType, string> = { train: 'Название и номер поезда', plane: 'Номер рейса', bus: 'Название и номер автобуса', ship: 'Название и номер корабля' }
const transportIconNames: Record<TransportType, IconName> = { train: 'train', plane: 'plane', bus: 'train', ship: 'sailing' }
const timeZones = ['Europe/Moscow', 'Europe/London', 'Europe/Paris', 'Europe/Istanbul', 'Asia/Dubai', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Bangkok', 'America/New_York', 'America/Los_Angeles']
const formatTimeZoneOption = (timeZone: string, date?: string) => {
  const referenceDate = date ? new Date(`${date}T12:00:00Z`) : new Date()
  try {
    const offset = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
      .formatToParts(referenceDate)
      .find((part) => part.type === 'timeZoneName')?.value
      .replace('GMT', 'UTC')
    return `${timeZone} (${offset || 'UTC'})`
  } catch {
    return timeZone
  }
}
const formatTimeZoneOffset = (timeZone: string, date?: string) => (formatTimeZoneOption(timeZone, date).match(/\((UTC[^)]*)\)$/)?.[1] || 'UTC').replace(/^UTC([+-])/, 'UTC $1')
const manualTime = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits
}
const documentMetadata = (file: TravelFile) => {
  if (!file.uploadedBy && !file.uploadedAt) return undefined
  const uploadedAt = file.uploadedAt ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(file.uploadedAt)) : ''
  return [file.uploadedBy, uploadedAt].filter(Boolean).join(' · ')
}

const transportFormValue = (value: TransportDetails): TransportDetails => {
  const ticketOnSite = value.type === 'plane' ? false : value.ticketOnSite
  return { ...value, ticketOnSite, ...(ticketOnSite ? { departureTime: '', arrivalTime: '', departureTimeZone: '', arrivalTimeZone: '', payerIds: [], totalAmountRubles: 0 } : {}) }
}

const hotelFormValue = (value: HotelDetails): HotelDetails => ({
  name: value.name.trim(),
  url: value.url.trim(),
  checkInTime: value.checkInTime,
  checkOutTime: value.checkOutTime,
  notes: value.notes.trim(),
  payerIds: value.payerIds,
  totalAmountRubles: value.totalAmountRubles,
})

function TransportDialog({ title, departureLabel, arrivalLabel, value, defaultTimeZone, members, ticketName, tickets, ticketError, readOnly = false, routeReadOnly = false, onSave, onTicket, onOpenTicket, onDownloadTicket, onDeleteTicket, onClose }: { title: string; departureLabel: string; arrivalLabel: string; value: TransportDetails; defaultTimeZone: string; members: TripMember[]; ticketName: string; tickets: TravelFile[]; ticketError?: ReactNode; readOnly?: boolean; routeReadOnly?: boolean; onSave: (value: TransportDetails) => Promise<boolean>; onTicket: () => void; onOpenTicket: (ticket: TravelFile) => void; onDownloadTicket: (ticket: TravelFile) => void; onDeleteTicket: (ticket: TravelFile) => void; onClose: () => void }) {
  const valueSignature = JSON.stringify(value)
  const [draft, setDraft] = useState<TransportDetails>(() => transportFormValue(value))
  const [savedSignature, setSavedSignature] = useState(() => JSON.stringify(transportFormValue(value)))
  const [hasSaved, setHasSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const next = transportFormValue(value)
    setDraft(next)
    setSavedSignature(JSON.stringify(next))
    setHasSaved(false)
  }, [valueSignature])
  const visibleTickets = tickets.slice(0, 1)
  const legacyTicketName = visibleTickets.length === 0 ? ticketName : ''
  const ticketCount = visibleTickets.length + Number(Boolean(legacyTicketName))
  const departureTimeZone = draft.departureTimeZone || defaultTimeZone
  const arrivalTimeZone = draft.arrivalTimeZone || defaultTimeZone
  const durationLabel = formatTravelDuration(draft.departureTime, draft.arrivalTime, draft.departureDate, draft.arrivalDate, departureTimeZone, arrivalTimeZone)
  const journeyText = draft.ticketOnSite ? TICKET_ON_SITE_PAGE_TEXT : durationLabel ?? 'Тут появится время в пути'
  const journeySummary = draft.type ? `${transportEmoji[draft.type]} ${journeyText}` : journeyText
  const draftSignature = JSON.stringify(draft)
  return (
    <form className="transport-editor-screen trip-background setup-transition" aria-label={title} onSubmit={(event) => { event.preventDefault(); if (busy || savedSignature === draftSignature) return; const submitted = transportFormValue(draft); setBusy(true); void onSave(submitted).then((saved) => { if (saved) { setSavedSignature(JSON.stringify(submitted)); setHasSaved(true) } }).finally(() => setBusy(false)) }}>
      <IconButton type="button" className="back-button" size="l" icon={<Icon name="arrow-back" />} onClick={onClose} aria-label="Назад" />
      <FormPanelLayout action={!readOnly && <Button type="submit" disabled={busy || savedSignature === draftSignature}>{busy ? 'Сохраняем…' : hasSaved && savedSignature === draftSignature ? 'Изменения сохранены' : 'Сохранить'}</Button>}>
        <FormPanelGroup>
          <FormPanelGroup>
            <FormPanelGroup as="fieldset" className="dialog-fields" disabled={readOnly}>
              <FormControlList headline="Как поедем"><FormControlRow columns={2}>
                <Select type="time" label={draft.type ? 'Тип транспорта' : undefined} placeholder="Транспорт" icon={<Icon name={draft.type ? transportIconNames[draft.type] : 'rocket-launch'} />} displayValue={draft.type ? transportNames[draft.type] : undefined} aria-label="Тип транспорта" value={draft.type ?? ''} onChange={(event) => { const type = event.target.value as TransportType; setDraft({ ...draft, type, ticketOnSite: type === 'plane' ? false : draft.ticketOnSite }) }}>
                  {(Object.keys(transportNames) as TransportType[]).map((type) => <option key={type} value={type}>{transportEmoji[type]} {transportNames[type]}</option>)}
                </Select>
                <Input aria-label={draft.type ? transportNamePlaceholders[draft.type] : 'Название транспорта'} icon={<Icon name="book" />} placeholder={draft.type ? transportNamePlaceholders[draft.type] : 'Название транспорта'} value={draft.name} disabled={!draft.type} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              </FormControlRow></FormControlList>
            </FormPanelGroup>
            <FormPanelGroup gap={8}>
            <InfoRowList headline="Билет">
              {visibleTickets.map((ticket) => <InfoRow key={ticket.id} disabled={draft.ticketOnSite} image={`${import.meta.env.BASE_URL}assets/ticket-placeholder.png`} imageAlt="Билет" title={ticket.name} titleStyle="text" subtitle={documentMetadata(ticket)} error={ticketError} onClick={() => onOpenTicket(ticket)} actionTheme="secondary" actions={[{ icon: <Icon name="download" />, label: 'Скачать билет', onClick: () => onDownloadTicket(ticket) }, ...(readOnly ? [] : [{ icon: <Icon name="delete-forever" />, label: 'Удалить билет', onClick: () => onDeleteTicket(ticket) }])]} />)}
              {legacyTicketName && <InfoRow disabled={draft.ticketOnSite} image={`${import.meta.env.BASE_URL}assets/ticket-placeholder.png`} imageAlt="Билет" title={legacyTicketName} titleStyle="text" />}
              {ticketCount < 1 && !readOnly && <InfoRow disabled={draft.ticketOnSite} image={`${import.meta.env.BASE_URL}assets/ticket-placeholder.png`} imageAlt="Билет" imageDimmed title="Прикрепить билет" titleStyle="text" subtitle="Лучше в PDF формате" error={ticketError} onClick={onTicket} actionTheme="secondary" actions={[{ icon: <Icon name="add-plus" />, label: 'Прикрепить билет', onClick: onTicket }]} />}
            </InfoRowList>
            <CheckboxTextRow checked={draft.ticketOnSite} disabled={readOnly || draft.type === 'plane'} onClick={() => setDraft({ ...draft, ticketOnSite: !draft.ticketOnSite, ...(!draft.ticketOnSite ? { departureTime: '', arrivalTime: '', departureTimeZone: '', arrivalTimeZone: '', payerIds: [], totalAmountRubles: 0 } : {}) })}>{TICKET_ON_SITE_PAGE_TEXT}</CheckboxTextRow>
            </FormPanelGroup>
          </FormPanelGroup>
          <FormPanelGroup as="fieldset" className="dialog-fields" disabled={readOnly} flatten>
            <FormPanelGroup order="first">
              <FormPanelHeader title={`${departureLabel} – ${arrivalLabel}`} text={journeySummary} />
              <FormControlList>
                <FormControlRow columns={2}>
                  <DateInput label="Уедем" icon={<Icon name="calendar-month" />} displayValue={formatCompactNumericDate(draft.departureDate)} aria-label="Дата отъезда" value={draft.departureDate} disabled={routeReadOnly} onChange={(event) => setDraft({ ...draft, departureDate: event.target.value })} />
                  <DateInput label="Приедем" icon={<Icon name="calendar-month" />} displayValue={formatCompactNumericDate(draft.arrivalDate)} aria-label="Дата приезда" value={draft.arrivalDate} disabled={routeReadOnly} onChange={(event) => setDraft({ ...draft, arrivalDate: event.target.value })} />
                </FormControlRow>
                <FormControlRow columns={2}>
                  <TimeZoneInput label="Время отъезда" icon={<Icon name="time" />} aria-label="Время отъезда" disabled={draft.ticketOnSite} value={draft.departureTime} onChange={(event) => setDraft({ ...draft, departureTime: event.target.value })} secondaryText={formatTimeZoneOffset(departureTimeZone, draft.departureDate)} secondaryLabel="Часовой пояс отправления" secondaryValue={draft.departureTimeZone} secondaryOptions={[{ value: '', label: `По часовому поясу поездки — ${formatTimeZoneOption(defaultTimeZone, draft.departureDate)}` }, ...timeZones.map((zone) => ({ value: zone, label: formatTimeZoneOption(zone, draft.departureDate) }))]} onSecondaryChange={(departureTimeZone) => setDraft({ ...draft, departureTimeZone })} />
                  <TimeZoneInput label="Время приезда" icon={<Icon name="time" />} aria-label="Время приезда" disabled={draft.ticketOnSite} value={draft.arrivalTime} onChange={(event) => setDraft({ ...draft, arrivalTime: event.target.value })} secondaryText={formatTimeZoneOffset(arrivalTimeZone, draft.arrivalDate)} secondaryLabel="Часовой пояс приезда" secondaryValue={draft.arrivalTimeZone} secondaryOptions={[{ value: '', label: `По часовому поясу поездки — ${formatTimeZoneOption(defaultTimeZone, draft.arrivalDate)}` }, ...timeZones.map((zone) => ({ value: zone, label: formatTimeZoneOption(zone, draft.arrivalDate) }))]} onSecondaryChange={(arrivalTimeZone) => setDraft({ ...draft, arrivalTimeZone })} />
                </FormControlRow>
                <FormControlRow columns={2}>
                  <Input label="Место отъезда" aria-label="Место отъезда" icon={<Icon name="public" />} value={draft.departureStation} onChange={(event) => setDraft({ ...draft, departureStation: event.target.value })} />
                  <Input label="Место приезда" aria-label="Место приезда" icon={<Icon name="public" />} value={draft.arrivalStation} onChange={(event) => setDraft({ ...draft, arrivalStation: event.target.value })} />
                </FormControlRow>
                <FormControlRow columns={2}>
                  <Input aria-label="Ссылка Google Maps места отправления" icon={<Icon name="pin-transport" />} trailingIcon={draft.departureStationUrl.trim() ? <Icon name="content-copy" /> : undefined} trailingIconLabel="Скопировать ссылку" onTrailingIconClick={draft.departureStationUrl.trim() ? () => void navigator.clipboard.writeText(draft.departureStationUrl.trim()) : undefined} type="url" placeholder="Ссылка Google Maps" value={draft.departureStationUrl} onChange={(event) => setDraft({ ...draft, departureStationUrl: event.target.value })} />
                  <Input aria-label="Ссылка Google Maps места приезда" icon={<Icon name="pin-transport" />} trailingIcon={draft.arrivalStationUrl.trim() ? <Icon name="content-copy" /> : undefined} trailingIconLabel="Скопировать ссылку" onTrailingIconClick={draft.arrivalStationUrl.trim() ? () => void navigator.clipboard.writeText(draft.arrivalStationUrl.trim()) : undefined} type="url" placeholder="Ссылка Google Maps" value={draft.arrivalStationUrl} onChange={(event) => setDraft({ ...draft, arrivalStationUrl: event.target.value })} />
                </FormControlRow>
              </FormControlList>
            </FormPanelGroup>
            <FormPanelGroup order="last">
              <TextareaList headline="Что стоит помнить"><Textarea aria-label="Заметки о транспорте" placeholder="Места, ориентиры и важная информация" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></TextareaList>
              {!draft.ticketOnSite && <FormPanelGroup>
                <FormControlList headline="Оплата"><FormControlRow columns={2}>
                  <Select type="assignee" options={assigneeOptions(members)} value={draft.payerIds} icon={<Icon name="face" />} emptyLabel="Кто платил" onValueChange={(payerIds) => setDraft({ ...draft, payerIds })} />
                  <Input content="money" aria-label="Общая сумма в рублях" value={draft.totalAmountRubles} onValueChange={(totalAmountRubles) => setDraft({ ...draft, totalAmountRubles })} />
                </FormControlRow></FormControlList>
              </FormPanelGroup>}
              <FormPanelNote centered>{draft.ticketOnSite ? 'P.S. Галочка в меню появится после заполнения дат и названий\u00a0локаций' : 'P.S. Галочка в меню появится после заполнения дат, времени, названий\u00a0локаций\u00a0и\u00a0прикрепления\u00a0билета'}</FormPanelNote>
            </FormPanelGroup>
          </FormPanelGroup>
        </FormPanelGroup>
      </FormPanelLayout>
    </form>
  )
}

function HotelDialog({ cityName, value, members, booking, bookingError, readOnly = false, onSave, onBooking, onOpenBooking, onDownloadBooking, onDeleteBooking, onClose }: { cityName: string; value: HotelDetails; members: TripMember[]; booking?: TravelFile; bookingError?: ReactNode; readOnly?: boolean; onSave: (value: HotelDetails) => Promise<boolean>; onBooking: (value: HotelDetails) => void; onOpenBooking?: () => void; onDownloadBooking?: () => void; onDeleteBooking?: () => void; onClose: () => void }) {
  const valueSignature = JSON.stringify(value)
  const [draft, setDraft] = useState(value)
  const [savedSignature, setSavedSignature] = useState(() => JSON.stringify(hotelFormValue(value)))
  const [hasSaved, setHasSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setDraft(value); setSavedSignature(JSON.stringify(hotelFormValue(value))); setHasSaved(false) }, [valueSignature])
  const submitted = hotelFormValue(draft)
  const draftSignature = JSON.stringify(submitted)
  return (
    <form className="transport-editor-screen trip-background setup-transition" aria-labelledby="hotel-title" onSubmit={(event) => { event.preventDefault(); if (busy || savedSignature === draftSignature) return; setBusy(true); void onSave(submitted).then((saved) => { if (saved) { setSavedSignature(JSON.stringify(submitted)); setHasSaved(true) } }).finally(() => setBusy(false)) }}>
      <IconButton type="button" className="back-button" size="l" icon={<Icon name="arrow-back" />} onClick={onClose} aria-label="Назад" />
      <FormPanelLayout action={!readOnly && <Button type="submit" disabled={busy || savedSignature === draftSignature}>{busy ? 'Сохраняем…' : hasSaved && savedSignature === draftSignature ? 'Изменения сохранены' : 'Сохранить'}</Button>}>
          <FormPanelHeader id="hotel-title" title={`Отель ${cityName}`} />
          <FormPanelGroup>
          <FormPanelGroup as="fieldset" className="dialog-fields" disabled={readOnly}>
            <FormControlList>
              <FormControlRow columns={2}>
              <Input label="Заселение с" icon={<Icon name="time" />} type="text" inputMode="numeric" maxLength={5} placeholder="--:--" value={draft.checkInTime} onChange={(event) => setDraft({ ...draft, checkInTime: manualTime(event.target.value) })} />
              <Input label="Выселение до" icon={<Icon name="time" />} type="text" inputMode="numeric" maxLength={5} placeholder="--:--" value={draft.checkOutTime} onChange={(event) => setDraft({ ...draft, checkOutTime: manualTime(event.target.value) })} />
              </FormControlRow>
              <FormControlRow>
              <Input icon={<Icon name="hotel" />} aria-label="Название места" placeholder="Название места" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              </FormControlRow>
              <FormControlRow>
              <Input icon={<Icon name="pin-home" />} trailingIcon={draft.url.trim() ? <Icon name="content-copy" /> : undefined} trailingIconLabel="Скопировать ссылку" onTrailingIconClick={draft.url.trim() ? () => void navigator.clipboard.writeText(draft.url.trim()) : undefined} aria-label="Ссылка на отель в Google Maps" type="url" placeholder="Ссылка Google Maps" value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} />
              </FormControlRow>
            </FormControlList>
          </FormPanelGroup>
          {(booking || !readOnly) && <InfoRowList headline="Бронь"><InfoRow image={`${import.meta.env.BASE_URL}assets/hotel-placeholder.png`} imageAlt="Отель" imageDimmed={!booking} title={booking ? booking.name : 'Прикрепить бронь'} titleStyle="text" subtitle={booking ? documentMetadata(booking) : 'Лучше в PDF формате'} error={bookingError} onClick={booking ? onOpenBooking : () => onBooking(draft)} actionTheme="secondary" actions={booking ? [{ icon: <Icon name="download" />, label: 'Скачать бронь', onClick: onDownloadBooking }, ...(readOnly ? [] : [{ icon: <Icon name="delete-forever" />, label: 'Удалить бронь', onClick: onDeleteBooking }])] : readOnly ? [] : [{ icon: <Icon name="add-plus" />, label: 'Прикрепить бронь', onClick: () => onBooking(draft) }]} /></InfoRowList>}
          </FormPanelGroup>
          <FormPanelGroup as="fieldset" className="dialog-fields" disabled={readOnly}>
              <TextareaList headline="Что стоит помнить"><Textarea aria-label="Заметки об отеле" placeholder="Места, ориентиры и важная информация" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></TextareaList>
              <FormPanelGroup>
                <FormControlList headline="Оплата"><FormControlRow columns={2}>
                  <Select type="assignee" options={assigneeOptions(members)} value={draft.payerIds} icon={<Icon name="face" />} emptyLabel="Кто платил" onValueChange={(payerIds) => setDraft({ ...draft, payerIds })} />
                  <Input content="money" aria-label="Общая сумма за отель в рублях" value={draft.totalAmountRubles} onValueChange={(totalAmountRubles) => setDraft({ ...draft, totalAmountRubles })} />
                </FormControlRow></FormControlList>
              </FormPanelGroup>
          </FormPanelGroup>
          <FormPanelNote centered>P.S. Галочка в меню появится, когда все поля будут заполнены и&nbsp;появится&nbsp;файл&nbsp;с&nbsp;бронью&nbsp;отеля</FormPanelNote>
      </FormPanelLayout>
    </form>
  )
}

function CityPanel({ city, previousCity, nextCity, members, tripStartDate, tripEndDate, tripTimeZone, tripAccentColor, initialPanel, initialDate, initialFocusPlace, documentErrors, readOnly, routeReadOnly, onChange, onAddPlace, onUpdatePlace, onDeletePlace, onMovePlace, onTrainChange, onHotelChange, onOpenDocument, onDownloadDocument, onDeleteDocument, onOpenManagedPanel, onPanelClose, onClose }: { city: City; previousCity?: City; nextCity?: City; members: TripMember[]; tripStartDate: string; tripEndDate: string; tripTimeZone: string; tripAccentColor: string; initialPanel?: 'hotel' | 'in' | 'out' | null; initialDate?: string | null; initialFocusPlace?: string | null; documentErrors: Record<string, string>; readOnly?: boolean; routeReadOnly?: boolean; onChange: (city: City) => Promise<string | undefined>; onAddPlace: (city: City, date: string, place: Place) => void; onUpdatePlace: (city: City, date: string, place: Place) => void; onDeletePlace: (placeId: string) => void; onMovePlace: (placeId: string, date: string | null, position: number) => void; onTrainChange: (city: City, direction: 'in' | 'out', file: TravelFile, source: File) => Promise<TravelFile | undefined>; onHotelChange: (city: City, file: TravelFile, source: File) => Promise<TravelFile | undefined>; onOpenDocument: (file: TravelFile) => void; onDownloadDocument: (file: TravelFile) => void; onDeleteDocument: (file: TravelFile) => Promise<void>; onOpenManagedPanel: (cityId: string, panel: 'hotel' | 'in' | 'out') => void; onPanelClose: () => void; onClose: () => void }) {
  const [draft, setDraft] = useState(() => ({ ...city, transportIn: city.transportIn ?? emptyTransport(), transportOut: city.transportOut ?? emptyTransport() }))
  useEffect(() => {
    setDraft({ ...city, transportIn: city.transportIn ?? emptyTransport(), transportOut: city.transportOut ?? emptyTransport() })
  }, [city])
  const [contentTransition, setContentTransition] = useState<'idle' | 'out' | 'in'>('idle')
  const [transportDirection, setTransportDirection] = useState<'in' | 'out' | null>(initialPanel === 'in' || initialPanel === 'out' ? initialPanel : null)
  const [hotelOpen, setHotelOpen] = useState(initialPanel === 'hotel')
  const [activeDate, setActiveDate] = useState<string | null>(initialDate && initialDate >= city.arrival && initialDate <= city.departure ? initialDate : null)
  const [focusRequest, setFocusRequest] = useState<string | null>(initialFocusPlace ?? null)
  const [attachmentErrors, setAttachmentErrors] = useState<Partial<Record<'in' | 'out' | 'hotel', string>>>({})
  const hotelFileRef = useRef<HTMLInputElement>(null)
  const pendingHotelDraftRef = useRef<HotelDetails | null>(null)
  const trainInFileRef = useRef<HTMLInputElement>(null)
  const trainOutFileRef = useRef<HTMLInputElement>(null)
  const displayedCityIdRef = useRef(city.id)
  useEffect(() => {
    if (displayedCityIdRef.current === city.id) return
    setContentTransition('out')
    const swapTimer = window.setTimeout(() => {
      displayedCityIdRef.current = city.id
      setDraft({ ...city, transportIn: city.transportIn ?? emptyTransport(), transportOut: city.transportOut ?? emptyTransport() })
      setTransportDirection(initialPanel === 'in' || initialPanel === 'out' ? initialPanel : null)
      setHotelOpen(initialPanel === 'hotel')
      setActiveDate(initialDate && initialDate >= city.arrival && initialDate <= city.departure ? initialDate : null)
      setFocusRequest(initialFocusPlace ?? null)
      setContentTransition('in')
    }, 150)
    const finishTimer = window.setTimeout(() => setContentTransition('idle'), 350)
    return () => {
      window.clearTimeout(swapTimer)
      window.clearTimeout(finishTimer)
    }
  }, [city.id, initialDate, initialPanel, initialFocusPlace])
  useLayoutEffect(() => {
    if (displayedCityIdRef.current !== city.id) return
    setTransportDirection(initialPanel === 'in' || initialPanel === 'out' ? initialPanel : null)
    setHotelOpen(initialPanel === 'hotel')
    setActiveDate(initialDate && initialDate >= city.arrival && initialDate <= city.departure ? initialDate : null)
    setFocusRequest(initialFocusPlace ?? null)
  }, [city.id, initialDate, initialPanel, initialFocusPlace])
  const addTrainFiles = (files: FileList | null, direction: 'in' | 'out') => {
    const existingCount = draft.files.filter((file) => file.category.startsWith(`train-${direction}:`)).length
    const selected = Array.from(files ?? []).slice(0, Math.max(0, 1 - existingCount))
    if (selected.length === 0) return
    setAttachmentErrors((current) => ({ ...current, [direction]: undefined }))
    const uploads = selected.map((file) => ({ file, record: { id: uid(), name: file.name, category: `train-${direction}:pending:${uid()}` } }))
    const next = { ...draft, [direction === 'in' ? 'trainIn' : 'trainOut']: uploads[0].file.name, files: [...draft.files, ...uploads.map(({ record }) => record)] }
    setDraft(next)
    uploads.forEach(({ file, record }) => {
      void onTrainChange(next, direction, record, file).then((saved) => {
        if (!saved) return
        setDraft((current) => ({ ...current, files: [...current.files.filter((item) => item.id !== record.id), saved] }))
      }).catch((reason) => {
        setDraft((current) => ({ ...current, files: current.files.filter((item) => item.id !== record.id) }))
        setAttachmentErrors((current) => ({ ...current, [direction]: uploadErrorMessage(reason) ?? 'Попробуйте загрузить ещё раз' }))
      })
    })
  }
  const addHotelFile = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setAttachmentErrors((current) => ({ ...current, hotel: undefined }))
    const hotel = pendingHotelDraftRef.current
    pendingHotelDraftRef.current = null
    const fileRecord = { id: uid(), name: file.name, category: 'hotel-booking' }
    const next = hotel ? { ...draft, hotel: hotel.name.trim(), hotelUrl: hotel.url.trim(), hotelCheckInTime: hotel.checkInTime, hotelCheckOutTime: hotel.checkOutTime, hotelNotes: hotel.notes.trim(), hotelPayerIds: hotel.payerIds, hotelTotalAmountRubles: hotel.totalAmountRubles, files: [...draft.files, fileRecord] } : { ...draft, files: [...draft.files, fileRecord] }
    setDraft(next)
    void onHotelChange(next, fileRecord, file).then((saved) => {
      if (!saved) return
      setDraft((current) => ({ ...current, files: [...current.files.filter((item) => item.id !== fileRecord.id), saved] }))
    }).catch((reason) => {
      setDraft((current) => ({ ...current, files: current.files.filter((item) => item.id !== fileRecord.id) }))
      setAttachmentErrors((current) => ({ ...current, hotel: uploadErrorMessage(reason) ?? 'Попробуйте загрузить ещё раз' }))
    })
  }
  const mapPoint = draft.transportIn.arrivalStation || draft.transportOut.departureStation || draft.name
  const transportDocuments = (direction: 'in' | 'out') => draft.files.filter((file) => file.category.startsWith(`train-${direction}:`)).slice(0, 1)
  const hotelDocument = draft.files.find((file) => file.category === 'hotel-booking')
  const managedPlaceUrls = new Set([
    draft.hotelUrl,
    draft.transportIn.departureStationUrl,
    draft.transportIn.arrivalStationUrl,
    draft.transportOut.departureStationUrl,
    draft.transportOut.arrivalStationUrl,
    previousCity?.transportOut.arrivalStationUrl,
    nextCity?.transportIn.departureStationUrl,
  ].map((url) => url?.trim()).filter((url): url is string => Boolean(url)))
  const isManagedPlace = (place: Place) => (place.icon === 'hotel' || place.icon === 'transport') && managedPlaceUrls.has(place.url.trim())
  const ordinaryPlacesByDate = Object.fromEntries(Object.entries(draft.places).map(([date, places]) => [date, places.filter((place) => !isManagedPlace(place) && Boolean(place.url.trim()))]))
  type ManagedMapPlace = Place & { date: string; dateLocked: true; editTarget: { cityId: string; panel: 'hotel' | 'in' | 'out' }; hotelDetails?: { cityName: string; dateLabel: string; checkInTime: string; checkOutTime: string; hasBooking: boolean } }
  const managedMapPlaces: ManagedMapPlace[] = []
  if (!draft.hotelNotNeeded && draft.hotelUrl.trim()) managedMapPlaces.push({
    id: `managed:hotel:${draft.id}`,
    name: draft.hotel.trim() || `Жильё · ${draft.name}`,
    url: draft.hotelUrl.trim(),
    icon: 'hotel',
    notes: draft.hotelNotes,
    date: draft.arrival || UNSCHEDULED_KEY,
    dateLocked: true,
    editTarget: { cityId: draft.id, panel: 'hotel' },
    hotelDetails: {
    cityName: draft.name,
    dateLabel: formatShortRange(draft.arrival, draft.departure),
    checkInTime: draft.hotelCheckInTime,
    checkOutTime: draft.hotelCheckOutTime,
    hasBooking: Boolean(hotelDocument),
    },
  })
  const incoming = draft.transportIn.arrivalStationUrl.trim()
    ? { details: draft.transportIn, owner: draft, panel: 'in' as const }
    : previousCity?.transportOut.arrivalStationUrl.trim()
      ? { details: previousCity.transportOut, owner: previousCity, panel: 'out' as const }
      : undefined
  if (incoming) managedMapPlaces.push({ id: `managed:transport-in:${draft.id}`, name: incoming.details.arrivalStation.trim() || draft.name, url: incoming.details.arrivalStationUrl.trim(), icon: 'transport', notes: incoming.details.notes, date: incoming.details.arrivalDate || draft.arrival || UNSCHEDULED_KEY, dateLocked: true, editTarget: { cityId: incoming.owner.id, panel: incoming.panel } })
  const outgoing = draft.transportOut.departureStationUrl.trim()
    ? { details: draft.transportOut, owner: draft, panel: 'out' as const }
    : nextCity?.transportIn.departureStationUrl.trim()
      ? { details: nextCity.transportIn, owner: nextCity, panel: 'in' as const }
      : undefined
  if (outgoing) managedMapPlaces.push({ id: `managed:transport-out:${draft.id}`, name: outgoing.details.departureStation.trim() || draft.name, url: outgoing.details.departureStationUrl.trim(), icon: 'transport', notes: outgoing.details.notes, date: outgoing.details.departureDate || draft.departure || UNSCHEDULED_KEY, dateLocked: true, editTarget: { cityId: outgoing.owner.id, panel: outgoing.panel } })
  const placesByDate = managedMapPlaces.reduce<Record<string, Place[]>>((result, place) => ({ ...result, [place.date]: [...(result[place.date] ?? []), place] }), ordinaryPlacesByDate)
  const managedPlaceIds = new Set(managedMapPlaces.map((place) => place.id))
  const pointsCount = Object.values(placesByDate).reduce((total, places) => total + places.length, 0)
  const saveTransport = async (value: TransportDetails) => {
    if (!transportDirection) return false
    const currentTransport = transportDirection === 'in' ? draft.transportIn : draft.transportOut
    const permittedValue = routeReadOnly
      ? { ...value, departureDate: currentTransport.departureDate, arrivalDate: currentTransport.arrivalDate }
      : value
    const next = { ...draft, [transportDirection === 'in' ? 'transportIn' : 'transportOut']: permittedValue }
    setDraft(next)
    const savedVersion = await onChange(next)
    if (!savedVersion) return false
    setDraft((current) => ({ ...current, updatedAt: savedVersion }))
    return true
  }
  const saveHotel = async (hotel: HotelDetails) => {
    const next = { ...draft, hotel: hotel.name, hotelUrl: hotel.url, hotelCheckInTime: hotel.checkInTime, hotelCheckOutTime: hotel.checkOutTime, hotelNotes: hotel.notes, hotelPayerIds: hotel.payerIds, hotelTotalAmountRubles: hotel.totalAmountRubles }
    setDraft(next)
    const savedVersion = await onChange(next)
    if (!savedVersion) return false
    setDraft((current) => ({ ...current, updatedAt: savedVersion }))
    return true
  }
  return (
    <>
      <section className="glass city-page-card setup-transition">
        <div className={`city-compact-header city-panel-content city-panel-content-${contentTransition}`}>
          <IconButton type="button" className="city-inline-back" icon={<Icon name="calendar-month" />} onClick={onClose} aria-label="Вернуться к календарю" title="Вернуться к календарю" />
          <TypographyGroup className="city-compact-copy" title={draft.name} text={<>{formatLongRange(draft.arrival, draft.departure)} · {formatDays(cityDays(draft))} · {formatLocations(pointsCount)}</>} />
        </div>
        <input ref={trainInFileRef} className="hidden-file-input" type="file" onChange={(e) => { addTrainFiles(e.target.files, 'in'); e.currentTarget.value = '' }} />
        <input ref={trainOutFileRef} className="hidden-file-input" type="file" onChange={(e) => { addTrainFiles(e.target.files, 'out'); e.currentTarget.value = '' }} />
        <input ref={hotelFileRef} className="hidden-file-input" type="file" onChange={(e) => addHotelFile(e.target.files)} />
        <div className={`city-main city-panel-content city-panel-content-${contentTransition}`}>
          <PlaceDayList
            dates={dateRange(draft.arrival, draft.departure)}
            placesByDate={placesByDate}
            activeDate={activeDate}
            readOnly={readOnly}
            lockedPlaceIds={managedPlaceIds}
            formatDate={formatDate}
            onActivateDate={setActiveDate}
            onFocusPlace={setFocusRequest}
            onMove={(placeId, date, position) => {
              const from = Object.keys(draft.places).find((key) => (draft.places[key] ?? []).some((item) => item.id === placeId))
              const moved = from ? (draft.places[from] ?? []).find((item) => item.id === placeId) : undefined
              if (!from || !moved) return
              const to = date ?? UNSCHEDULED_KEY
              const source = (draft.places[from] ?? []).filter((item) => item.id !== placeId)
              const target = from === to ? source : [...(draft.places[to] ?? [])]
              target.splice(Math.max(0, Math.min(position, target.length)), 0, moved)
              setDraft((latest) => ({ ...latest, places: { ...latest.places, [from]: from === to ? target : source, [to]: target } }))
              onMovePlace(placeId, date, position)
            }}
          />
          <div className="city-route-content">
            <div className="city-map">
              <PlacesMap
                query={mapPoint}
                centerUrl={draft.googleMapsUrl}
                accentColor={tripAccentColor}
                pointCardTint={tripAccentColor !== DEFAULT_TRIP_ACCENT_COLOR ? tripAccentColor : undefined}
                places={[
                  ...Object.entries(ordinaryPlacesByDate).flatMap(([date, items]) => items.map((item) => ({ id: item.id, name: item.name, url: item.url, icon: item.icon, notes: item.notes, date, latitude: item.latitude, longitude: item.longitude }))),
                  ...managedMapPlaces,
                ]}
                dates={dateRange(draft.arrival, draft.departure)}
                activeDate={activeDate}
                readOnly={readOnly}
                formatDate={formatDate}
                formatDateOption={formatDateWithWeekday}
                focusRequest={focusRequest}
                onFocusHandled={() => setFocusRequest(null)}
                onEditTarget={({ cityId, panel }) => onOpenManagedPanel(cityId, panel)}
                onOpenBooking={() => { if (hotelDocument) onOpenDocument(hotelDocument) }}
                onAdd={({ name, icon, date, notes, position }) => {
                  const place = { id: uid(), name, url: `https://www.google.com/maps?q=${position.lat.toFixed(6)},${position.lng.toFixed(6)}`, icon, notes, latitude: position.lat, longitude: position.lng }
                  const next = { ...draft, places: { ...draft.places, [date]: [...(draft.places[date] ?? []), place] } }
                  setDraft(next)
                  onAddPlace(next, date, place)
                }}
                onUpdate={(id, value) => {
                  const from = Object.keys(draft.places).find((key) => (draft.places[key] ?? []).some((item) => item.id === id))
                  const current = from ? (draft.places[from] ?? []).find((item) => item.id === id) : undefined
                  if (!from || !current) return
                  const place = { ...current, name: value.name, icon: value.icon, notes: value.notes }
                  // Смена даты в тултипе — это тот же перенос, что и драг-н-дроп,
                  // поэтому позиция считается концом целевого дня.
                  const to = value.date
                  const source = (draft.places[from] ?? []).filter((item) => item.id !== id)
                  const target = from === to ? (draft.places[from] ?? []).map((item) => item.id === id ? place : item) : [...(draft.places[to] ?? []), place]
                  const next = { ...draft, places: { ...draft.places, [from]: from === to ? target : source, [to]: target } }
                  setDraft(next)
                  onUpdatePlace(next, to, place)
                }}
                onDelete={(id) => {
                  const from = Object.keys(draft.places).find((key) => (draft.places[key] ?? []).some((item) => item.id === id))
                  if (!from) return
                  setDraft((latest) => ({ ...latest, places: { ...latest.places, [from]: (latest.places[from] ?? []).filter((item) => item.id !== id) } }))
                  onDeletePlace(id)
                }}
                onResolvePlace={(id, coordinates) => {
                  const entry = Object.entries(draft.places).find(([, items]) => items.some((item) => item.id === id))
                  const current = entry?.[1].find((item) => item.id === id)
                  if (!entry || !current || current.latitude !== undefined) return
                  const resolved = { ...current, latitude: coordinates.lat, longitude: coordinates.lng }
                  const next = { ...draft, places: { ...draft.places, [entry[0]]: (draft.places[entry[0]] ?? []).map((item) => item.id === id ? resolved : item) } }
                  setDraft(next)
                  onUpdatePlace(next, entry[0], resolved)
                }}
              />
            </div>
          </div>
        </div>
      </section>
      {transportDirection && <TransportDialog readOnly={readOnly} routeReadOnly={routeReadOnly} title={transportDirection === 'in' ? (previousCity ? `${previousCity.name} – ${draft.name}` : `Дом – ${draft.name}`) : (nextCity ? `${draft.name} – ${nextCity.name}` : `${draft.name} – Дом`)} departureLabel={transportDirection === 'in' ? previousCity?.name || 'Дом' : draft.name} arrivalLabel={transportDirection === 'in' ? draft.name : nextCity?.name || 'Дом'} defaultTimeZone={tripTimeZone} members={members} value={transportDirection === 'in' ? { ...draft.transportIn, departureDate: draft.transportIn.departureDate || previousCity?.departure || tripStartDate, arrivalDate: draft.transportIn.arrivalDate || draft.arrival } : { ...draft.transportOut, departureDate: draft.transportOut.departureDate || draft.departure, arrivalDate: draft.transportOut.arrivalDate || nextCity?.arrival || tripEndDate }} ticketName={transportDirection === 'in' ? draft.trainIn : draft.trainOut} tickets={transportDocuments(transportDirection)} ticketError={transportDocuments(transportDirection)[0] ? documentErrors[transportDocuments(transportDirection)[0].id] : attachmentErrors[transportDirection]} onTicket={() => (transportDirection === 'in' ? trainInFileRef : trainOutFileRef).current?.click()} onOpenTicket={onOpenDocument} onDownloadTicket={onDownloadDocument} onDeleteTicket={(file) => { const direction = transportDirection; const previous = draft; setDraft((current) => { const remaining = current.files.filter((item) => item.id !== file.id); const nextTicket = remaining.find((item) => item.category.startsWith(`train-${direction}:`)); return { ...current, [direction === 'in' ? 'trainIn' : 'trainOut']: nextTicket?.name ?? '', files: remaining } }); void onDeleteDocument(file).catch(() => setDraft(previous)) }} onClose={() => { setTransportDirection(null); onPanelClose() }} onSave={saveTransport} />}
      {hotelOpen && <HotelDialog readOnly={readOnly} cityName={draft.name} members={members} value={{ name: draft.hotel, url: draft.hotelUrl, checkInTime: draft.hotelCheckInTime, checkOutTime: draft.hotelCheckOutTime, notes: draft.hotelNotes, payerIds: draft.hotelPayerIds, totalAmountRubles: draft.hotelTotalAmountRubles }} booking={hotelDocument} bookingError={hotelDocument ? documentErrors[hotelDocument.id] : attachmentErrors.hotel} onBooking={(hotel) => { pendingHotelDraftRef.current = hotel; hotelFileRef.current?.click() }} onOpenBooking={hotelDocument ? () => onOpenDocument(hotelDocument) : undefined} onDownloadBooking={hotelDocument ? () => onDownloadDocument(hotelDocument) : undefined} onDeleteBooking={hotelDocument ? () => { const file = hotelDocument; const previous = draft; setDraft((current) => ({ ...current, files: current.files.filter((item) => item.id !== file.id) })); void onDeleteDocument(file).catch(() => setDraft(previous)) } : undefined} onClose={() => { setHotelOpen(false); onPanelClose() }} onSave={saveHotel} />}
    </>
  )
}

function Dashboard({ trip, user, tripCount, cacheState, online, onChange, onEdit, onTrips, onProfile, onInvite, onCityChange, onDayDescriptionChange, onAddPlace, onUpdatePlace, onDeletePlace, onMovePlace, onTrainUpload, onHotelUpload, onDocumentDelete, onRefreshData, onOperationError }: { trip: Trip; user: CurrentUser | null; tripCount: number; cacheState: CacheState; online: boolean; onChange: (trip: Trip) => void; onEdit: () => void; onTrips: () => void; onProfile: () => void; onInvite: () => void; onCityChange: (city: City) => Promise<string | undefined>; onDayDescriptionChange: (date: string, description: string) => void; onAddPlace: (city: City, date: string, place: Place) => void; onUpdatePlace: (city: City, date: string, place: Place) => void; onDeletePlace: (placeId: string) => void; onMovePlace: (placeId: string, date: string | null, position: number) => void; onTrainUpload: (city: City, direction: 'in' | 'out', file: File) => Promise<TravelFile | undefined>; onHotelUpload: (city: City, file: File) => Promise<TravelFile | undefined>; onDocumentDelete: (file: TravelFile) => Promise<void>; onRefreshData: () => void; onOperationError: (title: string, retry: () => void, message?: string, options?: { retryLabel?: string; actionIcon?: 'retry' | 'refresh'; closable?: boolean }) => void }) {
  const [showPast, setShowPast] = useState(false)
  const [expensesOpen, setExpensesOpen] = useState(false)
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null)
  const [selectedPanel, setSelectedPanel] = useState<'hotel' | 'in' | 'out' | null>(null)
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [documentErrors, setDocumentErrors] = useState<Record<string, string>>({})
  const [panelReturnCityId, setPanelReturnCityId] = useState<string | null>(null)
  const backgroundReady = useTripBackgroundReady(trip)
  const access = useAccess()
  const [selectedCityDate, setSelectedCityDate] = useState<string | null>(null)
  const today = isoDate(new Date())
  const allDays = dateRange(trip.startDate, trip.endDate)
  const visibleDays = showPast ? allDays : allDays.filter((date) => date >= today)
  const selectedCity = trip.cities.find((city) => city.id === selectedCityId) ?? null
  const selectedCityIndex = selectedCity ? trip.cities.findIndex((city) => city.id === selectedCity.id) : -1
  const openDocument = (file: TravelFile) => {
    setDocumentErrors((current) => ({ ...current, [file.id]: '' }))
    const target = window.open('', '_blank')
    void api.downloadDocument(file.id).then((blob) => {
      const url = URL.createObjectURL(blob)
      if (target) target.location.href = url
      else {
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.target = '_blank'
        anchor.click()
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    }).catch((reason) => {
      target?.close()
      const missing = reason instanceof ApiRequestError && reason.message === 'Файл не найден'
      if (missing) onOperationError('Кажется, данные устарели', onRefreshData, staleTripMessage, staleTripOptions)
      else setDocumentErrors((current) => ({ ...current, [file.id]: 'Попробуйте скачать ещё раз' }))
    })
  }
  const downloadDocument = (file: TravelFile) => {
    setDocumentErrors((current) => ({ ...current, [file.id]: '' }))
    void api.downloadDocument(file.id).then((blob) => {
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = file.name
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
    }).catch((reason) => {
      const missing = reason instanceof ApiRequestError && reason.message === 'Файл не найден'
      if (missing) onOperationError('Кажется, данные устарели', onRefreshData, staleTripMessage, staleTripOptions)
      else setDocumentErrors((current) => ({ ...current, [file.id]: 'Попробуйте скачать ещё раз' }))
    })
  }
  if (expensesOpen) return <ExpensesScreen trip={trip} onBack={() => setExpensesOpen(false)} />
  return (
    <main className={tripBackgroundClassName('screen trip-background dashboard', backgroundReady)} style={tripBackgroundStyle(trip)}>
      <TripSidebar trip={trip} user={user} tripCount={tripCount} cacheState={cacheState} online={online} selectedCityId={selectedCityId} onCity={(city) => { setSelectedPlaceId(null); setSelectedCityId(city.id); setPanelReturnCityId(city.id); setSelectedCityDate(null); setSelectedPanel(null) }} onHotel={(city) => { setSelectedPlaceId(null); setPanelReturnCityId(selectedCityId); setSelectedCityDate(null); setSelectedCityId(city.id); setSelectedPanel('hotel') }} onTransport={(city, direction) => { setSelectedPlaceId(null); setPanelReturnCityId(selectedCityId); setSelectedCityDate(null); setSelectedCityId(city.id); setSelectedPanel(direction) }} onExpenses={() => setExpensesOpen(true)} onEdit={onEdit} onInvite={onInvite} onTrips={onTrips} onProfile={onProfile} />
      <section className={`calendar-column${selectedCity ? ' city-active' : ''}`}>
        {selectedCity ? (
          <CityPanel
            city={selectedCity}
            members={trip.members ?? []}
            tripStartDate={trip.startDate}
            tripEndDate={trip.endDate}
            tripTimeZone={trip.timeZone}
            tripAccentColor={trip.accentColor}
            initialPanel={selectedPanel}
            initialDate={selectedCityDate}
            initialFocusPlace={selectedPlaceId}
            documentErrors={documentErrors}
            previousCity={trip.cities[selectedCityIndex - 1]}
            nextCity={trip.cities[selectedCityIndex + 1]}
            onOpenManagedPanel={(cityId, panel) => { setSelectedPlaceId(null); setPanelReturnCityId(selectedCityId); setSelectedCityDate(null); setSelectedCityId(cityId); setSelectedPanel(panel) }}
            onPanelClose={() => { setSelectedCityId(panelReturnCityId); setSelectedPanel(null) }}
            onClose={() => { setSelectedPlaceId(null); setSelectedCityId(null); setPanelReturnCityId(null); setSelectedCityDate(null); setSelectedPanel(null) }}
            onChange={async (nextCity) => {
              const savedVersion = await onCityChange(nextCity)
              if (savedVersion) onChange({ ...trip, cities: trip.cities.map((city) => city.id === nextCity.id ? { ...nextCity, updatedAt: savedVersion } : city) })
              return savedVersion
            }}
            readOnly={!access.canEdit}
            routeReadOnly={!access.canManageTrip}
            onAddPlace={(nextCity, date, place) => { onChange({ ...trip, cities: trip.cities.map((city) => city.id === nextCity.id ? nextCity : city) }); onAddPlace(nextCity, date, place) }}
            onUpdatePlace={(nextCity, date, place) => { onChange({ ...trip, cities: trip.cities.map((city) => city.id === nextCity.id ? nextCity : city) }); onUpdatePlace(nextCity, date, place) }}
            onDeletePlace={onDeletePlace}
            onMovePlace={onMovePlace}
            onTrainChange={async (nextCity, direction, file, source) => {
              const linkedCity = direction === 'in' ? trip.cities[selectedCityIndex - 1] : trip.cities[selectedCityIndex + 1]
              onChange({
                ...trip,
                cities: trip.cities.map((city) => {
                  if (city.id === nextCity.id) return nextCity
                  if (!linkedCity || city.id !== linkedCity.id) return city
                  return {
                    ...city,
                    [direction === 'in' ? 'trainOut' : 'trainIn']: file.name,
                    files: city.files.some((item) => item.id === file.id) ? city.files : [...city.files, file],
                  }
                }),
              })
              return onTrainUpload(nextCity, direction, source)
            }}
            onHotelChange={async (nextCity, file, source) => {
              onChange({ ...trip, cities: trip.cities.map((city) => city.id === nextCity.id ? { ...nextCity, files: city.files.some((item) => item.id === file.id) ? city.files : [...city.files, file] } : city) })
              return onHotelUpload(nextCity, source)
            }}
            onOpenDocument={openDocument}
            onDownloadDocument={downloadDocument}
            onDeleteDocument={async (file) => {
              setDocumentErrors((current) => ({ ...current, [file.id]: '' }))
              try { await onDocumentDelete(file) }
              catch (reason) {
                if (reason instanceof ApiRequestError && reason.message === 'Удалить файл может его автор или владелец поездки') {
                  setDocumentErrors((current) => ({ ...current, [file.id]: 'Удалить файл может его автор или\u00a0владелец\u00a0поездки' }))
                  throw reason
                }
                throw reason
              }
            }}
          />
        ) : (
          <div className="calendar-content setup-transition">
            {allDays.some((date) => date < today) && <button className="past-toggle" onClick={() => setShowPast(!showPast)}>{showPast ? 'Скрыть прошедшие дни' : 'Показать прошедшие дни'}</button>}
            {visibleDays.map((date) => <DayCard key={date} date={date} cities={trip.cities.filter((city) => date >= city.arrival && date <= city.departure)} allCities={trip.cities} tripTimeZone={trip.timeZone} description={trip.dayDescriptions[date] ?? ''} hidden={date < today} onDescriptionChange={(description) => onDayDescriptionChange(date, description)} onEvent={(city, panel) => { setSelectedPlaceId(null); setPanelReturnCityId(null); setSelectedCityDate(null); setSelectedCityId(city.id); setSelectedPanel(panel) }} onCity={(city) => { setSelectedPlaceId(null); setSelectedCityId(city.id); setPanelReturnCityId(city.id); setSelectedCityDate(null); setSelectedPanel(null) }} onPlace={(city, placeId) => { setSelectedPlaceId(placeId); setSelectedCityId(city.id); setPanelReturnCityId(city.id); setSelectedCityDate(null); setSelectedPanel(null) }} />)}
            {visibleDays.length === 0 && <article className="glass empty-calendar"><h2>Все дни уже прошли</h2><Button onClick={() => setShowPast(true)}>Показать поездку</Button></article>}
          </div>
        )}
      </section>
    </main>
  )
}

export default function App() {
  const invitationLink = window.location.pathname.includes('/join/') ? window.location.href : ''
  const viewToken = window.location.pathname.includes('/view/') ? window.location.pathname.split('/view/').at(-1)?.split('/')[0]?.trim() ?? '' : ''
  const backgroundObjectUrlRef = useRef<string | null>(null)
  const avatarObjectUrlRef = useRef<string | null>(null)
  const memberAvatarUrlsRef = useRef<string[]>([])
  const cityImageUrlsRef = useRef<string[]>([])
  const tripLoadSequenceRef = useRef(0)
  const cityVersionsRef = useRef(new Map<string, string>())
  const tripRef = useRef<Trip | null>(null)
  const legacyTrip = useRef<Trip | null>((() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') } catch { return null }
  })())
  const [trip, setTrip] = useState<Trip | null>(null)
  const [trips, setTrips] = useState<ApiTripSummary[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [screen, setScreen] = useState<Screen>(viewToken ? 'view' : invitationLink ? 'join' : 'start')
  const [loading, setLoading] = useState(Boolean(session.token || viewToken))
  const [error, setError] = useState('')
  const [errorNotice, setErrorNotice] = useState<ErrorNotice | null>(null)
  const [successNotice, setSuccessNotice] = useState(false)
  const [setupRowErrors, setSetupRowErrors] = useState<Record<string, string>>({})
  const [conflictMessage, setConflictMessage] = useState('')
  const [remoteUpdateNotice, setRemoteUpdateNotice] = useState<RemoteUpdateNotice | null>(null)
  const [updateNoticeShakeKey, setUpdateNoticeShakeKey] = useState(0)
  const [remoteRefreshToken, setRemoteRefreshToken] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<ApiTripSummary | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const { state: cacheState, online, reconnectVersion, freshDataVersion } = useOfflineCache(trip?.id ?? null)
  useEffect(() => { tripRef.current = trip }, [trip])
  const showOperationError = (title: string, retry: () => void, message = 'Попробуйте ещё раз', options?: { retryLabel?: string; actionIcon?: 'retry' | 'refresh'; closable?: boolean; retryable?: boolean }) => setErrorNotice((current) => current?.title === 'Нет доступа к поездке' ? current : { title, message, retry: options?.retryable === false ? undefined : retry, ...options })

  useEffect(() => {
    const showAccessDenied = () => setErrorNotice({ title: 'Нет доступа к поездке', message: 'Обратитесь к её владельцу', closable: true })
    window.addEventListener(ACCESS_DENIED_EVENT, showAccessDenied)
    return () => window.removeEventListener(ACCESS_DENIED_EVENT, showAccessDenied)
  }, [])

  const loadCurrentUser = async () => {
    const account = await api.me()
    const user: CurrentUser = account.user
    if (user.hasAvatar) {
      try {
        const blob = await api.downloadAvatar()
        if (avatarObjectUrlRef.current) URL.revokeObjectURL(avatarObjectUrlRef.current)
        avatarObjectUrlRef.current = URL.createObjectURL(blob)
        user.avatarUrl = avatarObjectUrlRef.current
      } catch {
        // Метаданные и файловое хранилище могут разъехаться после переноса базы.
        // Отсутствующий аватар не должен блокировать вход в аккаунт.
        user.hasAvatar = false
        user.avatarUrl = undefined
      }
    }
    setCurrentUser(user)
    keepStorage()
    return user
  }

  useEffect(() => {
    if (viewToken) {
      void loadPublicTrip(viewToken).then(() => { setScreen('view'); setLoading(false) }).catch((reason) => { setError(reason instanceof ApiRequestError && reason.status === 404 ? 'Поездка не найдена' : 'Не удалось открыть поездку'); setLoading(false) })
      return
    }
    if (!session.token) return
    if (invitationLink) {
      const token = invitationLink.split('/join/').at(-1)?.trim()
      if (token) {
        void api.acceptInvitation(token).then(async ({ tripId }) => {
          window.history.replaceState({}, '', import.meta.env.BASE_URL)
          await loadCurrentUser()
          await refreshTrips(); await loadTrip(tripId); setScreen('dashboard'); setLoading(false)
        }).catch(async (reason) => {
          if (reason instanceof ApiRequestError && reason.status === 404) {
            window.history.replaceState({}, '', import.meta.env.BASE_URL)
            setError('')
            try { await openAccount() }
            catch { setError('Не удалось открыть аккаунт') }
            finally { setLoading(false) }
            return
          }
          setError('Не удалось принять приглашение')
          setLoading(false)
        })
        return
      }
    }
    void openAccount().catch((reason) => {
      if (reason instanceof ApiRequestError && reason.status === 401) session.token = ''
      else setError('Не удалось открыть аккаунт')
      setLoading(false)
    })
  }, [])

  const loadPublicTrip = async (token: string) => {
    const result = await api.publicTrip(token)
    const value = fromApiTrip(result.trip)
    cityVersionsRef.current = new Map(value.cities.flatMap((city) => city.updatedAt ? [[city.id, city.updatedAt]] : []))
    const imageUrls: string[] = []
    const loadImage = async (document: TravelFile) => {
      const blob = await api.downloadPublicDocument(token, document.id)
      const url = URL.createObjectURL(blob)
      imageUrls.push(url)
      return url
    }
    if (value.background) {
      try {
        value.backgroundUrl = await loadImage(value.background)
      } catch {
        value.background = undefined
        value.backgroundUrl = defaultTripBackground
      }
    }
    await Promise.all(value.cities.map(async (city) => { if (city.image) city.imageUrl = await loadImage(city.image) }))
    cityImageUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    if (backgroundObjectUrlRef.current) URL.revokeObjectURL(backgroundObjectUrlRef.current)
    backgroundObjectUrlRef.current = value.backgroundUrl && value.backgroundUrl !== defaultTripBackground ? value.backgroundUrl : null
    cityImageUrlsRef.current = imageUrls.filter((url) => url !== backgroundObjectUrlRef.current)
    setTrip(value)
    void requestPrefetch(result.trip.id, tripResourceUrls({ trip: result.trip, base: import.meta.env.BASE_URL, hasOwnAvatar: false, publicToken: token }))
    return value
  }

  const loadTrip = async (id: string) => {
    const loadSequence = ++tripLoadSequenceRef.current
    const result = await api.trip(id)
    const value = fromApiTrip(result.trip)
    cityVersionsRef.current = new Map(value.cities.flatMap((city) => city.updatedAt ? [[city.id, city.updatedAt]] : []))
    const previousCityImageUrls = cityImageUrlsRef.current
    const nextCityImageUrls: string[] = []
    memberAvatarUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    memberAvatarUrlsRef.current = []
    await Promise.all((value.members ?? []).map(async (member) => {
      if (!member.hasAvatar) return
      try {
        const blob = await api.downloadMemberAvatar(id, member.id)
        member.avatarUrl = URL.createObjectURL(blob)
        memberAvatarUrlsRef.current.push(member.avatarUrl)
      } catch {
        member.avatarUrl = undefined
      }
    }))
    if (value.background) {
      try {
        const blob = await api.downloadDocument(value.background.id)
        if (backgroundObjectUrlRef.current) URL.revokeObjectURL(backgroundObjectUrlRef.current)
        backgroundObjectUrlRef.current = URL.createObjectURL(blob)
        value.backgroundUrl = backgroundObjectUrlRef.current
      } catch {
        if (backgroundObjectUrlRef.current) URL.revokeObjectURL(backgroundObjectUrlRef.current)
        backgroundObjectUrlRef.current = null
        value.background = undefined
        value.backgroundUrl = defaultTripBackground
      }
    } else {
      if (backgroundObjectUrlRef.current) URL.revokeObjectURL(backgroundObjectUrlRef.current)
      backgroundObjectUrlRef.current = null
      value.backgroundUrl = defaultTripBackground
    }
    await Promise.all(value.cities.map(async (city) => {
      if (!city.image) return
      try {
        const blob = await api.downloadDocument(city.image.id)
        city.imageUrl = URL.createObjectURL(blob)
        nextCityImageUrls.push(city.imageUrl)
      } catch {
        city.imageUrl = undefined
      }
    }))
    if (loadSequence !== tripLoadSequenceRef.current) {
      nextCityImageUrls.forEach((url) => URL.revokeObjectURL(url))
      return value
    }
    cityImageUrlsRef.current = nextCityImageUrls
    setTrip(value)
    void requestPrefetch(id, [
      ...tripsListResourceUrls(trips, import.meta.env.BASE_URL),
      ...tripResourceUrls({ trip: result.trip, base: import.meta.env.BASE_URL, hasOwnAvatar: Boolean(currentUser?.hasAvatar) }),
    ])
    window.setTimeout(() => previousCityImageUrls.forEach((url) => URL.revokeObjectURL(url)), 1_000)
    return value
  }

  // После реального возврата сети не оставляем на экране офлайн-снимок.
  useEffect(() => {
    if ((!reconnectVersion && !freshDataVersion) || !trip?.id) return
    const reload = () => {
      const refresh = screen === 'view' && viewToken ? loadPublicTrip(viewToken) : loadTrip(trip.id!)
      void refresh.catch(() => showOperationError('Эх, не загружается', reload))
    }
    reload()
  }, [reconnectVersion, freshDataVersion])

  useEffect(() => {
    if (!trip?.id || !online || (screen !== 'dashboard' && screen !== 'setup')) return
    let active = true
    let checking = false
    const checkForUpdates = async () => {
      if (checking || document.visibilityState === 'hidden') return
      checking = true
      try {
        const result = await api.freshTrip(trip.id!)
        const localTrip = tripRef.current
        if (!active || !localTrip || localTrip.id !== result.trip.id) return
        const remoteTrip = fromApiTrip(result.trip)
        if (hasDifferentProtectedData(remoteTrip, localTrip)) {
          setRemoteUpdateNotice({ message: tripChangeMessage(result.trip.last_change) })
        }
      } catch {
        // Фоновая проверка не должна мешать работе с формой при нестабильной сети.
      } finally {
        checking = false
      }
    }
    void checkForUpdates()
    const timer = window.setInterval(() => void checkForUpdates(), 12_000)
    const onFocus = () => void checkForUpdates()
    window.addEventListener('focus', onFocus)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [trip?.id, online, screen])

  const refreshProtectedData = async () => {
    if (!trip?.id) return
    try {
      await loadTrip(trip.id)
      setRemoteRefreshToken((value) => value + 1)
      setRemoteUpdateNotice(null)
      setConflictMessage('')
      setUpdateNoticeShakeKey(0)
    } catch (reason) {
      showOperationError('Эх, не загружается', () => void refreshProtectedData())
    }
  }

  const refreshTrips = async () => {
    const result = await api.trips()
    setTrips(result.trips)
    if (!trip) void requestPrefetch(null, tripsListResourceUrls(result.trips, import.meta.env.BASE_URL))
    return result.trips
  }

  const showConflictNotice = async () => {
    if (conflictMessage || remoteUpdateNotice) setUpdateNoticeShakeKey((value) => value + 1)
    if (remoteUpdateNotice) {
      setConflictMessage(remoteUpdateNotice.message)
      return
    }
    try {
      const result = trip?.id ? await api.freshTrip(trip.id) : null
      setConflictMessage(tripChangeMessage(result?.trip.last_change))
    } catch {
      setConflictMessage('В поездке появились новые данные')
    }
  }

  const createFromDraft = async (draft: Trip) => {
    const created = await api.createTrip({ name: draft.name, startDate: draft.startDate, endDate: draft.endDate, timeZone: draft.timeZone, accentColor: draft.accentColor, backgroundRemoved: draft.backgroundRemoved })
    const cityIds = new Map<string, string>()
    for (const [position, city] of draft.cities.entries()) {
      const result = await api.createCity(created.trip.id, {
        name: city.name, position, arrivalDate: city.arrival, departureDate: city.departure,
        arrivalPeriod: city.arrivalPeriod, departurePeriod: city.departurePeriod, ...cityLocationPayload(city), ...hotelPayload(city), ...transportPayload(city), ...assignmentPayload(city),
      })
      cityIds.set(city.id, result.city.id)
      if (city.imageFile) await api.uploadDocument(created.trip.id, result.city.id, 'city-image', city.imageFile)
      if (city.hotel || city.hotelUrl || city.hotelCheckInTime || city.hotelCheckOutTime) await api.updateCity(created.trip.id, result.city.id, { ...hotelPayload(city), expectedUpdatedAt: result.city.updated_at })
      for (const [date, places] of Object.entries(city.places)) {
        for (const place of places) await api.createPlace(created.trip.id, result.city.id, { name: place.name, googleMapsUrl: place.url, icon: place.icon, notes: place.notes, latitude: place.latitude, longitude: place.longitude, ...(date === UNSCHEDULED_KEY ? {} : { visitDate: date }) })
      }
    }
    if (draft.backgroundFile) await api.uploadDocument(created.trip.id, undefined, 'trip-background', draft.backgroundFile)
    localStorage.removeItem(STORAGE_KEY)
    await refreshTrips()
    return loadTrip(created.trip.id)
  }

  const openAccount = async () => {
    setLoading(true); setError('')
    try {
      await loadCurrentUser()
      const accountTrips = await refreshTrips()
      if (accountTrips.length === 1) {
        await loadTrip(accountTrips[0].id)
        setScreen('dashboard')
      } else if (accountTrips.length > 1) {
        setTrip(null)
        setScreen('trips')
      } else if (legacyTrip.current) {
        await createFromDraft(legacyTrip.current)
        setScreen('dashboard')
      } else {
        setScreen('setup')
      }
    } finally { setLoading(false) }
  }

  const saveTrip = async (draft: Trip) => {
    setError('')
    setErrorNotice(null)
    setSuccessNotice(false)
    setSetupRowErrors({})
    try {
      let saved: Trip
      if (!draft.id) {
        saved = await createFromDraft(draft)
      } else {
        await api.updateTrip(draft.id, { name: draft.name, startDate: draft.startDate, endDate: draft.endDate, timeZone: draft.timeZone, accentColor: draft.accentColor, backgroundRemoved: draft.backgroundRemoved, expectedUpdatedAt: draft.updatedAt })
        const remote = (await api.trip(draft.id)).trip
        const existingIds = new Set(remote.cities.map((city) => city.id))
        for (const cityId of draft.deletedCityIds ?? []) await api.deleteCity(draft.id, cityId)
        for (const [position, city] of draft.cities.entries()) {
          const payload = { name: city.name, position, arrivalDate: city.arrival, departureDate: city.departure, arrivalPeriod: city.arrivalPeriod, departurePeriod: city.departurePeriod, ...cityLocationPayload(city), ...hotelPayload(city), ...transportPayload(city), ...assignmentPayload(city) }
          const cityId = existingIds.has(city.id) ? city.id : (await api.createCity(draft.id, payload)).city.id
          if (existingIds.has(city.id)) await api.updateCity(draft.id, city.id, { ...payload, expectedUpdatedAt: city.updatedAt })
          if (city.imageDeleteId) await api.deleteDocument(city.imageDeleteId)
          if (city.imageFile) {
            try { await api.uploadDocument(draft.id, cityId, 'city-image', city.imageFile) }
            catch (reason) { setSetupRowErrors({ [`city-image:${city.id}`]: imageRowErrorMessage(reason) }); return }
          }
        }
        if (draft.backgroundDeleteId) await api.deleteDocument(draft.backgroundDeleteId)
        if (draft.backgroundFile) {
          try { await api.uploadDocument(draft.id, undefined, 'trip-background', draft.backgroundFile) }
          catch (reason) { setSetupRowErrors({ background: imageRowErrorMessage(reason) }); return }
        }
        saved = await loadTrip(draft.id)
      }
      return saved
    } catch (reason) {
      if (isConflictError(reason) && !isTripDatesExcludeCitiesError(reason)) await showConflictNotice()
      else if (isTripDatesExcludeCitiesError(reason)) showOperationError('Эх, не сохраняется', () => undefined, 'Проверьте даты городов', { retryable: false })
      else if (isStaleTripDataError(reason)) showOperationError('Кажется, данные устарели', () => { if (draft.id) void loadTrip(draft.id); else void refreshTrips() }, staleTripMessage, staleTripOptions)
      else {
        const uploadMessage = uploadErrorMessage(reason)
        showOperationError(uploadMessage ? uploadErrorTitle(uploadMessage) : 'Эх, не сохраняется', () => void saveTrip(draft), uploadMessage, isNonRetryableUploadMessage(uploadMessage) ? { retryable: false } : undefined)
      }
    }
    return undefined
  }

  const saveCityPayload = async (cityId: string, payload: Record<string, unknown>, expectedUpdatedAt?: string) => {
    if (!trip?.id) return
    const result = await api.updateCity(trip.id, cityId, { ...payload, expectedUpdatedAt: expectedUpdatedAt ?? cityVersionsRef.current.get(cityId) })
    cityVersionsRef.current.set(cityId, result.city.updated_at)
    setTrip((current) => current ? { ...current, cities: current.cities.map((city) => city.id === cityId ? { ...city, updatedAt: result.city.updated_at } : city) } : current)
    return result.city
  }

  const updateCity = async (city: City) => {
    if (!trip?.id) return
    try {
      const saved = await saveCityPayload(city.id, { name: city.name, arrivalDate: city.arrival, departureDate: city.departure, arrivalPeriod: city.arrivalPeriod, departurePeriod: city.departurePeriod, ...cityLocationPayload(city), ...hotelPayload(city), ...transportPayload(city), ...assignmentPayload(city) }, city.updatedAt)
      return saved?.updated_at
    }
    catch (reason) {
      if (isConflictError(reason)) await showConflictNotice()
      else if (isStaleTripDataError(reason)) showOperationError('Кажется, данные устарели', () => void loadTrip(trip.id!), staleTripMessage, staleTripOptions)
      else showOperationError('Эх, не сохраняется', () => void updateCity(city))
      return undefined
    }
  }

  const addPlace = async (city: City, date: string, place: Place) => {
    if (!trip?.id) return
    try {
      await api.createPlace(trip.id, city.id, { name: place.name, googleMapsUrl: place.url, icon: place.icon, notes: place.notes, latitude: place.latitude, longitude: place.longitude, ...(date === UNSCHEDULED_KEY ? {} : { visitDate: date }) })
      await loadTrip(trip.id)
    } catch (reason) {
      const missing = isMissingCityError(reason)
      showOperationError(missing ? 'Кажется, данные устарели' : isDuplicatePlaceError(reason) ? duplicatePlaceTitle : 'Эх, не сохраняется', missing ? () => void loadTrip(trip.id!) : () => void addPlace(city, date, place), missing ? staleTripMessage : isDuplicatePlaceError(reason) ? duplicatePlaceMessage : undefined, missing ? staleTripOptions : isDuplicatePlaceError(reason) ? { retryable: false } : undefined)
      if (!missing) await loadTrip(trip.id)
    }
  }

  const updatePlace = async (city: City, date: string, place: Place) => {
    if (!trip?.id) return
    try {
      // visitDate: null здесь обязателен — иначе точку нельзя вернуть в «Без даты».
      await api.updatePlace(trip.id, place.id, { name: place.name, googleMapsUrl: place.url, icon: place.icon, notes: place.notes, latitude: place.latitude, longitude: place.longitude, visitDate: date === UNSCHEDULED_KEY ? null : date })
    } catch (reason) {
      showOperationError(isDuplicatePlaceError(reason) ? duplicatePlaceTitle : 'Эх, не сохраняется', () => void updatePlace(city, date, place), isDuplicatePlaceError(reason) ? duplicatePlaceMessage : undefined, isDuplicatePlaceError(reason) ? { retryable: false } : undefined)
      await loadTrip(trip.id)
    }
  }

  const deletePlace = async (placeId: string) => {
    if (!trip?.id) return
    try {
      await api.deletePlace(trip.id, placeId)
    } catch (reason) {
      const missing = isMissingDeletionError(reason)
      showOperationError(missing ? 'Кажется, данные устарели' : 'Эх, не удаляется', missing ? () => void loadTrip(trip.id!) : () => void deletePlace(placeId), deletionErrorMessage(reason), missing ? { retryLabel: 'Обновить данные', actionIcon: 'refresh', closable: false } : undefined)
      if (!missing) await loadTrip(trip.id)
    }
  }

  const movePlace = async (placeId: string, date: string | null, position: number) => {
    if (!trip?.id) return
    try {
      await api.movePlace(trip.id, placeId, { visitDate: date, position })
    } catch (reason) {
      showOperationError(isDuplicatePlaceError(reason) ? duplicatePlaceTitle : 'Эх, не сохраняется', () => void movePlace(placeId, date, position), isDuplicatePlaceError(reason) ? duplicatePlaceMessage : undefined, isDuplicatePlaceError(reason) ? { retryable: false } : undefined)
      await loadTrip(trip.id)
    }
  }

  const uploadTrain = async (city: City, direction: 'in' | 'out', file: File): Promise<TravelFile | undefined> => {
    if (!trip?.id) return
    const index = trip.cities.findIndex((item) => item.id === city.id)
    const linked = direction === 'in' ? trip.cities[index - 1] : trip.cities[index + 1]
    const from = direction === 'in' ? linked : city
    const to = direction === 'in' ? city : linked
    const fromId = from?.id ?? 'external'
    const toId = to?.id ?? 'external'
    const ticketId = uid()
    try {
      const routeKey = `${fromId}:${toId}:${ticketId}`
      const uploaded = await api.uploadDocument(trip.id, city.id, `${direction === 'in' ? 'train-in' : 'train-out'}:${routeKey}`, file)
      if (linked) await api.uploadDocument(trip.id, linked.id, `${direction === 'in' ? 'train-out' : 'train-in'}:${routeKey}`, file)
      await loadTrip(trip.id)
      return { id: uploaded.document.id, name: uploaded.document.original_name, category: uploaded.document.category, uploadedBy: uploaded.document.created_by_name, uploadedAt: uploaded.document.created_at }
    } catch (reason) { if (isMissingCityError(reason)) showOperationError('Кажется, данные устарели', () => void loadTrip(trip.id!), staleTripMessage, staleTripOptions); throw reason }
  }

  const uploadHotel = async (city: City, file: File): Promise<TravelFile | undefined> => {
    if (!trip?.id) return
    try {
      await saveCityPayload(city.id, hotelPayload(city), city.updatedAt)
      const uploaded = await api.uploadDocument(trip.id, city.id, 'hotel-booking', file)
      await loadTrip(trip.id)
      return { id: uploaded.document.id, name: uploaded.document.original_name, category: uploaded.document.category, uploadedBy: uploaded.document.created_by_name, uploadedAt: uploaded.document.created_at }
    } catch (reason) { if (isMissingCityError(reason)) showOperationError('Кажется, данные устарели', () => void loadTrip(trip.id!), staleTripMessage, staleTripOptions); throw reason }
  }

  const joinTrip = async (link: string, name: string, email: string, password: string, mode: 'login' | 'register') => {
    setError('')
    const token = link.split('/join/').at(-1)?.trim()
    if (!token) { setError('Неправильная ссылка'); return }
    try {
      const auth = mode === 'register' ? await api.register(email, password, name) : await api.login(email, password)
      session.token = auth.token
      await loadCurrentUser()
      const accepted = await api.acceptInvitation(token)
      window.history.replaceState({}, '', import.meta.env.BASE_URL)
      await refreshTrips(); await loadTrip(accepted.tripId); setScreen('dashboard')
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : ''
      if (reason instanceof ApiRequestError && reason.status === 404) setError('Неправильная ссылка')
      else if (accountFieldErrors.has(message)) setError(message)
      else showOperationError('Ох, не присоединяется', () => void joinTrip(link, name, email, password, mode))
    }
  }

  const exportTripFile = async (item: ApiTripSummary) => {
    try {
      const blob = await api.exportTrip(item.id)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${item.name}.travelspace`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch {
      showOperationError('Эх, поездка не скачивается', () => void exportTripFile(item))
    }
  }

  const importTripFile = async (file: File) => {
    try {
      const result = await api.importTrip(file)
      await refreshTrips()
      await loadTrip(result.trip.id)
      setScreen('dashboard')
    } catch (reason) {
      const oversized = reason instanceof ApiRequestError && (reason.status === 413 || /превышают допустимый размер|file too large/i.test(reason.message))
      const oversizedMessage = reason instanceof ApiRequestError && /^Файл «/.test(reason.message) ? 'Должен быть до 15 МБ' : 'Должен быть до 200 МБ'
      const content = importErrorContent(reason)
      showOperationError(content?.title ?? (oversized ? 'Какой огромный файл' : 'Эх, поездка не загружается'), () => void importTripFile(file), content?.message ?? (oversized ? oversizedMessage : undefined), content || oversized ? { retryable: false } : undefined)
    }
  }

  const deleteDocument = async (file: TravelFile) => {
    if (!trip?.id) return
    try {
      await api.deleteDocument(file.id)
      await loadTrip(trip.id)
    } catch (reason) {
      const missing = isMissingDeletionError(reason)
      const forbidden = reason instanceof ApiRequestError && reason.message === 'Удалить файл может его автор или владелец поездки'
      if (missing) showOperationError('Кажется, данные устарели', () => void loadTrip(trip.id!), deletionErrorMessage(reason), { retryLabel: 'Обновить данные', actionIcon: 'refresh', closable: false })
      else if (!forbidden) showOperationError('Эх, не удаляется', () => void deleteDocument(file), deletionErrorMessage(reason))
      throw reason
    }
  }

  const deleteTrip = async (item: ApiTripSummary) => {
    try {
      await api.deleteTrip(item.id, item.name)
      setDeleteTarget(null)
      const remaining = await refreshTrips()
      if (remaining.length === 1) {
        await loadTrip(remaining[0].id)
        setScreen('dashboard')
      }
    } catch (reason) {
      const missing = isMissingDeletionError(reason)
      showOperationError(missing ? 'Кажется, данные устарели' : 'Эх, не удаляется', missing ? () => void refreshTrips() : () => void deleteTrip(item), deletionErrorMessage(reason), missing ? { retryLabel: 'Обновить данные', actionIcon: 'refresh', closable: false } : undefined)
    }
  }

  // Один выключатель на всё приложение: экраны спрашивают useAccess(), а не
  // выводят право на правку из роли или navigator.onLine самостоятельно.
  const access = useMemo(
    () => tripAccess({ publicView: screen === 'view', offline: !online, role: trip?.role }),
    [screen, online, trip?.role],
  )

  const renderScreen = () => {
  if (loading) return <AuthShell><AuthPanel><h1>Загружаем поездку…</h1></AuthPanel></AuthShell>

  if (screen === 'view') {
    if (!trip) return <AuthShell><AuthPanel><h1>{error || 'Поездка не найдена'}</h1></AuthPanel></AuthShell>
    const noop = () => undefined
    const noopAsync = async () => undefined
    return <Dashboard trip={trip} user={null} tripCount={0} cacheState={cacheState} online={online} onChange={noop} onEdit={noop} onTrips={noop} onProfile={noop} onInvite={noop} onCityChange={noopAsync} onDayDescriptionChange={noop} onAddPlace={noop} onUpdatePlace={noop} onDeletePlace={noop} onMovePlace={noop} onTrainUpload={noopAsync} onHotelUpload={noopAsync} onDocumentDelete={noopAsync} onRefreshData={noop} onOperationError={noop} />
  }

  if (screen === 'start' || screen === 'login' || screen === 'join') {
    return (
      <AuthShell onBack={screen === 'start' ? undefined : () => setScreen('start')}>
        {screen === 'start' && <StartScreen onLogin={() => setScreen('login')} onJoin={() => setScreen('join')} />}
        {screen === 'login' && <LoginScreen onSubmit={openAccount} onOperationError={showOperationError} />}
        {screen === 'join' && <JoinScreen initialLink={invitationLink} onSubmit={joinTrip} serverError={error} onClearError={() => setError('')} />}
        {error && (screen !== 'join' || (!accountFieldErrors.has(error) && error !== 'Неправильная ссылка')) && <p className="form-hint app-error">{error}</p>}
      </AuthShell>
    )
  }
  if (screen === 'profile' && currentUser) return <ProfileScreen user={currentUser} onBack={() => setScreen(trip ? 'dashboard' : trips.length ? 'trips' : 'start')} onOperationError={showOperationError} onLogout={() => {
    tripLoadSequenceRef.current += 1
    void clearPrivateCaches()
    session.token = ''
    if (backgroundObjectUrlRef.current) URL.revokeObjectURL(backgroundObjectUrlRef.current)
    if (avatarObjectUrlRef.current) URL.revokeObjectURL(avatarObjectUrlRef.current)
    memberAvatarUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    cityImageUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    backgroundObjectUrlRef.current = null
    avatarObjectUrlRef.current = null
    memberAvatarUrlsRef.current = []
    cityImageUrlsRef.current = []
    setCurrentUser(null)
    setTrip(null)
    setTrips([])
    setDeleteTarget(null)
    setInviteOpen(false)
    setError('')
    setScreen('start')
  }} onSave={async (value) => { const result = await api.updateProfile(value); setCurrentUser((existing) => ({ ...result.user, avatarUrl: existing?.avatarUrl })) }} onAvatar={async (file) => {
    await api.uploadAvatar(file)
    const blob = await api.downloadAvatar()
    if (avatarObjectUrlRef.current) URL.revokeObjectURL(avatarObjectUrlRef.current)
    avatarObjectUrlRef.current = URL.createObjectURL(blob)
    const avatarUrl = avatarObjectUrlRef.current
    setCurrentUser((existing) => existing ? { ...existing, hasAvatar: true, avatarUrl } : existing)
    setTrip((current) => current ? { ...current, members: current.members?.map((member) => member.id === currentUser.id ? { ...member, hasAvatar: true, avatarUrl } : member) } : current)
    return avatarUrl
  }} />
  if (screen === 'trips') return <><TripsScreen trips={trips} canCreate={currentUser?.email.toLowerCase() === ADMIN_EMAIL} deleteTarget={deleteTarget} onOpen={(id) => { void loadTrip(id).then(() => setScreen('dashboard')).catch(() => showOperationError('Эх, не загружается', () => void loadTrip(id).then(() => setScreen('dashboard')))) }} onCreate={() => { setTrip(null); setScreen('setup') }} onClose={() => { setDeleteTarget(null); setScreen(trip ? 'dashboard' : 'start') }} onDelete={setDeleteTarget} onCloseDelete={() => setDeleteTarget(null)} onConfirmDelete={async () => { if (deleteTarget) await deleteTrip(deleteTarget) }} onExport={exportTripFile} onImport={importTripFile} />{error && <p className="app-error">{error}</p>}</>
  if (screen === 'setup') return <><SetupScreen initial={trip} user={currentUser} refreshToken={remoteRefreshToken} rowErrors={setupRowErrors} onClearRowError={(key) => setSetupRowErrors((current) => { const next = { ...current }; delete next[key]; return next })} onExit={() => setScreen(trip ? 'dashboard' : trips.length ? 'trips' : 'start')} onCreate={saveTrip} onCitySaved={() => { setSuccessNotice(false); window.setTimeout(() => setSuccessNotice(true), 0) }} />{error && <p className="app-error">{error}</p>}</>
  if (!trip) return null
  if (inviteOpen) return <><InviteScreen trip={trip} onBack={() => setInviteOpen(false)} onCreate={async (hours) => (await api.createInvitation(trip.id!, hours)).invitation} onViewLink={async () => (await api.viewLink(trip.id!)).viewLink.url} onRemove={async (member) => { await api.removeMember(trip.id!, member.id); await loadTrip(trip.id!) }} onRefresh={async () => { await loadTrip(trip.id!) }} onOperationError={showOperationError} />{error && <p className="app-error">{error}</p>}</>
  return <><Dashboard trip={trip} user={currentUser} tripCount={trips.length} cacheState={cacheState} online={online} onChange={setTrip} onEdit={() => { if (!trip.id) return; void loadTrip(trip.id).then(() => setScreen('setup')).catch(() => showOperationError('Эх, не загружается', () => void loadTrip(trip.id!).then(() => setScreen('setup')))) }} onTrips={() => { const openTrips = () => void refreshTrips().then(() => setScreen('trips')).catch(() => showOperationError('Эх, не загружается', openTrips)); openTrips() }} onProfile={() => setScreen('profile')} onInvite={() => setInviteOpen(true)} onCityChange={updateCity} onDayDescriptionChange={(date, description) => { setTrip((current) => current ? { ...current, dayDescriptions: { ...current.dayDescriptions, [date]: description } } : current); if (!trip.id) return; const saveDescription = () => void api.updateDayDescription(trip.id!, date, description).catch(() => { showOperationError('Эх, не сохраняется', saveDescription); void loadTrip(trip.id!) }); saveDescription() }} onAddPlace={(city, date, place) => void addPlace(city, date, place)} onUpdatePlace={(city, date, place) => void updatePlace(city, date, place)} onDeletePlace={(placeId) => void deletePlace(placeId)} onMovePlace={(placeId, date, position) => void movePlace(placeId, date, position)} onTrainUpload={uploadTrain} onHotelUpload={uploadHotel} onDocumentDelete={deleteDocument} onRefreshData={() => void refreshProtectedData()} onOperationError={showOperationError} />{error && <p className="app-error">{error}</p>}</>
  }

  const updateNoticeMessage = conflictMessage || remoteUpdateNotice?.message
  return <AccessContext.Provider value={access}>
    {renderScreen()}
    {updateNoticeMessage && <UpdateNotification key={updateNoticeShakeKey} message={updateNoticeMessage} shake={Boolean(updateNoticeShakeKey)} onRefresh={() => void refreshProtectedData()} />}
    {errorNotice && <ErrorNotification title={errorNotice.title} message={errorNotice.message} onClose={errorNotice.closable === false ? undefined : () => setErrorNotice(null)} retryLabel={errorNotice.retryLabel} actionIcon={errorNotice.actionIcon} onRetry={errorNotice.retry ? () => { const retry = errorNotice.retry!; setErrorNotice(null); retry() } : undefined} />}
    {successNotice && <SuccessNotification onClose={() => setSuccessNotice(false)} />}
  </AccessContext.Provider>
}
