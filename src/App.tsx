import { CSSProperties, FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { api, ApiTripDetails, ApiTripSummary, session, TransportType } from './api'
import { Button, IconButton } from './components/Button'
import { AddRow } from './components/AddRow'
import { Input, Select, Textarea } from './components/FormControls'
import { InfoRow } from './components/InfoRow'
import { TypographyGroup } from './components/TypographyGroup'
import { Tabs } from './components/Tabs'
import { Icon, type IconName } from './components/Icon'
import { UNSCHEDULED_KEY } from './places'
import { PlacesMap } from './components/PlacesMap'
import { PlaceDayList } from './components/PlaceDayList'
import { placeIconUrl, type PlaceIconKey } from './placeIcons'
import { SecondaryText } from './components/SecondaryText'
import { CityRow } from './components/CityRow'
import { CacheIndicator } from './components/CacheIndicator'
import { IconText } from './components/IconText'
import { ItemList } from './components/ItemList'
import { tripResourceUrls, tripsListResourceUrls } from './offline/resources'
import { clearPrivateCaches, keepStorage, requestPrefetch, useOfflineCache } from './offline/useOfflineCache'
import type { CacheState } from './offline/cacheState'
import { AccessContext, tripAccess, useAccess } from './tripAccess'

type Place = { id: string; name: string; url: string; icon: PlaceIconKey; latitude?: number; longitude?: number }
type Task = { id: string; title: string; done: boolean }
type TravelFile = { id: string; name: string; category: string; uploadedBy?: string; uploadedAt?: string }
type HotelDetails = { name: string; url: string; checkInTime: string; checkOutTime: string; notes: string; payerIds: string[]; totalAmountRubles: number }
type TransportDetails = { type?: TransportType; name: string; departureDate: string; arrivalDate: string; departureTime: string; arrivalTime: string; departureTimeZone: string; arrivalTimeZone: string; departureStation: string; departureStationUrl: string; arrivalStation: string; arrivalStationUrl: string; notes: string; ticketOnSite: boolean; payerIds: string[]; totalAmountRubles: number }
type TripMember = { id: string; email: string; displayName: string; role: 'owner' | 'member'; hasAvatar?: boolean; avatarUrl?: string }
type CurrentUser = { id: string; email: string; displayName: string; hasAvatar: boolean; avatarUrl?: string }
type DayPeriod = 'morning' | 'day' | 'evening'
type City = {
  id: string
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
  tasks: Task[]
  files: TravelFile[]
  image?: TravelFile
  imageUrl?: string
  imageFile?: File
  imageDeleteId?: string
}
type Trip = { id?: string; role?: 'owner' | 'member'; name: string; startDate: string; endDate: string; timeZone: string; cities: City[]; dayDescriptions: Record<string, string>; members?: TripMember[]; memberCount?: number; background?: TravelFile; backgroundUrl?: string; backgroundFile?: File; backgroundRemoved?: boolean; backgroundDeleteId?: string }
type Screen = 'start' | 'login' | 'join' | 'trips' | 'setup' | 'dashboard' | 'profile' | 'view'
export type { IconName } from './components/Icon'

const STORAGE_KEY = 'tabi-trip-v1'
const ADMIN_EMAIL = 'mirrorkey6629@gmail.com'
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
const formatDate = (value: string) => {
  const date = parseDate(value)
  return `${date.getDate()} ${ruMonths[date.getMonth()]}`
}
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

const tripBackgroundStyle = (trip: Trip): CSSProperties => ({ '--trip-background-image': trip.backgroundRemoved ? 'none' : `url("${trip.backgroundUrl || defaultTripBackground}")` } as CSSProperties)


const fromApiTrip = (source: ApiTripDetails): Trip => {
  const backgroundDocument = source.documents.find((document) => !document.city_id && document.category === 'trip-background')
  const cities = source.cities.map<City>((city) => {
    const places: Record<string, Place[]> = {}
    source.places.filter((place) => place.city_id === city.id).forEach((place) => {
      const key = place.visit_date?.slice(0, 10) || UNSCHEDULED_KEY
      ;(places[key] ??= []).push({ id: place.id, name: place.name, url: place.google_maps_url, icon: place.icon ?? 'default', latitude: place.latitude ?? undefined, longitude: place.longitude ?? undefined })
    })
    const documents = source.documents.filter((document) => document.city_id === city.id)
    const trainIn = documents.find((document) => document.category.startsWith('train-in:'))?.original_name || city.train_in
    const trainOut = documents.find((document) => document.category.startsWith('train-out:'))?.original_name || city.train_out
    const imageDocument = documents.find((document) => document.category === 'city-image')
    return {
      id: city.id,
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
      tasks: source.tasks.filter((task) => task.city_id === city.id).map((task) => ({ id: task.id, title: task.title, done: task.done })),
      files: documents.map((document) => ({ id: document.id, name: document.original_name, category: document.category, uploadedBy: document.created_by_name, uploadedAt: document.created_at })),
      image: imageDocument ? { id: imageDocument.id, name: imageDocument.original_name, category: imageDocument.category, uploadedBy: imageDocument.created_by_name, uploadedAt: imageDocument.created_at } : undefined,
    }
  }).sort(compareCitiesByDate)
  return { id: source.id, role: source.role, name: source.name, startDate: source.start_date.slice(0, 10), endDate: source.end_date.slice(0, 10), timeZone: source.time_zone || 'UTC', cities, dayDescriptions: Object.fromEntries(source.day_notes.map((note) => [note.day_date.slice(0, 10), note.description])), members: source.members.map((member) => ({ id: member.id, email: member.email, displayName: member.display_name, role: member.role, hasAvatar: member.has_avatar })), memberCount: source.member_count ?? source.members.length, background: backgroundDocument ? { id: backgroundDocument.id, name: backgroundDocument.original_name, category: backgroundDocument.category } : undefined, backgroundUrl: source.background_removed ? undefined : defaultTripBackground, backgroundRemoved: Boolean(source.background_removed) }
}

// BASE_URL — это vite base, всегда со слэшем на конце. Строки, которые JS собирает
// сам, Vite префиксом не дополняет, в отличие от путей в HTML и CSS.
export function GalaxyBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let width = 0
    let height = 0
    let time = 0
    let pointerX = 0
    let pointerY = 0
    let targetPointerX = 0
    let targetPointerY = 0
    let stars: Array<{ x: number; y: number; z: number; size: number; speed: number; alpha: number; hue: number; twinkle: number }> = []
    const reset = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * ratio
      canvas.height = height * ratio
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      const count = Math.min(900, Math.max(320, Math.floor((width * height) / 1800)))
      stars = Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * width * 1.8,
        y: (Math.random() - 0.5) * height * 1.8,
        z: 0.14 + Math.random() * 0.86,
        size: 0.35 + Math.pow(Math.random(), 3) * 2.2,
        speed: 0.000018 + Math.random() * 0.000026,
        alpha: 0.22 + Math.random() * 0.78,
        hue: 190 + Math.random() * 95,
        twinkle: Math.random() * Math.PI * 2,
      }))
    }
    const draw = (timestamp = 0) => {
      context.clearRect(0, 0, width, height)
      const delta = time ? Math.min(timestamp - time, 32) : 16
      time = timestamp
      pointerX += (targetPointerX - pointerX) * 0.035
      pointerY += (targetPointerY - pointerY) * 0.035

      const background = context.createRadialGradient(width * 0.5, height * 0.45, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.78)
      background.addColorStop(0, '#17142f')
      background.addColorStop(0.45, '#080a1c')
      background.addColorStop(1, '#010208')
      context.fillStyle = background
      context.fillRect(0, 0, width, height)

      const nebula = context.createRadialGradient(width * 0.35, height * 0.58, 0, width * 0.35, height * 0.58, Math.max(width, height) * 0.55)
      nebula.addColorStop(0, 'rgba(88, 72, 190, .22)')
      nebula.addColorStop(0.38, 'rgba(36, 80, 156, .11)')
      nebula.addColorStop(1, 'rgba(0, 0, 0, 0)')
      context.fillStyle = nebula
      context.fillRect(0, 0, width, height)

      const centerX = width * 0.5 + pointerX * 8
      const centerY = height * 0.5 + pointerY * 6
      for (const star of stars) {
        if (!reduced) {
          star.z -= star.speed * delta
          if (star.z <= 0.08) {
            star.x = (Math.random() - 0.5) * width * 1.8
            star.y = (Math.random() - 0.5) * height * 1.8
            star.z = 1
          }
        }
        const depth = 1 / Math.max(star.z, 0.08)
        const x = centerX + star.x * depth * 0.52
        const y = centerY + star.y * depth * 0.52
        if (x < -24 || x > width + 24 || y < -24 || y > height + 24) {
          if (!reduced) star.z = 1
          continue
        }
        const pulse = reduced ? 1 : 0.72 + Math.sin(timestamp * 0.0018 + star.twinkle) * 0.28
        const radius = star.size * pulse * Math.min(depth, 3.4)
        context.beginPath()
        context.arc(x, y, radius, 0, Math.PI * 2)
        context.fillStyle = `hsla(${star.hue}, 80%, 90%, ${star.alpha * pulse})`
        context.fill()
      }
      context.globalAlpha = 1
      if (!reduced) frame = requestAnimationFrame(draw)
    }
    const handlePointerMove = (event: PointerEvent) => {
      targetPointerX = event.clientX / Math.max(window.innerWidth, 1) - 0.5
      targetPointerY = event.clientY / Math.max(window.innerHeight, 1) - 0.5
    }
    reset()
    draw()
    window.addEventListener('resize', reset)
    window.addEventListener('pointermove', handlePointerMove)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', reset)
      window.removeEventListener('pointermove', handlePointerMove)
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

function LoginScreen({ onSubmit }: { onSubmit: () => Promise<void> }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true)
    try {
      const result = mode === 'register'
        ? await api.register(email, password, name)
        : await api.login(email, password)
      session.token = result.token
      await onSubmit()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ошибка входа') }
    finally { setBusy(false) }
  }
  return (
    <form className="glass auth-modal compact" onSubmit={submit}>
      {mode === 'login' ? <RandomGreetingTitle defaultTitle="И снова здравствуйте" /> : <h1>Регистрация</h1>}
      <div className="form-stack tight">
        {mode === 'register' && <Input theme="accent" icon={<Icon name="face" size={28} />} value={name} onChange={(event) => setName(event.target.value)} placeholder="Как тебя называть" autoComplete="name" autoFocus />}
        <Input theme="accent" icon={<Icon name="email" size={28} />} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" autoComplete="email" autoFocus={mode === 'login'} />
        <Input theme="accent" icon={<Icon name="encrypted" size={28} />} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Пароль — минимум 8 символов" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        <Button type="submit" disabled={busy || !email.trim() || password.length < 8 || (mode === 'register' && !name.trim())}>{busy ? 'Подожди…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}</Button>
      </div>
      <button className="auth-mode-switch" type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
        {mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
      </button>
      {error && <p className="form-hint">{error}</p>}
    </form>
  )
}

function JoinScreen({ onSubmit, initialLink = '' }: { onSubmit: (link: string, name: string, email: string, password: string, mode: 'login' | 'register') => Promise<void>; initialLink?: string }) {
  const [mode, setMode] = useState<'login' | 'register'>('register')
  const [link, setLink] = useState(initialLink)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const valid = link.trim() && email.trim() && password.length >= 8 && (mode === 'login' || name.trim())
  return (
    <form className="glass auth-modal join-modal" onSubmit={async (event) => { event.preventDefault(); if (valid) await onSubmit(link, name, email, password, mode) }}>
      <RandomGreetingTitle defaultTitle="Добро пожаловать" />
      <div className="form-stack">
        <div className="form-stack tight">
          <Input theme="accent" icon={<Icon name="link" size={28} />} value={link} onChange={(event) => setLink(event.target.value)} placeholder="Ссылка на поездку" />
          {mode === 'register' && <Input theme="accent" icon={<Icon name="face" size={28} />} value={name} onChange={(event) => setName(event.target.value)} placeholder="Как тебя называть" autoComplete="name" />}
          <Input theme="accent" icon={<Icon name="email" size={28} />} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" autoComplete="email" />
          <Input theme="accent" icon={<Icon name="encrypted" size={28} />} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Пароль — минимум 8 символов" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </div>
        <Button type="submit" disabled={!valid}>Я в деле</Button>
      </div>
      <button className="auth-mode-switch" type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'Создать новый аккаунт' : 'У меня уже есть аккаунт'}
      </button>
    </form>
  )
}

function ProfileScreen({ user, onBack, onSave, onAvatar, onLogout }: { user: CurrentUser; onBack: () => void; onSave: (value: { displayName: string; email: string; password?: string }) => Promise<void>; onAvatar: (file: File) => Promise<string>; onLogout: () => void }) {
  const [displayName, setDisplayName] = useState(user.displayName)
  const [email, setEmail] = useState(user.email)
  const [password, setPassword] = useState('')
  const access = useAccess()
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || `${import.meta.env.BASE_URL}assets/person-owner.png`)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const avatarPreviewRef = useRef<string | null>(null)
  useEffect(() => () => { if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current) }, [])
  const profileChanged = displayName.trim() !== user.displayName || email.trim().toLowerCase() !== user.email.toLowerCase() || Boolean(password)
  const changed = profileChanged || Boolean(avatarFile)
  const valid = displayName.trim() && /^\S+@\S+\.\S+$/.test(email.trim()) && (!password || password.length >= 8)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!changed || !valid) return
    setBusy(true)
    setMessage('')
    try {
      if (profileChanged) await onSave({ displayName: displayName.trim(), email: email.trim().toLowerCase(), ...(password ? { password } : {}) })
      if (avatarFile) {
        const savedUrl = await onAvatar(avatarFile)
        if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current)
        avatarPreviewRef.current = null
        setAvatarUrl(savedUrl)
        setAvatarFile(null)
      }
      setPassword('')
      setMessage('Изменения сохранены')
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Не удалось сохранить изменения')
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="screen auth-screen profile-screen">
      <GalaxyBackground />
      <IconButton className="back-button" size="l" icon={<Icon name="arrow-back" />} onClick={onBack} aria-label="Назад" title="Назад" />
      <form className="glass profile-card-screen" onSubmit={submit}>
        <button className="profile-avatar-button" type="button" disabled={!access.canEdit} onClick={() => avatarInputRef.current?.click()} aria-label="Загрузить новый аватар">
          <img className="profile-avatar" src={avatarUrl} alt="Аватар профиля" />
          <span className="profile-avatar-overlay"><Icon name="edit" size={32} /></span>
        </button>
        <input ref={avatarInputRef} className="hidden-file-input" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current); avatarPreviewRef.current = URL.createObjectURL(file); setAvatarUrl(avatarPreviewRef.current); setAvatarFile(file); setMessage(''); event.currentTarget.value = '' }} />
        <div className="profile-fields">
          <Input icon={<Icon name="face" />} aria-label="Имя" placeholder="Имя" value={displayName} onChange={(event) => { setDisplayName(event.target.value); setMessage('') }} autoComplete="name" />
          <Input icon={<Icon name="email" />} aria-label="Почта" placeholder="Почта" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setMessage('') }} autoComplete="email" />
          <Input icon={<Icon name="encrypted" />} aria-label="Новый пароль" type="password" value={password} onChange={(event) => { setPassword(event.target.value); setMessage('') }} placeholder="Новый пароль" autoComplete="new-password" />
        </div>
        <Button type="submit" disabled={busy || !changed || !valid || !access.canEdit}>{busy ? 'Сохраняем…' : 'Сохранить'}</Button>
        <button className="auth-mode-switch" type="button" onClick={onLogout}>Выйти из аккаунта</button>
        {message && <p className="form-hint">{message}</p>}
      </form>
    </main>
  )
}

function TripsScreen({ trips, canCreate, deleteTarget, onOpen, onCreate, onClose, onDelete, onCloseDelete, onConfirmDelete, onExport, onImport }: { trips: ApiTripSummary[]; canCreate: boolean; deleteTarget: ApiTripSummary | null; onOpen: (id: string) => void; onCreate: () => void; onClose: () => void; onDelete: (trip: ApiTripSummary) => void; onCloseDelete: () => void; onConfirmDelete: () => Promise<void>; onExport: (trip: ApiTripSummary) => Promise<void>; onImport: (file: File) => Promise<void> }) {
  const access = useAccess()
  const importRef = useRef<HTMLInputElement>(null)
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
      <section className="glass trips-card">
        {deleteTarget ? <DeleteTripDialog key={deleteTarget.id} trip={deleteTarget} onClose={onCloseDelete} onConfirm={onConfirmDelete} /> : <div className="trips-default-view setup-transition">
          <header className="trips-header"><h1>Мои поездки</h1></header>
          <div className="trips-content">
            <div className="trips-list">
              {trips.map((item) => <InfoRow key={item.id} image={item.background_removed ? undefined : item.background_document_id ? backgroundUrls[item.id] : defaultTripBackground} imageAlt={item.background_removed ? '' : `Фон поездки ${item.name}`} title={item.name} subtitle={<>{item.role === 'owner' ? 'Владелец' : 'Гость'} · {formatLongRange(item.start_date.slice(0, 10), item.end_date.slice(0, 10))}</>} onClick={() => onOpen(item.id)} actionTheme="secondary" actions={item.role === 'owner' && access.canEdit ? [{ icon: <Icon name="download" />, label: `Экспортировать поездку ${item.name}`, title: 'Экспортировать', onClick: () => void onExport(item) }, { icon: <Icon name="delete-forever" />, label: `Удалить поездку ${item.name}`, title: 'Удалить', className: 'trip-delete-trigger', onClick: () => onDelete(item) }] : []} />)}
            </div>
            {canCreate && access.canEdit && <>
              <AddRow icon={<Icon name="add-plus" />} onClick={onCreate} aria-label="Создать ещё одну поездку" />
              <button className="auth-mode-switch trips-import-link" type="button" onClick={() => importRef.current?.click()}>Импортировать поездку из файла</button>
              <input ref={importRef} className="hidden-file-input" type="file" accept=".travelspace,application/vnd.travel-space+json,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onImport(file); event.currentTarget.value = '' }} />
            </>}
          </div>
        </div>}
      </section>
    </main>
  )
}

function DeleteTripDialog({ trip, onClose, onConfirm }: { trip: ApiTripSummary; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <div className="destructive-dialog setup-transition">
        <IconButton className="destructive-dialog-close" icon={<Icon name="close" />} onClick={onClose} aria-label="Закрыть" />
        <TypographyGroup headingLevel="h2" title={`Удалить «${trip.name}»?`} text="Поездка, города, места и документы будут удалены без возможности восстановления. Введите название поездки вручную:" />
        <Input theme="accent" showLabel={false} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={trip.name} autoFocus />
        <div className="dialog-actions"><Button disabled={confirmation !== trip.name || busy} onClick={async () => { setBusy(true); try { await onConfirm() } finally { setBusy(false) } }}>{busy ? 'Удаляем…' : 'Удалить поездку'}</Button></div>
    </div>
  )
}

function InviteScreen({ trip, onBack, onCreate, onViewLink, onRemove }: { trip: Trip; onBack: () => void; onCreate: (hours: number) => Promise<{ url: string; expiresAt: string }>; onViewLink: () => Promise<string>; onRemove: (member: TripMember) => Promise<void> }) {
  const [invite, setInvite] = useState<{ url: string; expiresAt: string } | null>(null)
  const access = useAccess()
  const [viewLink, setViewLink] = useState('')
  const [busy, setBusy] = useState(false)
  // Список участников читается из кэша поездки, поэтому экран полезен и оффлайн.
  // Ссылки же создаются только на сервере — без сети их блок просто не нужен.
  const isOwner = trip.role === 'owner' && access.canEdit
  const members = [...(trip.members ?? [])].sort((left, right) => {
    if (left.role === right.role) return 0
    return left.role === 'owner' ? -1 : 1
  })
  useEffect(() => { if (isOwner) void onViewLink().then(setViewLink).catch(() => setViewLink('')) }, [isOwner, onViewLink])
  return <main className="screen trip-background setup-screen" style={tripBackgroundStyle(trip)}>
    <IconButton className="back-button" size="l" icon={<Icon name="arrow-back" />} onClick={onBack} aria-label="Назад" title="Назад" />
    <section className="glass setup-card invite-screen-card">
      <h1>Участники «{trip.name}»</h1>
      {members.length > 0
        ? <div className="member-list">{members.map((member) => <InfoRow key={member.id} image={member.avatarUrl || `${import.meta.env.BASE_URL}assets/${member.role === 'owner' ? 'person-owner.png' : 'person-member.png'}`} imageAlt={`Аватар ${member.displayName}`} imageShape="circle" title={member.displayName} subtitle={member.email} actionTheme="secondary" actions={!isOwner || member.role === 'owner' ? [] : [{ icon: <Icon name="delete-forever" />, label: `Удалить ${member.displayName} из поездки`, title: 'Удалить участника', onClick: () => { if (window.confirm(`Удалить ${member.displayName} из поездки?`)) void onRemove(member) } }]} />)}</div>
        : <p>Не удалось загрузить список участников.</p>}
      {isOwner && <>
        <TypographyGroup headingLevel="h2" variant="head-m-text" title="Ссылка-приглашение" text="Ссылка действует 24 часа. Новая ссылка сразу отключит предыдущую. Все вошедшие по ней станут гостями." />
        {invite && <div className="invite-result"><Input label="Активная ссылка" icon={<Icon name="link" />} readOnly value={invite.url} trailingIcon={<Icon name="content-copy" />} trailingIconLabel="Скопировать ссылку" onTrailingIconClick={() => void navigator.clipboard.writeText(invite.url)} /><small>Действует до {new Date(invite.expiresAt).toLocaleString('ru-RU')}</small></div>}
        <Button size="l" disabled={busy} onClick={async () => { setBusy(true); try { setInvite(await onCreate(24)) } finally { setBusy(false) } }}>{busy ? 'Создаём…' : invite ? 'Создать новую ссылку' : 'Создать ссылку'}</Button>
        <TypographyGroup headingLevel="h2" variant="head-m-text" title="Доступ на просмотр" text={'Постоянная ссылка без присоединения к поездке и\u00a0возможности редактирования'} />
        <div className="invite-result"><Input icon={<Icon name="link" />} readOnly value={viewLink} placeholder="Загружаем ссылку…" trailingIcon={viewLink ? <Icon name="content-copy" /> : undefined} trailingIconLabel="Скопировать ссылку на просмотр" onTrailingIconClick={viewLink ? () => void navigator.clipboard.writeText(viewLink) : undefined} /></div>
      </>}
    </section>
  </main>
}

const emptyTransport = (): TransportDetails => ({ name: '', departureDate: '', arrivalDate: '', departureTime: '', arrivalTime: '', departureTimeZone: '', arrivalTimeZone: '', departureStation: '', departureStationUrl: '', arrivalStation: '', arrivalStationUrl: '', notes: '', ticketOnSite: false, payerIds: [], totalAmountRubles: 0 })

function MoneyInput({ value, onChange, ariaLabel }: { value: number; onChange: (value: number) => void; ariaLabel: string }) {
  const [focused, setFocused] = useState(false)
  const displayValue = value > 0 ? (focused ? String(value) : `${value.toLocaleString('ru-RU')} ₽`) : ''
  return <Input showLabel={false} controlClassName="transport-payment-amount" aria-label={ariaLabel} icon={<Icon name="money-bag" />} type="text" inputMode="numeric" placeholder="Общая сумма, ₽" value={displayValue} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onChange={(event) => onChange(Math.max(0, Number.parseInt(event.target.value.replace(/\D/g, ''), 10) || 0))} />
}
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
const emptyCity = (): City => ({ id: uid(), name: '', googleMapsUrl: '', arrival: '', departure: '', arrivalPeriod: 'morning', departurePeriod: 'evening', hotelNotNeeded: false, hotel: '', hotelUrl: '', hotelCheckInTime: '', hotelCheckOutTime: '', hotelNotes: '', hotelPayerIds: [], hotelTotalAmountRubles: 0, trainIn: '', trainOut: '', transportIn: emptyTransport(), transportOut: emptyTransport(), ticketAssigneeIds: [], hotelAssigneeIds: [], planAssigneeIds: [], places: {}, tasks: [], files: [] })

function AssigneeSelect({ members, value, icon, disabled, emptyLabel = 'Не назначен', onChange }: { members: TripMember[]; value: string[]; icon: IconName; disabled?: boolean; emptyLabel?: string; onChange: (value: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  const selectedNames = members.filter((member) => value.includes(member.id)).map((member) => member.displayName)
  return <div className={`member-multi-select${open ? ' open' : ''}`} ref={containerRef}>
    <button className="form-control member-multi-select-trigger" type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <span className="form-control-icon"><Icon name={icon} /></span>
      <span>{selectedNames.length ? selectedNames.join(', ') : emptyLabel}</span>
    </button>
    {open && <div className="member-multi-select-menu" role="listbox" aria-multiselectable="true">
      {members.map((member) => {
        const selected = value.includes(member.id)
        return <button key={member.id} type="button" role="option" aria-selected={selected} onClick={() => onChange(selected ? value.filter((id) => id !== member.id) : [...value, member.id])}>
          <span className={`document-check${selected ? ' checked' : ''}`} aria-hidden="true" />
          <span>{member.displayName}</span>
        </button>
      })}
    </div>}
  </div>
}

function CityEditor({ trip, initial, onSave, onClose }: { trip: Trip; initial?: City; onSave: (city: City) => void; onClose: () => void }) {
  const [city, setCity] = useState<City>(() => initial ? { ...initial, arrivalPeriod: initial.arrivalPeriod ?? 'morning', departurePeriod: initial.departurePeriod ?? 'evening' } : emptyCity())
  const imageFileRef = useRef<HTMLInputElement>(null)
  const imagePreviewUrlRef = useRef<string | null>(null)
  const sameDayPeriodsValid = city.arrival !== city.departure || periodOrder[city.departurePeriod ?? 'evening'] >= periodOrder[city.arrivalPeriod ?? 'morning']
  const valid = city.name.trim() && city.arrival && city.departure && city.departure >= city.arrival && sameDayPeriodsValid
  const tripDates = dateRange(trip.startDate, trip.endDate)
  const departureDates = tripDates.filter((date) => !city.arrival || date >= city.arrival)
  const hasImage = Boolean(city.imageFile || city.image || city.imageUrl)
  const members = trip.members ?? []
  const canAssign = trip.role === 'owner' || !trip.id
  const routeCities = city.arrival ? sortCitiesByDate([...trip.cities.filter((item) => item.id !== city.id), city]) : [...trip.cities.filter((item) => item.id !== city.id), city]
  const cityIndex = routeCities.findIndex((item) => item.id === city.id)
  const previousCity = cityIndex > 0 ? routeCities[cityIndex - 1] : undefined
  const cityLabel = city.name.trim() || 'Новый город'
  const ticketRouteLabel = previousCity ? `${previousCity.name} – ${cityLabel}` : 'Приезд'
  return (
    <form className="setup-editor-content setup-transition" onSubmit={(event) => { event.preventDefault(); if (valid) onSave(city) }}>
      <section className="glass setup-card">
      <div className="city-editor-view">
      <div className="modal-title">
        <div>{!initial && <span className="eyebrow">Новая локация</span>}<h2>{initial ? city.name : 'Добавить город'}</h2></div>
        <IconButton type="button" icon={<Icon name="close" />} onClick={onClose} aria-label="Закрыть" />
      </div>
      <InfoRow className="city-image-row" image={hasImage ? city.imageUrl || cityPlaceholder : undefined} imageAlt="Фото города" title={hasImage ? 'Фото города' : 'Прикрепить фото города'} subtitle={hasImage ? city.imageFile?.name || city.image?.name || 'Фото города' : 'Лучше в вертикальном формате'} actionTheme="secondary" actions={hasImage ? [{ icon: <Icon name="edit" />, label: 'Выбрать новое фото города', onClick: () => imageFileRef.current?.click() }, { icon: <Icon name="delete-forever" />, label: 'Удалить фото города', onClick: () => setCity((current) => ({ ...current, imageDeleteId: current.image?.id, image: undefined, imageFile: undefined, imageUrl: undefined })) }] : [{ icon: <Icon name="add-plus" />, label: 'Прикрепить фото города', onClick: () => imageFileRef.current?.click() }]} />
      <input ref={imageFileRef} className="hidden-file-input" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (imagePreviewUrlRef.current) URL.revokeObjectURL(imagePreviewUrlRef.current); imagePreviewUrlRef.current = URL.createObjectURL(file); setCity((current) => ({ ...current, imageFile: file, imageUrl: imagePreviewUrlRef.current ?? undefined })); event.currentTarget.value = '' }} />
      <div className="field-grid">
        <label className="field span-2"><span>Город</span><Input value={city.name} onChange={(e) => setCity({ ...city, name: e.target.value })} placeholder="Например, Осака" autoFocus /></label>
        <label className="field span-2"><span>Ссылка на город в Google Maps</span><Input icon={<Icon name="link" />} type="url" value={city.googleMapsUrl} onChange={(e) => setCity({ ...city, googleMapsUrl: e.target.value })} placeholder="Ссылка Google Maps" /></label>
        <label className="field"><span>Прибытие</span><div className="date-time-fields"><Select content="date" icon={<Icon name="calendar-month" />} value={city.arrival} onChange={(e) => { const value = e.target.value; setCity((current) => ({ ...current, arrival: value, departure: current.departure < value ? '' : current.departure })) }}><option value="">Выберите дату</option>{tripDates.map((date) => <option key={date} value={date}>{formatDate(date)} · {ruWeekdays[parseDate(date).getDay()]}</option>)}</Select><Select content="list" icon={<Icon name="time" />} aria-label="Время прибытия" value={city.arrivalPeriod ?? 'morning'} onChange={(e) => setCity((current) => ({ ...current, arrivalPeriod: e.target.value as DayPeriod }))}><option value="morning">Утро</option><option value="day">День</option><option value="evening">Вечер</option></Select></div></label>
        <label className="field"><span>Отъезд</span><div className="date-time-fields"><Select content="date" icon={<Icon name="calendar-month" />} value={city.departure} disabled={!city.arrival} onChange={(e) => setCity((current) => ({ ...current, departure: e.target.value }))}><option value="">Выберите дату</option>{departureDates.map((date) => <option key={date} value={date}>{formatDate(date)} · {ruWeekdays[parseDate(date).getDay()]}</option>)}</Select><Select content="list" icon={<Icon name="time" />} aria-label="Время отъезда" value={city.departurePeriod ?? 'evening'} onChange={(e) => setCity((current) => ({ ...current, departurePeriod: e.target.value as DayPeriod }))}><option value="morning">Утро</option><option value="day">День</option><option value="evening">Вечер</option></Select></div></label>
        <div className="field span-2"><span>Кто покупает билет ({ticketRouteLabel})</span><AssigneeSelect members={members} value={city.ticketAssigneeIds} icon="ticket" disabled={!canAssign} onChange={(ticketAssigneeIds) => setCity((current) => ({ ...current, ticketAssigneeIds }))} /></div>
        <div className="field span-2"><span>Кто бронит отель ({cityLabel})</span><AssigneeSelect members={members} value={city.hotelAssigneeIds} icon="hotel" disabled={!canAssign || city.hotelNotNeeded} onChange={(hotelAssigneeIds) => setCity((current) => ({ ...current, hotelAssigneeIds }))} /></div>
        <label className="city-hotel-toggle city-hotel-toggle-after-assignee span-2"><input type="checkbox" checked={city.hotelNotNeeded} onChange={(event) => setCity((current) => ({ ...current, hotelNotNeeded: event.target.checked, hotelAssigneeIds: event.target.checked ? [] : current.hotelAssigneeIds }))} /><span className={`document-check${city.hotelNotNeeded ? ' checked' : ''}`} aria-hidden="true" /><SecondaryText>Отель не нужен</SecondaryText></label>
        <div className="field span-2"><span>Кто составляет план города ({cityLabel})</span><AssigneeSelect members={members} value={city.planAssigneeIds} icon="barefoot" disabled={!canAssign} onChange={(planAssigneeIds) => setCity((current) => ({ ...current, planAssigneeIds }))} /></div>
      </div>
      </div>
      </section>
      <Button type="submit" disabled={!valid}>Сохранить город</Button>
    </form>
  )
}

function AllCitiesEditor({ trip, onSave, onClose }: { trip: Trip; onSave: (cities: City[]) => void; onClose: () => void }) {
  const [cities, setCities] = useState(() => trip.cities.map((city) => ({ ...city })))
  const tripDates = dateRange(trip.startDate, trip.endDate)
  const members = trip.members ?? []
  const canAssign = trip.role === 'owner'
  const updateCity = (id: string, patch: Partial<City>) => setCities((current) => current.map((city) => city.id === id ? { ...city, ...patch } : city))
  const valid = cities.every((city) => {
    const arrivalPeriod = city.arrivalPeriod ?? 'morning'
    const departurePeriod = city.departurePeriod ?? 'evening'
    return city.name.trim() && city.arrival && city.departure && city.departure >= city.arrival && (city.arrival !== city.departure || periodOrder[departurePeriod] >= periodOrder[arrivalPeriod])
  })

  return (
    <form className="setup-editor-content setup-transition" onSubmit={(event) => { event.preventDefault(); if (valid) onSave(cities) }}>
      <section className="glass setup-card editing-all">
      <div className="all-cities-editor">
      <IconButton type="button" className="bulk-edit-button" icon={<Icon name="close" />} onClick={onClose} aria-label="Закрыть редактирование" />
      <div className="all-cities-scroll">
        <h2>Все города</h2>
        <div className="all-cities-list">
          {cities.map((city, cityIndex) => {
            const departureDates = tripDates.filter((date) => !city.arrival || date >= city.arrival)
            const cityLabel = city.name.trim() || 'Новый город'
            const previousCity = cities[cityIndex - 1]
            const ticketRouteLabel = previousCity ? `${previousCity.name} – ${cityLabel}` : 'Приезд'
            return (
              <section className="all-city-fields" key={city.id}>
                <label className="field city-name-field"><span>Город</span><Input value={city.name} onChange={(event) => updateCity(city.id, { name: event.target.value })} /></label>
                <label className="field span-2"><span>Ссылка на город в Google Maps</span><Input icon={<Icon name="link" />} type="url" value={city.googleMapsUrl} onChange={(event) => updateCity(city.id, { googleMapsUrl: event.target.value })} placeholder="Ссылка Google Maps" /></label>
                <label className="field"><span>Прибытие</span><div className="date-time-fields"><Select content="date" icon={<Icon name="calendar-month" />} value={city.arrival} onChange={(event) => { const arrival = event.target.value; updateCity(city.id, { arrival, departure: city.departure < arrival ? '' : city.departure }) }}><option value="">Выберите дату</option>{tripDates.map((date) => <option key={date} value={date}>{formatDate(date)} · {ruWeekdays[parseDate(date).getDay()]}</option>)}</Select><Select content="list" icon={<Icon name="time" />} aria-label={`Время прибытия в ${city.name}`} value={city.arrivalPeriod ?? 'morning'} onChange={(event) => updateCity(city.id, { arrivalPeriod: event.target.value as DayPeriod })}><option value="morning">Утро</option><option value="day">День</option><option value="evening">Вечер</option></Select></div></label>
                <label className="field"><span>Отъезд</span><div className="date-time-fields"><Select content="date" icon={<Icon name="calendar-month" />} value={city.departure} disabled={!city.arrival} onChange={(event) => updateCity(city.id, { departure: event.target.value })}><option value="">Выберите дату</option>{departureDates.map((date) => <option key={date} value={date}>{formatDate(date)} · {ruWeekdays[parseDate(date).getDay()]}</option>)}</Select><Select content="list" icon={<Icon name="time" />} aria-label={`Время отъезда из ${city.name}`} value={city.departurePeriod ?? 'evening'} onChange={(event) => updateCity(city.id, { departurePeriod: event.target.value as DayPeriod })}><option value="morning">Утро</option><option value="day">День</option><option value="evening">Вечер</option></Select></div></label>
                <div className="field span-2"><span>Кто покупает билет ({ticketRouteLabel})</span><AssigneeSelect members={members} value={city.ticketAssigneeIds} icon="ticket" disabled={!canAssign} onChange={(ticketAssigneeIds) => updateCity(city.id, { ticketAssigneeIds })} /></div>
                <div className="field span-2"><span>Кто бронит отель ({cityLabel})</span><AssigneeSelect members={members} value={city.hotelAssigneeIds} icon="hotel" disabled={!canAssign || city.hotelNotNeeded} onChange={(hotelAssigneeIds) => updateCity(city.id, { hotelAssigneeIds })} /></div>
                <label className="city-hotel-toggle city-hotel-toggle-after-assignee all-city-hotel-toggle"><input type="checkbox" checked={city.hotelNotNeeded} onChange={(event) => updateCity(city.id, { hotelNotNeeded: event.target.checked, ...(event.target.checked ? { hotelAssigneeIds: [] } : {}) })} /><span className={`document-check${city.hotelNotNeeded ? ' checked' : ''}`} aria-hidden="true" /><SecondaryText>Отель не нужен</SecondaryText></label>
                <div className="field span-2"><span>Кто составляет план города ({cityLabel})</span><AssigneeSelect members={members} value={city.planAssigneeIds} icon="barefoot" disabled={!canAssign} onChange={(planAssigneeIds) => updateCity(city.id, { planAssigneeIds })} /></div>
              </section>
            )
          })}
        </div>
      </div>
      </div>
      </section>
      <Button type="submit" disabled={!valid}>Сохранить поездку</Button>
    </form>
  )
}

function SetupScreen({ initial, user, onCreate, onExit }: { initial: Trip | null; user: CurrentUser | null; onCreate: (trip: Trip) => void; onExit: () => void }) {
  const [trip, setTrip] = useState<Trip>(initial ?? { name: '', startDate: '', endDate: '', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', cities: [], dayDescriptions: {}, members: user ? [{ id: user.id, email: user.email, displayName: user.displayName, role: 'owner', hasAvatar: user.hasAvatar, avatarUrl: user.avatarUrl }] : [] })
  const [editing, setEditing] = useState<City | null | undefined>(undefined)
  const [editingAll, setEditingAll] = useState(false)
  const startDateRef = useRef<HTMLInputElement>(null)
  const endDateRef = useRef<HTMLInputElement>(null)
  const access = useAccess()
  const backgroundFileRef = useRef<HTMLInputElement>(null)
  const datesValid = trip.startDate && trip.endDate && trip.endDate >= trip.startDate
  const tripDays = datesValid ? daysBetween(trip.startDate, trip.endDate) : 0
  const hasBackground = !trip.backgroundRemoved && Boolean(trip.backgroundFile || trip.background || trip.backgroundUrl)
  const openDatePicker = (ref: React.RefObject<HTMLInputElement | null>) => {
    const input = ref.current
    if (!input) return
    input.focus()
    try { input.showPicker() } catch { input.click() }
  }
  const upsertCity = (city: City) => {
    const exists = trip.cities.some((item) => item.id === city.id)
    const cities = exists ? trip.cities.map((item) => item.id === city.id ? city : item) : [...trip.cities, city]
    setTrip({ ...trip, cities: sortCitiesByDate(cities) })
    setEditing(undefined)
  }
  return (
    <main className="screen trip-background setup-screen" style={tripBackgroundStyle(trip)}>
      <IconButton className="back-button" size="l" icon={<Icon name="arrow-back" />} onClick={onExit} aria-label="Назад" />
      {editingAll ? (
          <AllCitiesEditor trip={trip} onClose={() => setEditingAll(false)} onSave={(cities) => { setTrip((current) => ({ ...current, cities: sortCitiesByDate(cities) })); setEditingAll(false) }} />
        ) : editing !== undefined ? (
          <CityEditor trip={trip} initial={editing ?? undefined} onSave={upsertCity} onClose={() => setEditing(undefined)} />
        ) : (
          <div className="setup-editor-content">
          <section className="glass setup-card">
          <div className="setup-content setup-transition">
            <div className="trip-fields">
              <input className="title-input" value={trip.name} onChange={(e) => setTrip((current) => ({ ...current, name: e.target.value }))} placeholder="Название поездки" />
              <div className="date-summary">
                <button type="button" onClick={() => openDatePicker(startDateRef)}>{trip.startDate ? formatDate(trip.startDate) : 'Дата начала'}</button>
                <span>–</span>
                <button type="button" onClick={() => openDatePicker(endDateRef)}>{trip.endDate ? formatDate(trip.endDate) : 'Дата окончания'}</button>
                {datesValid && <span>· {formatDays(tripDays)}</span>}
                <label className="trip-time-zone-picker"><span>·</span><span className="trip-time-zone-value">{formatTimeZoneOffset(trip.timeZone, trip.startDate)}</span><select aria-label="Основной часовой пояс поездки" value={trip.timeZone} onChange={(event) => setTrip((current) => ({ ...current, timeZone: event.target.value }))}>{timeZones.map((zone) => <option key={zone} value={zone}>{formatTimeZoneOption(zone, trip.startDate)}</option>)}</select></label>
                <input ref={startDateRef} className="native-date-input" aria-label="Дата начала поездки" type="date" value={trip.startDate} onInput={(e) => { const value = e.currentTarget.value; setTrip((current) => ({ ...current, startDate: value, endDate: current.endDate < value ? '' : current.endDate, cities: [] })) }} />
                <input ref={endDateRef} className="native-date-input" aria-label="Дата окончания поездки" type="date" min={trip.startDate} value={trip.endDate} onInput={(e) => { const value = e.currentTarget.value; setTrip((current) => ({ ...current, endDate: value, cities: [] })) }} />
              </div>
            </div>
            <InfoRow className="trip-background-row" image={hasBackground ? trip.backgroundUrl || defaultTripBackground : undefined} imageAlt="Фоновое фото поездки" title={hasBackground ? 'Фоновое фото' : 'Прикрепить фоновое фото'} subtitle={hasBackground ? trip.backgroundFile?.name || trip.background?.name || 'autumn-garden.jpg' : 'Лучше в горизонтальном формате'} actionTheme="secondary" actions={hasBackground ? [{ icon: <Icon name="edit" />, label: 'Выбрать новое фоновое фото', onClick: () => backgroundFileRef.current?.click() }, { icon: <Icon name="delete-forever" />, label: 'Удалить фоновое фото', onClick: () => setTrip((current) => ({ ...current, backgroundRemoved: true, backgroundDeleteId: current.background?.id, background: undefined, backgroundFile: undefined, backgroundUrl: undefined })) }] : [{ icon: <Icon name="add-plus" />, label: 'Прикрепить фоновое фото', onClick: () => backgroundFileRef.current?.click() }]} />
            <input ref={backgroundFileRef} className="hidden-file-input" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; setTrip((current) => ({ ...current, backgroundFile: file, backgroundUrl: URL.createObjectURL(file), backgroundRemoved: false })); event.currentTarget.value = '' }} />
            <div className="city-editor-group">
              {trip.cities.length > 0 && <div className="city-list setup-list">{trip.cities.map((city) => <InfoRow key={city.id} image={city.imageUrl || cityPlaceholder} imageAlt="Изображение города" imageFallback={cityPlaceholder} title={city.name} subtitle={`${formatShortRange(city.arrival, city.departure)} · ${formatDays(cityDays(city))}${city.hotelNotNeeded ? ' · Отель не нужен' : ''}`} onClick={() => setEditing(city)} actionTheme="secondary" actions={[{ icon: <Icon name="delete-forever" />, label: `Удалить город ${city.name}`, onClick: () => { if (!window.confirm(`Удалить город «${city.name}» из маршрута?`)) return; setTrip((current) => ({ ...current, cities: current.cities.filter((item) => item.id !== city.id) })) } }]} />)}</div>}
              <AddRow icon={<Icon name="add-plus" />} disabled={!datesValid} onClick={() => setEditing(null)} aria-label="Добавить город" />
              {trip.cities.length > 0 && <button className="route-overview-link" type="button" onClick={() => setEditingAll(true)}><SecondaryText interactive>Посмотреть весь маршрут</SecondaryText></button>}
            </div>
          </div>
          </section>
          {trip.cities.length > 0 && <Button disabled={!trip.name.trim() || !access.canEdit} onClick={() => onCreate(trip)}>Сохранить поездку</Button>}
          </div>
        )}
    </main>
  )
}

function DocumentStatus({ checked, children, onClick }: { checked: boolean; children: React.ReactNode; onClick?: () => void }) {
  return <button type="button" className="document-row" onClick={onClick}><IconText checked={checked}>{children}</IconText></button>
}

const isTransportComplete = (details: TransportDetails | undefined, ticketName: string) => Boolean(
  details
  && (ticketName.trim() || (details.type !== 'plane' && details.ticketOnSite))
  && details.departureDate.trim()
  && details.arrivalDate.trim()
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
        <div className="city-list">{trip.cities.map((city, index) => {
          const previousCity = trip.cities[index - 1]
          const ticketComplete = previousCity
            ? isTransportComplete(previousCity.transportOut, previousCity.trainOut) || isTransportComplete(city.transportIn, city.trainIn)
            : isTransportComplete(city.transportIn, city.trainIn)
          const hotelComplete = isHotelComplete(city)
          return (
            <div className="sidebar-city-entry" key={city.id}>
              <CityRow city={city.name} dates={formatShortRange(city.arrival, city.departure)} duration={formatDays(cityDays(city))} image={city.imageUrl || cityPlaceholder} imageAlt="Изображение города" imageFallback={cityPlaceholder} selected={city.id === selectedCityId} aria-current={city.id === selectedCityId ? 'true' : undefined} disabled={!access.canBrowse} onClick={access.canBrowse ? () => onCity(city) : undefined} />
              {access.canBrowse && <div className="sidebar-city-actions">
                {!city.hotelNotNeeded && <span className="sidebar-city-action"><IconButton size="m" theme="secondary" icon={<Icon name="hotel" />} aria-label={`Отель в ${city.name}`} title={`Отель в ${city.name}`} onClick={() => onHotel(city)} />{hotelComplete && <span className="city-action-complete" aria-hidden="true"><Icon name="check-small" size={16} /></span>}</span>}
                <span className="sidebar-city-action"><IconButton size="m" theme="secondary" icon={<Icon name="ticket" />} aria-label={`Билет в ${city.name}`} title={`Билет в ${city.name}`} onClick={() => previousCity ? onTransport(previousCity, 'out') : onTransport(city, 'in')} />{ticketComplete && <span className="city-action-complete" aria-hidden="true"><Icon name="check-small" size={16} /></span>}</span>
              </div>}
            </div>
          )
        })}</div>
        {access.canManageTrip && <div className="trip-summary-actions">
          <Button size="m" onClick={onEdit}>Редактировать</Button>
          <Button size="m" theme="secondary" onClick={onInvite}>Пригласить</Button>
        </div>}
      </section>
      {access.canBrowse && <section className="glass sidebar-card links-card">
        <TypographyGroup className="readiness-heading" title="Готовность к поездке" text={`${countdownText} · Готовность ${readinessPercent}%`} />
        {hotelCities.length > 0 && <><h3>Жильё</h3><ItemList>{hotelCities.map((city) => <DocumentStatus key={city.id} checked={isHotelComplete(city)} onClick={() => onHotel(city)}>{withAssignees(city.name, city.hotelAssigneeIds, members)}</DocumentStatus>)}</ItemList></>}
        <h3 className={hotelCities.length > 0 ? 'readiness-transport-heading' : undefined}>Транспорт</h3>
        <ItemList>
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
        <InfoRow className="profile-info-row" image={user.avatarUrl || `${import.meta.env.BASE_URL}assets/person-owner.png`} imageAlt="Аватар профиля" imageShape="circle" title={user.displayName} subtitle={user.email} onClick={onProfile} />
        {(showTrips || isAdmin) && <div className="profile-card-actions">
          {showTrips && <Button size="m" onClick={onTrips}>Мои поездки</Button>}
          {isAdmin && <Button size="m" theme="secondary" onClick={() => window.location.assign(`${import.meta.env.BASE_URL}components`)}>Компоненты</Button>}
        </div>}
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
    return <InfoRow key={expense.id} className="expense-row" title={expense.transportType ? <TransportLabel label={expense.title} type={expense.transportType} /> : expense.title} subtitle={paymentText} trailing={formatRubles(expense.totalAmountRubles)} />
  }
  return (
    <main className="transport-editor-screen trip-background setup-transition" style={tripBackgroundStyle(trip)}>
      <IconButton type="button" className="back-button" size="l" icon={<Icon name="arrow-back" />} onClick={onBack} aria-label="Назад" title="Назад" />
      <div className="transport-editor-content expenses-screen-content">
        <section className="glass transport-editor-card expenses-card">
          <TypographyGroup title="Траты" text={`Всего ${formatRubles(allExpenses.reduce((sum, expense) => sum + expense.totalAmountRubles, 0))}`} />
          {allExpenses.length === 0 && <p className="expenses-empty">Трат пока нет</p>}
          {expenses.hotels.length > 0 && <section className="expenses-group"><TypographyGroup variant="head-m-text" headingLevel="h2" title="Жильё" text={`Всего ${formatRubles(categoryTotal(expenses.hotels))}`} /><div className="expenses-list">{expenses.hotels.map(expenseRow)}</div></section>}
          {expenses.transport.length > 0 && <section className="expenses-group"><TypographyGroup variant="head-m-text" headingLevel="h2" title="Транспорт" text={`Всего ${formatRubles(categoryTotal(expenses.transport))}`} /><div className="expenses-list">{expenses.transport.map(expenseRow)}</div></section>}
          {memberExpenses.length > 0 && <section className="expenses-group"><TypographyGroup variant="head-m-text" headingLevel="h2" title="Итого по людям" /><div className="expenses-list">{memberExpenses.map(({ member, records, totalAmountRubles }) => <InfoRow key={member.id} className="expense-row" image={member.avatarUrl || `${import.meta.env.BASE_URL}assets/${member.role === 'owner' ? 'person-owner.png' : 'person-member.png'}`} imageAlt={`Аватар ${member.displayName}`} imageShape="circle" title={member.displayName} subtitle={formatExpenseRecords(records)} trailing={formatRubles(totalAmountRubles)} />)}</div></section>}
        </section>
      </div>
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
  type DayEvent = { key: string; title: string; subtitle?: string; icon?: IconName; city: City; panel?: 'hotel' | 'in' | 'out'; interactive?: boolean; kind: 'hotel-out' | 'transfer' | 'hotel-in' | 'city'; departureName?: string; departureUrl?: string; arrivalName?: string; arrivalUrl?: string }
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
    events.push({ key: `${departureCity.id}:${arrivalCity.id}:transfer`, title: `${departureCity.name} – ${arrivalCity.name}`, subtitle: withTicketOnSiteSummary(travelTimes, durationLabel, ticketOnSite), icon: transportEventIcon(outgoing.type || incoming.type), city: hasOutgoingDetails ? departureCity : arrivalCity, panel: hasOutgoingDetails ? 'out' : 'in', interactive: hasOutgoingDetails || hasIncomingDetails, kind: 'transfer', departureName: departurePlace, departureUrl: outgoing.departureStationUrl || incoming.departureStationUrl, arrivalName: arrivalPlace, arrivalUrl: outgoing.arrivalStationUrl || incoming.arrivalStationUrl })
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
      result.push({ key: `${city.id}:arrival`, title: routeTitle, subtitle: withTicketOnSiteSummary(travelTimes, durationLabel, ticketOnSite), icon: transportEventIcon(city.transportIn.type || previousTransport?.type), city: hasIncomingDetails || !previousCity ? city : previousCity, panel: hasIncomingDetails || !previousCity ? 'in' : 'out', interactive: hasIncomingDetails || Boolean(previousTransport && (previousCity?.trainOut || previousTransport.type || previousTransport.departureTime.trim() || previousTransport.arrivalTime.trim() || previousTransport.departureStation.trim() || previousTransport.arrivalStation.trim())), kind: 'transfer', departureName: departurePlace, departureUrl: city.transportIn.departureStationUrl || previousTransport?.departureStationUrl, arrivalName: arrivalPlace, arrivalUrl: city.transportIn.arrivalStationUrl || previousTransport?.arrivalStationUrl })
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
      result.push({ key: `${city.id}:departure`, title: routeTitle, subtitle: withTicketOnSiteSummary(travelTimes, durationLabel, city.transportOut.ticketOnSite), icon: transportEventIcon(city.transportOut.type), city, panel: 'out', interactive: Boolean(city.trainOut || city.transportOut.type || city.transportOut.departureTime.trim() || city.transportOut.arrivalTime.trim() || city.transportOut.departureStation.trim() || city.transportOut.arrivalStation.trim()), kind: 'transfer', departureName: departurePlace, departureUrl: city.transportOut.departureStationUrl, arrivalName: arrivalPlace, arrivalUrl: city.transportOut.arrivalStationUrl })
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
      pushLocation(`${event.key}:hotel`, event.city.hotel || 'Отель', event.city.hotelUrl, 'hotel', event.city, 'hotel', Boolean(event.interactive))
      timeline.push({ type: 'event', key: event.key, event })
      pushArrow(`${event.key}:arrow`)
      return
    }
    if (event.kind === 'transfer') {
      pushLocation(`${event.key}:departure`, event.departureName, event.departureUrl, 'transport', event.city, event.panel, Boolean(event.interactive && event.departureUrl?.trim()))
      timeline.push({ type: 'event', key: event.key, event })
      pushLocation(`${event.key}:arrival`, event.arrivalName, event.arrivalUrl, 'transport', event.city, event.panel, Boolean(event.interactive && event.arrivalUrl?.trim()))
      pushArrow(`${event.key}:arrow`)
      return
    }
    if (event.kind === 'city') {
      const cityPlaces = ordinaryPlaces.filter((place) => place.city.id === event.city.id)
      if (cityPlaces.length > 0) {
        cityPlaces.forEach((place) => timeline.push({ type: 'location', key: `${event.key}:${place.id}`, name: place.name, url: place.url, icon: place.icon, city: place.city, placeId: place.id, interactive: true }))
      } else {
        timeline.push({ type: 'event', key: event.key, event })
      }
      pushArrow(`${event.key}:arrow`)
      return
    }
    pushLocation(`${event.key}:hotel`, event.city.hotel || 'Отель', event.city.hotelUrl, 'hotel', event.city, 'hotel', Boolean(event.interactive))
    timeline.push({ type: 'event', key: event.key, event })
  })
  while (timeline.at(-1)?.type === 'arrow') timeline.pop()
  return (
    <article className={`glass day-card${hidden ? ' past' : ''}`}>
      <div className="day-content">
        <div className="day-date-column"><h2>{day.getDate()} {ruMonths[day.getMonth()].slice(0, 3)}</h2><p>{ruWeekdays[day.getDay()]}</p></div>
        <div className="day-panels">
          <label className={`day-column day-description${access.canEdit ? '' : ' read-only'}`}>
            <span>Заметки</span>
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
                    const content = event.icon ? <IconText icon={<Icon name={event.icon} />}>{eventText}</IconText> : <span>{eventText}</span>
                    return <li key={item.key}>{!access.canBrowse || event.interactive === false ? <span className="day-event-line read-only">{content}</span> : <button type="button" className="day-event-line" onClick={() => event.panel ? onEvent(event.city, event.panel) : onCity(event.city)}>{content}</button>}</li>
                  }
                  const label = !item.interactive
                    ? <span>{item.name}</span>
                    : !access.canBrowse
                      ? (item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.name}</a> : <span>{item.name}</span>)
                      : <button type="button" onClick={() => item.panel ? onEvent(item.city, item.panel) : item.placeId ? onPlace(item.city, item.placeId) : onCity(item.city)}>{item.name}</button>
                  return <li key={item.key} className="day-location-line"><IconText icon={<img className="ui-icon" src={placeIconUrl(item.icon)} width={24} height={24} alt="" />}>{label}</IconText></li>
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
const transportNamePlaceholders: Record<TransportType, string> = { train: 'Название поезда', plane: 'Название или номер рейса', bus: 'Название автобуса или номер рейса', ship: 'Название корабля' }
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

function TransportDialog({ title, departureLabel, arrivalLabel, value, defaultTimeZone, members, ticketName, tickets, readOnly = false, onSave, onTicket, onOpenTicket, onDownloadTicket, onDeleteTicket, onClose }: { title: string; departureLabel: string; arrivalLabel: string; value: TransportDetails; defaultTimeZone: string; members: TripMember[]; ticketName: string; tickets: TravelFile[]; readOnly?: boolean; onSave: (value: TransportDetails) => void; onTicket: () => void; onOpenTicket: (ticket: TravelFile) => void; onDownloadTicket: (ticket: TravelFile) => void; onDeleteTicket: (ticket: TravelFile) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<TransportDetails>(() => {
    const ticketOnSite = value.type === 'plane' ? false : value.ticketOnSite
    return { ...value, ticketOnSite, ...(ticketOnSite ? { departureTime: '', arrivalTime: '', departureTimeZone: '', arrivalTimeZone: '', payerIds: [], totalAmountRubles: 0 } : {}) }
  })
  const departureDateRef = useRef<HTMLInputElement>(null)
  const arrivalDateRef = useRef<HTMLInputElement>(null)
  const visibleTickets = tickets.slice(0, 1)
  const legacyTicketName = visibleTickets.length === 0 ? ticketName : ''
  const ticketCount = visibleTickets.length + Number(Boolean(legacyTicketName))
  const departureTimeZone = draft.departureTimeZone || defaultTimeZone
  const arrivalTimeZone = draft.arrivalTimeZone || defaultTimeZone
  const durationLabel = formatTravelDuration(draft.departureTime, draft.arrivalTime, draft.departureDate, draft.arrivalDate, departureTimeZone, arrivalTimeZone)
  const journeyText = draft.ticketOnSite ? TICKET_ON_SITE_PAGE_TEXT : durationLabel ?? 'Тут появится время в пути'
  const journeySummary = draft.type ? `${transportEmoji[draft.type]} ${journeyText}` : journeyText
  return (
    <form className="transport-editor-screen trip-background setup-transition" aria-label={title} onSubmit={(event) => { event.preventDefault(); onSave(draft.ticketOnSite ? { ...draft, departureTime: '', arrivalTime: '', departureTimeZone: '', arrivalTimeZone: '', payerIds: [], totalAmountRubles: 0 } : draft) }}>
      <IconButton type="button" className="back-button" size="l" icon={<Icon name="arrow-back" />} onClick={onClose} aria-label="Назад" />
      <div className="transport-editor-content">
        <section className="glass editor transport-dialog transport-editor-card">
        <div className="transport-dialog-stack">
          <div className="transport-ticket-setup">
            <fieldset className="dialog-fields transport-mode-fields" disabled={readOnly}>
              <h3 className="transport-section-title">Как поедем</h3>
              <div className="transport-mode-stack">
                <Select content="list" icon={<Icon name={draft.type ? transportIconNames[draft.type] : 'rocket-launch'} />} displayValue={draft.type ? transportNames[draft.type] : 'Транспорт'} controlClassName="transport-type-select" aria-label="Тип транспорта" value={draft.type ?? ''} onChange={(event) => { const type = event.target.value as TransportType; setDraft({ ...draft, type, ticketOnSite: type === 'plane' ? false : draft.ticketOnSite }) }}>
                  <option value="">Транспорт</option>
                  {(Object.keys(transportNames) as TransportType[]).map((type) => <option key={type} value={type}>{transportEmoji[type]} {transportNames[type]}</option>)}
                </Select>
                <Input showLabel={false} aria-label={draft.type ? transportNamePlaceholders[draft.type] : 'Название транспорта'} icon={<Icon name="book" />} placeholder={draft.type ? transportNamePlaceholders[draft.type] : 'Название транспорта'} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              </div>
            </fieldset>
            <div className="transport-ticket-list">
              {visibleTickets.map((ticket) => <InfoRow key={ticket.id} className="transport-ticket-row" disabled={draft.ticketOnSite} image={`${import.meta.env.BASE_URL}assets/ticket-placeholder.png`} imageAlt="Билет" title={ticket.name} subtitle={documentMetadata(ticket)} onClick={() => onOpenTicket(ticket)} actionTheme="secondary" actions={[{ icon: <Icon name="download" />, label: 'Скачать билет', onClick: () => onDownloadTicket(ticket) }, ...(readOnly ? [] : [{ icon: <Icon name="delete-forever" />, label: 'Удалить билет', onClick: () => onDeleteTicket(ticket) }])]} />)}
              {legacyTicketName && <InfoRow className="transport-ticket-row" disabled={draft.ticketOnSite} image={`${import.meta.env.BASE_URL}assets/ticket-placeholder.png`} imageAlt="Билет" title={legacyTicketName} />}
              {ticketCount < 1 && !readOnly && <InfoRow className="transport-ticket-row transport-ticket-row-empty" disabled={draft.ticketOnSite} image={`${import.meta.env.BASE_URL}assets/ticket-placeholder.png`} imageAlt="Билет" title="Прикрепить билет" subtitle="Лучше в PDF формате" onClick={onTicket} actionTheme="secondary" actions={[{ icon: <Icon name="add-plus" />, label: 'Прикрепить билет', onClick: onTicket }]} />}
            </div>
            <div className="transport-ticket-meta-row">
              <button className="transport-ticket-on-site" type="button" disabled={readOnly || draft.type === 'plane'} onClick={() => setDraft({ ...draft, ticketOnSite: !draft.ticketOnSite, ...(!draft.ticketOnSite ? { departureTime: '', arrivalTime: '', departureTimeZone: '', arrivalTimeZone: '', payerIds: [], totalAmountRubles: 0 } : {}) })}>
                <span className={`document-check${draft.ticketOnSite ? ' checked' : ''}`} role="checkbox" aria-checked={draft.ticketOnSite} />
                <span>{TICKET_ON_SITE_PAGE_TEXT}</span>
              </button>
            </div>
          </div>
          <fieldset className="dialog-fields transport-stack-fields" disabled={readOnly}>
            <div className="transport-route-layout">
              <div className="transport-route-headings">
                <h3>{departureLabel} – {arrivalLabel}</h3>
                <p className="transport-duration">{journeySummary}</p>
              </div>
              <div className="transport-route-columns">
                <section className="transport-route-group transport-route-arrival">
                  <div className="transport-route-column">
                <label className="form-control transport-date-picker" onClick={(event) => { event.preventDefault(); if (readOnly) return; arrivalDateRef.current?.showPicker() }}><span className="form-control-icon"><Icon name="calendar-month" /></span><span>{formatCompactNumericDate(draft.arrivalDate)}</span><input ref={arrivalDateRef} aria-label="Дата приезда" type="date" value={draft.arrivalDate} onChange={(event) => setDraft({ ...draft, arrivalDate: event.target.value })} /></label>
                <label className={`form-control transport-time-picker${draft.ticketOnSite ? ' transport-time-picker-disabled' : ''}`} aria-disabled={draft.ticketOnSite || undefined}><span className="form-control-icon"><Icon name="time" /></span><input aria-label="Время приезда" type="time" disabled={draft.ticketOnSite} value={draft.arrivalTime} onChange={(event) => setDraft({ ...draft, arrivalTime: event.target.value })} /><span className="transport-time-zone-picker"><span>{formatTimeZoneOffset(arrivalTimeZone, draft.arrivalDate)}</span><select aria-label="Часовой пояс приезда" disabled={draft.ticketOnSite} value={draft.arrivalTimeZone} onChange={(event) => setDraft({ ...draft, arrivalTimeZone: event.target.value })}><option value="">По часовому поясу поездки — {formatTimeZoneOption(defaultTimeZone, draft.arrivalDate)}</option>{timeZones.map((zone) => <option key={zone} value={zone}>{formatTimeZoneOption(zone, draft.arrivalDate)}</option>)}</select></span></label>
                <Input showLabel={false} aria-label="Место приезда" icon={<Icon name="attractions" />} placeholder="Название места" value={draft.arrivalStation} onChange={(event) => setDraft({ ...draft, arrivalStation: event.target.value })} />
                <Input showLabel={false} aria-label="Ссылка Google Maps места приезда" icon={<Icon name="pin-transport" />} trailingIcon={draft.arrivalStationUrl.trim() ? <Icon name="content-copy" /> : undefined} trailingIconLabel="Скопировать ссылку" onTrailingIconClick={draft.arrivalStationUrl.trim() ? () => void navigator.clipboard.writeText(draft.arrivalStationUrl.trim()) : undefined} controlClassName="transport-link-input" type="url" placeholder="Ссылка Google Maps" value={draft.arrivalStationUrl} onChange={(event) => setDraft({ ...draft, arrivalStationUrl: event.target.value })} />
                  </div>
                </section>
                <section className="transport-route-group transport-route-departure">
                  <div className="transport-route-column">
                <label className="form-control transport-date-picker" onClick={(event) => { event.preventDefault(); if (readOnly) return; departureDateRef.current?.showPicker() }}><span className="form-control-icon"><Icon name="calendar-month" /></span><span>{formatCompactNumericDate(draft.departureDate)}</span><input ref={departureDateRef} aria-label="Дата отъезда" type="date" value={draft.departureDate} onChange={(event) => setDraft({ ...draft, departureDate: event.target.value })} /></label>
                <label className={`form-control transport-time-picker${draft.ticketOnSite ? ' transport-time-picker-disabled' : ''}`} aria-disabled={draft.ticketOnSite || undefined}><span className="form-control-icon"><Icon name="time" /></span><input aria-label="Время отъезда" type="time" disabled={draft.ticketOnSite} value={draft.departureTime} onChange={(event) => setDraft({ ...draft, departureTime: event.target.value })} /><span className="transport-time-zone-picker"><span>{formatTimeZoneOffset(departureTimeZone, draft.departureDate)}</span><select aria-label="Часовой пояс отправления" disabled={draft.ticketOnSite} value={draft.departureTimeZone} onChange={(event) => setDraft({ ...draft, departureTimeZone: event.target.value })}><option value="">По часовому поясу поездки — {formatTimeZoneOption(defaultTimeZone, draft.departureDate)}</option>{timeZones.map((zone) => <option key={zone} value={zone}>{formatTimeZoneOption(zone, draft.departureDate)}</option>)}</select></span></label>
                <Input showLabel={false} aria-label="Место отправления" icon={<Icon name="attractions" />} placeholder="Название места" value={draft.departureStation} onChange={(event) => setDraft({ ...draft, departureStation: event.target.value })} />
                <Input showLabel={false} aria-label="Ссылка Google Maps места отправления" icon={<Icon name="pin-transport" />} trailingIcon={draft.departureStationUrl.trim() ? <Icon name="content-copy" /> : undefined} trailingIconLabel="Скопировать ссылку" onTrailingIconClick={draft.departureStationUrl.trim() ? () => void navigator.clipboard.writeText(draft.departureStationUrl.trim()) : undefined} controlClassName="transport-link-input" type="url" placeholder="Ссылка Google Maps" value={draft.departureStationUrl} onChange={(event) => setDraft({ ...draft, departureStationUrl: event.target.value })} />
                  </div>
                </section>
              </div>
            </div>
            <section className="transport-route-group transport-notes-group">
              <h3>Что стоит помнить</h3>
              <Textarea aria-label="Заметки о транспорте" placeholder="Места, ориентиры и важная информация" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
              {!draft.ticketOnSite && <div className="transport-payment-group">
                <h3>Оплата</h3>
                <div className="transport-payment-fields">
                  <AssigneeSelect members={members} value={draft.payerIds} icon="face" emptyLabel="Кто платил" onChange={(payerIds) => setDraft({ ...draft, payerIds })} />
                  <MoneyInput ariaLabel="Общая сумма в рублях" value={draft.totalAmountRubles} onChange={(totalAmountRubles) => setDraft({ ...draft, totalAmountRubles })} />
                </div>
                {draft.totalAmountRubles > 0 && draft.payerIds.length > 1 && <p className="transport-payment-share">По {(draft.totalAmountRubles / draft.payerIds.length).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽ заплатил каждый</p>}
              </div>}
              <p className="transport-completion-hint">{draft.ticketOnSite ? 'P.S. Галочка в меню появится после заполнения дат и названий\u00a0локаций' : 'P.S. Галочка в меню появится после заполнения дат, времени, названий\u00a0локаций\u00a0и\u00a0прикрепления\u00a0билета'}</p>
            </section>
          </fieldset>
        </div>
        </section>
        {!readOnly && <Button type="submit">Сохранить</Button>}
      </div>
    </form>
  )
}

function HotelDialog({ cityName, value, members, booking, readOnly = false, onSave, onBooking, onOpenBooking, onDownloadBooking, onDeleteBooking, onClose }: { cityName: string; value: HotelDetails; members: TripMember[]; booking?: TravelFile; readOnly?: boolean; onSave: (value: HotelDetails) => void; onBooking: () => void; onOpenBooking?: () => void; onDownloadBooking?: () => void; onDeleteBooking?: () => void; onClose: () => void }) {
  const [draft, setDraft] = useState(value)
  return (
    <form className="transport-editor-screen trip-background setup-transition" aria-labelledby="hotel-title" onSubmit={(event) => { event.preventDefault(); onSave({ name: draft.name.trim(), url: draft.url.trim(), checkInTime: draft.checkInTime, checkOutTime: draft.checkOutTime, notes: draft.notes.trim(), payerIds: draft.payerIds, totalAmountRubles: draft.totalAmountRubles }) }}>
      <IconButton type="button" className="back-button" size="l" icon={<Icon name="arrow-back" />} onClick={onClose} aria-label="Назад" />
      <div className="transport-editor-content">
        <section className="glass editor transport-dialog transport-editor-card hotel-editor-card">
          <div id="hotel-title" className="transport-dialog-title"><TypographyGroup headingLevel="h2" title={`Отель ${cityName}`} /></div>
          <fieldset className="dialog-fields hotel-editor-fields" disabled={readOnly}>
            <div className="hotel-time-fields">
              <Input label="Время заселения" icon={<Icon name="time" />} type="text" inputMode="numeric" maxLength={5} placeholder="--:--" value={draft.checkInTime} onChange={(event) => setDraft({ ...draft, checkInTime: manualTime(event.target.value) })} />
              <Input label="Время выселения" icon={<Icon name="time" />} type="text" inputMode="numeric" maxLength={5} placeholder="--:--" value={draft.checkOutTime} onChange={(event) => setDraft({ ...draft, checkOutTime: manualTime(event.target.value) })} />
            </div>
            <div className="hotel-location-fields">
              <Input showLabel={false} icon={<Icon name="hotel" />} aria-label="Название места" placeholder="Название места" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} autoFocus />
              <Input showLabel={false} icon={<Icon name="pin-home" />} trailingIcon={draft.url.trim() ? <Icon name="content-copy" /> : undefined} trailingIconLabel="Скопировать ссылку" onTrailingIconClick={draft.url.trim() ? () => void navigator.clipboard.writeText(draft.url.trim()) : undefined} controlClassName="transport-link-input" aria-label="Ссылка на отель в Google Maps" type="url" placeholder="Ссылка Google Maps" value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} />
            </div>
          </fieldset>
          {(booking || !readOnly) && <InfoRow className={booking ? 'transport-ticket-row' : 'transport-ticket-row transport-ticket-row-empty'} image={`${import.meta.env.BASE_URL}assets/hotel-placeholder.png`} imageAlt="Отель" title={booking ? booking.name : 'Прикрепить бронь'} subtitle={booking ? documentMetadata(booking) : 'Лучше в PDF формате'} onClick={booking ? onOpenBooking : onBooking} actionTheme="secondary" actions={booking ? [{ icon: <Icon name="download" />, label: 'Скачать бронь', onClick: onDownloadBooking }, ...(readOnly ? [] : [{ icon: <Icon name="delete-forever" />, label: 'Удалить бронь', onClick: onDeleteBooking }])] : readOnly ? [] : [{ icon: <Icon name="add-plus" />, label: 'Прикрепить бронь', onClick: onBooking }]} />}
          <fieldset className="dialog-fields hotel-details-fields" disabled={readOnly}>
            <section className="transport-route-group transport-notes-group hotel-notes-group">
              <h3>Что стоит помнить</h3>
              <Textarea aria-label="Заметки об отеле" placeholder="Места, ориентиры и важная информация" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
              <div className="transport-payment-group">
                <h3>Оплата</h3>
                <div className="transport-payment-fields">
                  <AssigneeSelect members={members} value={draft.payerIds} icon="face" emptyLabel="Кто платил" onChange={(payerIds) => setDraft({ ...draft, payerIds })} />
                  <MoneyInput ariaLabel="Общая сумма за отель в рублях" value={draft.totalAmountRubles} onChange={(totalAmountRubles) => setDraft({ ...draft, totalAmountRubles })} />
                </div>
                {draft.totalAmountRubles > 0 && draft.payerIds.length > 1 && <p className="transport-payment-share">По {(draft.totalAmountRubles / draft.payerIds.length).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽ заплатил каждый</p>}
              </div>
            </section>
          </fieldset>
          <p className="transport-completion-hint">P.S. Галочка в меню появится, когда все поля будут заполнены и&nbsp;появится&nbsp;файл&nbsp;с&nbsp;бронью&nbsp;отеля</p>
        </section>
        {!readOnly && <Button type="submit">Сохранить</Button>}
      </div>
    </form>
  )
}

function CityPanel({ city, previousCity, nextCity, members, tripStartDate, tripEndDate, tripTimeZone, initialPanel, initialDate, initialFocusPlace, readOnly, onChange, onAddPlace, onUpdatePlace, onDeletePlace, onMovePlace, onTrainChange, onHotelChange, onOpenDocument, onDownloadDocument, onDeleteDocument, onOpenManagedPanel, onPanelClose, onClose }: { city: City; previousCity?: City; nextCity?: City; members: TripMember[]; tripStartDate: string; tripEndDate: string; tripTimeZone: string; initialPanel?: 'hotel' | 'in' | 'out' | null; initialDate?: string | null; initialFocusPlace?: string | null; readOnly?: boolean; onChange: (city: City) => void; onAddPlace: (city: City, date: string, place: Place) => void; onUpdatePlace: (city: City, date: string, place: Place) => void; onDeletePlace: (placeId: string) => void; onMovePlace: (placeId: string, date: string | null, position: number) => void; onTrainChange: (city: City, direction: 'in' | 'out', file: TravelFile, source: File) => Promise<TravelFile | undefined>; onHotelChange: (city: City, file: TravelFile, source: File) => Promise<TravelFile | undefined>; onOpenDocument: (file: TravelFile) => void; onDownloadDocument: (file: TravelFile) => void; onDeleteDocument: (file: TravelFile) => Promise<void>; onOpenManagedPanel: (cityId: string, panel: 'hotel' | 'in' | 'out') => void; onPanelClose: () => void; onClose: () => void }) {
  const [draft, setDraft] = useState(() => ({ ...city, transportIn: city.transportIn ?? emptyTransport(), transportOut: city.transportOut ?? emptyTransport() }))
  useEffect(() => {
    setDraft({ ...city, transportIn: city.transportIn ?? emptyTransport(), transportOut: city.transportOut ?? emptyTransport() })
  }, [city])
  const [contentTransition, setContentTransition] = useState<'idle' | 'out' | 'in'>('idle')
  const [transportDirection, setTransportDirection] = useState<'in' | 'out' | null>(initialPanel === 'in' || initialPanel === 'out' ? initialPanel : null)
  const [hotelOpen, setHotelOpen] = useState(initialPanel === 'hotel')
  const [activeDate, setActiveDate] = useState<string | null>(initialDate && initialDate >= city.arrival && initialDate <= city.departure ? initialDate : null)
  const [focusRequest, setFocusRequest] = useState<string | null>(initialFocusPlace ?? null)
  const hotelFileRef = useRef<HTMLInputElement>(null)
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
    const uploads = selected.map((file) => ({ file, record: { id: uid(), name: file.name, category: `train-${direction}:pending:${uid()}` } }))
    const next = { ...draft, [direction === 'in' ? 'trainIn' : 'trainOut']: uploads[0].file.name, files: [...draft.files, ...uploads.map(({ record }) => record)] }
    setDraft(next)
    uploads.forEach(({ file, record }) => {
      void onTrainChange(next, direction, record, file).then((saved) => {
        if (!saved) return
        setDraft((current) => ({ ...current, files: [...current.files.filter((item) => item.id !== record.id), saved] }))
      }).catch(() => setDraft((current) => ({ ...current, files: current.files.filter((item) => item.id !== record.id) })))
    })
  }
  const addHotelFile = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    const fileRecord = { id: uid(), name: file.name, category: 'hotel-booking' }
    setDraft((current) => ({ ...current, files: [...current.files, fileRecord] }))
    void onHotelChange(draft, fileRecord, file).then((saved) => {
      if (!saved) return
      setDraft((current) => ({ ...current, files: [...current.files.filter((item) => item.id !== fileRecord.id), saved] }))
    }).catch(() => setDraft((current) => ({ ...current, files: current.files.filter((item) => item.id !== fileRecord.id) })))
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
  const ordinaryPlacesByDate = Object.fromEntries(Object.entries(draft.places).map(([date, places]) => [date, places.filter((place) => !isManagedPlace(place))]))
  type ManagedMapPlace = Place & { date: string; dateLocked: true; editTarget: { cityId: string; panel: 'hotel' | 'in' | 'out' }; hotelDetails?: { cityName: string; dateLabel: string; checkInTime: string; checkOutTime: string; hasBooking: boolean } }
  const managedMapPlaces: ManagedMapPlace[] = []
  if (!draft.hotelNotNeeded && (draft.hotel.trim() || draft.hotelUrl.trim())) managedMapPlaces.push({
    id: `managed:hotel:${draft.id}`,
    name: draft.hotel.trim() || `Жильё · ${draft.name}`,
    url: draft.hotelUrl.trim(),
    icon: 'hotel',
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
  const incoming = draft.transportIn.arrivalStation.trim() || draft.transportIn.arrivalStationUrl.trim()
    ? { details: draft.transportIn, owner: draft, panel: 'in' as const }
    : previousCity && (previousCity.transportOut.arrivalStation.trim() || previousCity.transportOut.arrivalStationUrl.trim())
      ? { details: previousCity.transportOut, owner: previousCity, panel: 'out' as const }
      : undefined
  if (incoming) managedMapPlaces.push({ id: `managed:transport-in:${draft.id}`, name: incoming.details.arrivalStation.trim() || draft.name, url: incoming.details.arrivalStationUrl.trim(), icon: 'transport', date: incoming.details.arrivalDate || draft.arrival || UNSCHEDULED_KEY, dateLocked: true, editTarget: { cityId: incoming.owner.id, panel: incoming.panel } })
  const outgoing = draft.transportOut.departureStation.trim() || draft.transportOut.departureStationUrl.trim()
    ? { details: draft.transportOut, owner: draft, panel: 'out' as const }
    : nextCity && (nextCity.transportIn.departureStation.trim() || nextCity.transportIn.departureStationUrl.trim())
      ? { details: nextCity.transportIn, owner: nextCity, panel: 'in' as const }
      : undefined
  if (outgoing) managedMapPlaces.push({ id: `managed:transport-out:${draft.id}`, name: outgoing.details.departureStation.trim() || draft.name, url: outgoing.details.departureStationUrl.trim(), icon: 'transport', date: outgoing.details.departureDate || draft.departure || UNSCHEDULED_KEY, dateLocked: true, editTarget: { cityId: outgoing.owner.id, panel: outgoing.panel } })
  const placesByDate = managedMapPlaces.reduce<Record<string, Place[]>>((result, place) => ({ ...result, [place.date]: [...(result[place.date] ?? []), place] }), ordinaryPlacesByDate)
  const managedPlaceIds = new Set(managedMapPlaces.map((place) => place.id))
  const pointsCount = Object.values(placesByDate).reduce((total, places) => total + places.length, 0)
  const saveTransport = (value: TransportDetails) => {
    if (!transportDirection) return
    const next = { ...draft, [transportDirection === 'in' ? 'transportIn' : 'transportOut']: value }
    setDraft(next)
    onChange(next)
    setTransportDirection(null)
    onPanelClose()
  }
  const saveHotel = (hotel: HotelDetails) => {
    const next = { ...draft, hotel: hotel.name, hotelUrl: hotel.url, hotelCheckInTime: hotel.checkInTime, hotelCheckOutTime: hotel.checkOutTime, hotelNotes: hotel.notes, hotelPayerIds: hotel.payerIds, hotelTotalAmountRubles: hotel.totalAmountRubles }
    setDraft(next)
    onChange(next)
    setHotelOpen(false)
    onPanelClose()
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
                places={[
                  ...Object.entries(ordinaryPlacesByDate).flatMap(([date, items]) => items.map((item) => ({ id: item.id, name: item.name, url: item.url, icon: item.icon, date, latitude: item.latitude, longitude: item.longitude }))),
                  ...managedMapPlaces,
                ]}
                dates={dateRange(draft.arrival, draft.departure)}
                activeDate={activeDate}
                readOnly={readOnly}
                formatDate={formatDate}
                focusRequest={focusRequest}
                onFocusHandled={() => setFocusRequest(null)}
                onEditTarget={({ cityId, panel }) => onOpenManagedPanel(cityId, panel)}
                onOpenBooking={() => { if (hotelDocument) onOpenDocument(hotelDocument) }}
                onAdd={({ name, icon, date, position }) => {
                  const place = { id: uid(), name, url: `https://www.google.com/maps?q=${position.lat.toFixed(6)},${position.lng.toFixed(6)}`, icon, latitude: position.lat, longitude: position.lng }
                  const next = { ...draft, places: { ...draft.places, [date]: [...(draft.places[date] ?? []), place] } }
                  setDraft(next)
                  onAddPlace(next, date, place)
                }}
                onUpdate={(id, value) => {
                  const from = Object.keys(draft.places).find((key) => (draft.places[key] ?? []).some((item) => item.id === id))
                  const current = from ? (draft.places[from] ?? []).find((item) => item.id === id) : undefined
                  if (!from || !current) return
                  const place = { ...current, name: value.name, icon: value.icon }
                  // Смена даты в тултипе — это тот же перенос, что и драг-н-дроп,
                  // поэтому позиция считается концом целевого дня.
                  const to = value.date
                  const source = (draft.places[from] ?? []).filter((item) => item.id !== id)
                  const target = from === to ? (draft.places[from] ?? []).map((item) => item.id === id ? place : item) : [...(draft.places[to] ?? []), place]
                  setDraft((latest) => ({ ...latest, places: { ...latest.places, [from]: from === to ? target : source, [to]: target } }))
                  onUpdatePlace(draft, to, place)
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
                  setDraft((latest) => ({ ...latest, places: { ...latest.places, [entry[0]]: (latest.places[entry[0]] ?? []).map((item) => item.id === id ? resolved : item) } }))
                  onUpdatePlace(draft, entry[0], resolved)
                }}
              />
            </div>
          </div>
        </div>
      </section>
      {transportDirection && <TransportDialog readOnly={readOnly} title={transportDirection === 'in' ? (previousCity ? `${previousCity.name} – ${draft.name}` : `Дом – ${draft.name}`) : (nextCity ? `${draft.name} – ${nextCity.name}` : `${draft.name} – Дом`)} departureLabel={transportDirection === 'in' ? previousCity?.name || 'Дом' : draft.name} arrivalLabel={transportDirection === 'in' ? draft.name : nextCity?.name || 'Дом'} defaultTimeZone={tripTimeZone} members={members} value={transportDirection === 'in' ? { ...draft.transportIn, departureDate: draft.transportIn.departureDate || previousCity?.departure || tripStartDate, arrivalDate: draft.transportIn.arrivalDate || draft.arrival } : { ...draft.transportOut, departureDate: draft.transportOut.departureDate || draft.departure, arrivalDate: draft.transportOut.arrivalDate || nextCity?.arrival || tripEndDate }} ticketName={transportDirection === 'in' ? draft.trainIn : draft.trainOut} tickets={transportDocuments(transportDirection)} onTicket={() => (transportDirection === 'in' ? trainInFileRef : trainOutFileRef).current?.click()} onOpenTicket={onOpenDocument} onDownloadTicket={onDownloadDocument} onDeleteTicket={(file) => { const direction = transportDirection; const previous = draft; setDraft((current) => { const remaining = current.files.filter((item) => item.id !== file.id); const nextTicket = remaining.find((item) => item.category.startsWith(`train-${direction}:`)); return { ...current, [direction === 'in' ? 'trainIn' : 'trainOut']: nextTicket?.name ?? '', files: remaining } }); void onDeleteDocument(file).catch(() => setDraft(previous)) }} onClose={() => { setTransportDirection(null); onPanelClose() }} onSave={saveTransport} />}
      {hotelOpen && <HotelDialog readOnly={readOnly} cityName={draft.name} members={members} value={{ name: draft.hotel, url: draft.hotelUrl, checkInTime: draft.hotelCheckInTime, checkOutTime: draft.hotelCheckOutTime, notes: draft.hotelNotes, payerIds: draft.hotelPayerIds, totalAmountRubles: draft.hotelTotalAmountRubles }} booking={hotelDocument} onBooking={() => hotelFileRef.current?.click()} onOpenBooking={hotelDocument ? () => onOpenDocument(hotelDocument) : undefined} onDownloadBooking={hotelDocument ? () => onDownloadDocument(hotelDocument) : undefined} onDeleteBooking={hotelDocument ? () => { const file = hotelDocument; const previous = draft; setDraft((current) => ({ ...current, files: current.files.filter((item) => item.id !== file.id) })); void onDeleteDocument(file).catch(() => setDraft(previous)) } : undefined} onClose={() => { setHotelOpen(false); onPanelClose() }} onSave={saveHotel} />}
    </>
  )
}

function Dashboard({ trip, user, tripCount, cacheState, online, onChange, onEdit, onTrips, onProfile, onInvite, onCityChange, onDayDescriptionChange, onAddPlace, onUpdatePlace, onDeletePlace, onMovePlace, onTrainUpload, onHotelUpload, onDocumentDelete }: { trip: Trip; user: CurrentUser | null; tripCount: number; cacheState: CacheState; online: boolean; onChange: (trip: Trip) => void; onEdit: () => void; onTrips: () => void; onProfile: () => void; onInvite: () => void; onCityChange: (city: City) => void; onDayDescriptionChange: (date: string, description: string) => void; onAddPlace: (city: City, date: string, place: Place) => void; onUpdatePlace: (city: City, date: string, place: Place) => void; onDeletePlace: (placeId: string) => void; onMovePlace: (placeId: string, date: string | null, position: number) => void; onTrainUpload: (city: City, direction: 'in' | 'out', file: File) => Promise<TravelFile | undefined>; onHotelUpload: (city: City, file: File) => Promise<TravelFile | undefined>; onDocumentDelete: (file: TravelFile) => Promise<void> }) {
  const [showPast, setShowPast] = useState(false)
  const [expensesOpen, setExpensesOpen] = useState(false)
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null)
  const [selectedPanel, setSelectedPanel] = useState<'hotel' | 'in' | 'out' | null>(null)
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [panelReturnCityId, setPanelReturnCityId] = useState<string | null>(null)
  const access = useAccess()
  const [selectedCityDate, setSelectedCityDate] = useState<string | null>(null)
  const today = isoDate(new Date())
  const allDays = dateRange(trip.startDate, trip.endDate)
  const visibleDays = showPast ? allDays : allDays.filter((date) => date >= today)
  const selectedCity = trip.cities.find((city) => city.id === selectedCityId) ?? null
  const selectedCityIndex = selectedCity ? trip.cities.findIndex((city) => city.id === selectedCity.id) : -1
  if (expensesOpen) return <ExpensesScreen trip={trip} onBack={() => setExpensesOpen(false)} />
  return (
    <main className="screen trip-background dashboard" style={tripBackgroundStyle(trip)}>
      <TripSidebar trip={trip} user={user} tripCount={tripCount} cacheState={cacheState} online={online} selectedCityId={selectedCityId} onCity={(city) => { setSelectedPlaceId(null); setSelectedCityId(city.id); setPanelReturnCityId(city.id); setSelectedCityDate(null); setSelectedPanel(null) }} onHotel={(city) => { setSelectedPlaceId(null); setPanelReturnCityId(selectedCityId); setSelectedCityDate(null); setSelectedCityId(city.id); setSelectedPanel('hotel') }} onTransport={(city, direction) => { setSelectedPlaceId(null); setPanelReturnCityId(selectedCityId); setSelectedCityDate(null); setSelectedCityId(city.id); setSelectedPanel(direction) }} onExpenses={() => setExpensesOpen(true)} onEdit={onEdit} onInvite={onInvite} onTrips={onTrips} onProfile={onProfile} />
      <section className={`calendar-column${selectedCity ? ' city-active' : ''}`}>
        {selectedCity ? (
          <CityPanel
            city={selectedCity}
            members={trip.members ?? []}
            tripStartDate={trip.startDate}
            tripEndDate={trip.endDate}
            tripTimeZone={trip.timeZone}
            initialPanel={selectedPanel}
            initialDate={selectedCityDate}
            initialFocusPlace={selectedPlaceId}
            previousCity={trip.cities[selectedCityIndex - 1]}
            nextCity={trip.cities[selectedCityIndex + 1]}
            onOpenManagedPanel={(cityId, panel) => { setSelectedPlaceId(null); setPanelReturnCityId(selectedCityId); setSelectedCityDate(null); setSelectedCityId(cityId); setSelectedPanel(panel) }}
            onPanelClose={() => { setSelectedCityId(panelReturnCityId); setSelectedPanel(null) }}
            onClose={() => { setSelectedPlaceId(null); setSelectedCityId(null); setPanelReturnCityId(null); setSelectedCityDate(null); setSelectedPanel(null) }}
            onChange={(nextCity) => { onChange({ ...trip, cities: trip.cities.map((city) => city.id === nextCity.id ? nextCity : city) }); onCityChange(nextCity) }}
            readOnly={!access.canEdit}
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
            onOpenDocument={(file) => {
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
              }).catch((reason) => { target?.close(); window.alert(reason instanceof Error ? reason.message : 'Не удалось открыть файл') })
            }}
            onDownloadDocument={(file) => {
              void api.downloadDocument(file.id).then((blob) => {
                const url = URL.createObjectURL(blob)
                const anchor = document.createElement('a')
                anchor.href = url
                anchor.download = file.name
                anchor.click()
                window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
              }).catch((reason) => window.alert(reason instanceof Error ? reason.message : 'Не удалось скачать файл'))
            }}
            onDeleteDocument={onDocumentDelete}
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
  const legacyTrip = useRef<Trip | null>((() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') } catch { return null }
  })())
  const [trip, setTrip] = useState<Trip | null>(null)
  const [trips, setTrips] = useState<ApiTripSummary[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [screen, setScreen] = useState<Screen>(viewToken ? 'view' : invitationLink ? 'join' : 'start')
  const [loading, setLoading] = useState(Boolean(session.token || viewToken))
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ApiTripSummary | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const { state: cacheState, online } = useOfflineCache(trip?.id ?? null)

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
      void loadPublicTrip(viewToken).then(() => { setScreen('view'); setLoading(false) }).catch((reason) => { setError(reason instanceof Error ? reason.message : 'Не удалось открыть поездку'); setLoading(false) })
      return
    }
    if (!session.token) return
    if (invitationLink) {
      const token = invitationLink.split('/join/').at(-1)?.trim()
      if (token) {
        void api.acceptInvitation(token).then(async ({ tripId }) => {
          window.history.replaceState({}, '', '/')
          await loadCurrentUser()
          await refreshTrips(); await loadTrip(tripId); setScreen('dashboard'); setLoading(false)
        }).catch((reason) => { setError(reason instanceof Error ? reason.message : 'Не удалось принять приглашение'); setLoading(false) })
        return
      }
    }
    void openAccount().catch(() => { session.token = ''; setLoading(false) })
  }, [])

  const loadPublicTrip = async (token: string) => {
    const result = await api.publicTrip(token)
    const value = fromApiTrip(result.trip)
    const imageUrls: string[] = []
    const loadImage = async (document: TravelFile) => {
      const blob = await api.downloadPublicDocument(token, document.id)
      const url = URL.createObjectURL(blob)
      imageUrls.push(url)
      return url
    }
    if (value.background) value.backgroundUrl = await loadImage(value.background)
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
      const blob = await api.downloadDocument(value.background.id)
      if (backgroundObjectUrlRef.current) URL.revokeObjectURL(backgroundObjectUrlRef.current)
      backgroundObjectUrlRef.current = URL.createObjectURL(blob)
      value.backgroundUrl = backgroundObjectUrlRef.current
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

  const refreshTrips = async () => {
    const result = await api.trips()
    setTrips(result.trips)
    if (!trip) void requestPrefetch(null, tripsListResourceUrls(result.trips, import.meta.env.BASE_URL))
    return result.trips
  }

  const createFromDraft = async (draft: Trip) => {
    const created = await api.createTrip({ name: draft.name, startDate: draft.startDate, endDate: draft.endDate, timeZone: draft.timeZone, backgroundRemoved: draft.backgroundRemoved })
    const cityIds = new Map<string, string>()
    for (const [position, city] of draft.cities.entries()) {
      const result = await api.createCity(created.trip.id, {
        name: city.name, position, arrivalDate: city.arrival, departureDate: city.departure,
        arrivalPeriod: city.arrivalPeriod, departurePeriod: city.departurePeriod, ...cityLocationPayload(city), ...hotelPayload(city), ...transportPayload(city), ...assignmentPayload(city),
      })
      cityIds.set(city.id, result.city.id)
      if (city.imageFile) await api.uploadDocument(created.trip.id, result.city.id, 'city-image', city.imageFile)
      if (city.hotel || city.hotelUrl || city.hotelCheckInTime || city.hotelCheckOutTime) await api.updateCity(created.trip.id, result.city.id, hotelPayload(city))
      for (const [date, places] of Object.entries(city.places)) {
        for (const place of places) await api.createPlace(created.trip.id, result.city.id, { name: place.name, googleMapsUrl: place.url, latitude: place.latitude, longitude: place.longitude, ...(date === UNSCHEDULED_KEY ? {} : { visitDate: date }) })
      }
      for (const task of city.tasks) await api.createTask(created.trip.id, { cityId: result.city.id, title: task.title })
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
    try {
      if (!draft.id) {
        await createFromDraft(draft)
      } else {
        await api.updateTrip(draft.id, { name: draft.name, startDate: draft.startDate, endDate: draft.endDate, timeZone: draft.timeZone, backgroundRemoved: draft.backgroundRemoved })
        const remote = (await api.trip(draft.id)).trip
        const existingIds = new Set(remote.cities.map((city) => city.id))
        const draftIds = new Set(draft.cities.map((city) => city.id))
        for (const city of remote.cities) {
          if (!draftIds.has(city.id)) await api.deleteCity(draft.id, city.id)
        }
        for (const [position, city] of draft.cities.entries()) {
          const payload = { name: city.name, position, arrivalDate: city.arrival, departureDate: city.departure, arrivalPeriod: city.arrivalPeriod, departurePeriod: city.departurePeriod, ...cityLocationPayload(city), ...hotelPayload(city), ...transportPayload(city), ...assignmentPayload(city) }
          const cityId = existingIds.has(city.id) ? city.id : (await api.createCity(draft.id, payload)).city.id
          if (existingIds.has(city.id)) await api.updateCity(draft.id, city.id, payload)
          if (city.imageDeleteId) await api.deleteDocument(city.imageDeleteId)
          if (city.imageFile) await api.uploadDocument(draft.id, cityId, 'city-image', city.imageFile)
        }
        if (draft.backgroundDeleteId) await api.deleteDocument(draft.backgroundDeleteId)
        if (draft.backgroundFile) await api.uploadDocument(draft.id, undefined, 'trip-background', draft.backgroundFile)
        await loadTrip(draft.id)
      }
      setScreen('dashboard')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить') }
  }

  const updateCity = async (city: City) => {
    if (!trip?.id) return
    try { await api.updateCity(trip.id, city.id, { name: city.name, arrivalDate: city.arrival, departureDate: city.departure, arrivalPeriod: city.arrivalPeriod, departurePeriod: city.departurePeriod, ...cityLocationPayload(city), ...hotelPayload(city), ...transportPayload(city), ...assignmentPayload(city) }) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Ошибка сохранения') }
  }

  const addPlace = async (city: City, date: string, place: Place) => {
    if (!trip?.id) return
    try {
      await api.createPlace(trip.id, city.id, { name: place.name, googleMapsUrl: place.url, icon: place.icon, latitude: place.latitude, longitude: place.longitude, ...(date === UNSCHEDULED_KEY ? {} : { visitDate: date }) })
      await loadTrip(trip.id)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ошибка добавления места') }
  }

  const updatePlace = async (city: City, date: string, place: Place) => {
    if (!trip?.id) return
    try {
      // visitDate: null здесь обязателен — иначе точку нельзя вернуть в «Без даты».
      await api.updatePlace(trip.id, place.id, { name: place.name, googleMapsUrl: place.url, icon: place.icon, latitude: place.latitude, longitude: place.longitude, visitDate: date === UNSCHEDULED_KEY ? null : date })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ошибка обновления места') }
  }

  const deletePlace = async (placeId: string) => {
    if (!trip?.id) return
    try {
      await api.deletePlace(trip.id, placeId)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось удалить точку')
      await loadTrip(trip.id)
    }
  }

  const movePlace = async (placeId: string, date: string | null, position: number) => {
    if (!trip?.id) return
    try {
      await api.movePlace(trip.id, placeId, { visitDate: date, position })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось перенести точку')
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
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ошибка загрузки файла'); throw reason }
  }

  const uploadHotel = async (city: City, file: File): Promise<TravelFile | undefined> => {
    if (!trip?.id) return
    try {
      const uploaded = await api.uploadDocument(trip.id, city.id, 'hotel-booking', file)
      await loadTrip(trip.id)
      return { id: uploaded.document.id, name: uploaded.document.original_name, category: uploaded.document.category, uploadedBy: uploaded.document.created_by_name, uploadedAt: uploaded.document.created_at }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ошибка загрузки брони'); throw reason }
  }

  const joinTrip = async (link: string, name: string, email: string, password: string, mode: 'login' | 'register') => {
    const token = link.split('/join/').at(-1)?.trim()
    if (!token) { setError('Неверная ссылка'); return }
    try {
      const auth = mode === 'register' ? await api.register(email, password, name) : await api.login(email, password)
      session.token = auth.token
      await loadCurrentUser()
      const accepted = await api.acceptInvitation(token)
      window.history.replaceState({}, '', '/')
      await refreshTrips(); await loadTrip(accepted.tripId); setScreen('dashboard')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось присоединиться') }
  }

  // Один выключатель на всё приложение: экраны спрашивают useAccess(), а не
  // выводят право на правку из роли или navigator.onLine самостоятельно.
  const access = useMemo(
    () => tripAccess({ publicView: screen === 'view', offline: !online, role: trip?.role }),
    [screen, online, trip?.role],
  )

  const renderScreen = () => {
  if (loading) return <AuthShell><div className="glass auth-modal compact"><h1>Загружаем поездку…</h1></div></AuthShell>

  if (screen === 'view') {
    if (!trip) return <AuthShell><div className="glass auth-modal compact"><h1>{error || 'Поездка не найдена'}</h1></div></AuthShell>
    const noop = () => undefined
    const noopAsync = async () => undefined
    return <Dashboard trip={trip} user={null} tripCount={0} cacheState={cacheState} online={online} onChange={noop} onEdit={noop} onTrips={noop} onProfile={noop} onInvite={noop} onCityChange={noop} onDayDescriptionChange={noop} onAddPlace={noop} onUpdatePlace={noop} onDeletePlace={noop} onMovePlace={noop} onTrainUpload={noopAsync} onHotelUpload={noopAsync} onDocumentDelete={noopAsync} />
  }

  if (screen === 'start' || screen === 'login' || screen === 'join') {
    return (
      <AuthShell onBack={screen === 'start' ? undefined : () => setScreen('start')}>
        {screen === 'start' && <StartScreen onLogin={() => setScreen('login')} onJoin={() => setScreen('join')} />}
        {screen === 'login' && <LoginScreen onSubmit={openAccount} />}
        {screen === 'join' && <JoinScreen initialLink={invitationLink} onSubmit={joinTrip} />}
        {error && <p className="form-hint app-error">{error}</p>}
      </AuthShell>
    )
  }
  if (screen === 'profile' && currentUser) return <ProfileScreen user={currentUser} onBack={() => setScreen(trip ? 'dashboard' : trips.length ? 'trips' : 'start')} onLogout={() => {
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
  if (screen === 'trips') return <><TripsScreen trips={trips} canCreate={currentUser?.email.toLowerCase() === ADMIN_EMAIL} deleteTarget={deleteTarget} onOpen={(id) => { void loadTrip(id).then(() => setScreen('dashboard')) }} onCreate={() => { setTrip(null); setScreen('setup') }} onClose={() => { setDeleteTarget(null); setScreen(trip ? 'dashboard' : 'start') }} onDelete={setDeleteTarget} onCloseDelete={() => setDeleteTarget(null)} onConfirmDelete={async () => { if (!deleteTarget) return; await api.deleteTrip(deleteTarget.id, deleteTarget.name); setDeleteTarget(null); const remaining = await refreshTrips(); if (remaining.length === 1) { await loadTrip(remaining[0].id); setScreen('dashboard') } }} onExport={async (item) => { try { const blob = await api.exportTrip(item.id); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${item.name}.travelspace`; anchor.click(); URL.revokeObjectURL(url) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось экспортировать поездку') } }} onImport={async (file) => { try { const result = await api.importTrip(file); await refreshTrips(); await loadTrip(result.trip.id); setScreen('dashboard') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось импортировать поездку') } }} />{error && <p className="app-error">{error}</p>}</>
  if (screen === 'setup') return <><SetupScreen initial={trip} user={currentUser} onExit={() => setScreen(trip ? 'dashboard' : trips.length ? 'trips' : 'start')} onCreate={(value) => void saveTrip(value)} />{error && <p className="app-error">{error}</p>}</>
  if (!trip) return null
  if (inviteOpen) return <><InviteScreen trip={trip} onBack={() => setInviteOpen(false)} onCreate={async (hours) => (await api.createInvitation(trip.id!, hours)).invitation} onViewLink={async () => (await api.viewLink(trip.id!)).viewLink.url} onRemove={async (member) => { await api.removeMember(trip.id!, member.id); await loadTrip(trip.id!) }} />{error && <p className="app-error">{error}</p>}</>
  return <><Dashboard trip={trip} user={currentUser} tripCount={trips.length} cacheState={cacheState} online={online} onChange={setTrip} onEdit={() => setScreen('setup')} onTrips={async () => { await refreshTrips(); setScreen('trips') }} onProfile={() => setScreen('profile')} onInvite={() => setInviteOpen(true)} onCityChange={(city) => void updateCity(city)} onDayDescriptionChange={(date, description) => { setTrip((current) => current ? { ...current, dayDescriptions: { ...current.dayDescriptions, [date]: description } } : current); if (!trip.id) return; void api.updateDayDescription(trip.id, date, description).catch((reason) => { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить описание дня'); void loadTrip(trip.id!) }) }} onAddPlace={(city, date, place) => void addPlace(city, date, place)} onUpdatePlace={(city, date, place) => void updatePlace(city, date, place)} onDeletePlace={(placeId) => void deletePlace(placeId)} onMovePlace={(placeId, date, position) => void movePlace(placeId, date, position)} onTrainUpload={uploadTrain} onHotelUpload={uploadHotel} onDocumentDelete={async (file) => { if (!trip.id) return; try { await api.deleteDocument(file.id); await loadTrip(trip.id) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось удалить файл'); throw reason } }} />{error && <p className="app-error">{error}</p>}</>
  }

  return <AccessContext.Provider value={access}>{renderScreen()}</AccessContext.Provider>
}
