import { CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiTripDetails, ApiTripSummary, session, TransportType } from './api'
import { Button, IconButton } from './components/Button'
import { AddRow } from './components/AddRow'
import { Input, Select, Textarea } from './components/FormControls'
import { InfoRow } from './components/InfoRow'
import { TypographyGroup } from './components/TypographyGroup'
import { Tabs } from './components/Tabs'
import { GoogleMapPicker } from './components/GoogleMapPicker'
import { SecondaryText } from './components/SecondaryText'
import { CityRow } from './components/CityRow'

type Place = { id: string; name: string; url: string; latitude?: number; longitude?: number }
type Task = { id: string; title: string; done: boolean }
type TravelFile = { id: string; name: string; category: string; uploadedBy?: string; uploadedAt?: string }
type HotelDetails = { name: string; url: string; checkInTime: string; checkOutTime: string; notes: string }
type TransportDetails = { type?: TransportType; departureTime: string; arrivalTime: string; departureStation: string; departureStationUrl: string; arrivalStation: string; arrivalStationUrl: string; notes: string }
type TripMember = { id: string; email: string; displayName: string; role: 'owner' | 'member'; hasAvatar?: boolean; avatarUrl?: string }
type CurrentUser = { id: string; email: string; displayName: string; hasAvatar: boolean; avatarUrl?: string }
type DayPeriod = 'morning' | 'day' | 'evening'
type City = {
  id: string
  name: string
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
  trainIn: string
  trainOut: string
  transportIn: TransportDetails
  transportOut: TransportDetails
  places: Record<string, Place[]>
  tasks: Task[]
  files: TravelFile[]
  image?: TravelFile
  imageUrl?: string
  imageFile?: File
  imageDeleteId?: string
}
type Trip = { id?: string; role?: 'owner' | 'member'; name: string; startDate: string; endDate: string; cities: City[]; dayDescriptions: Record<string, string>; members?: TripMember[]; background?: TravelFile; backgroundUrl?: string; backgroundFile?: File; backgroundRemoved?: boolean; backgroundDeleteId?: string }
type Screen = 'start' | 'login' | 'join' | 'trips' | 'setup' | 'dashboard' | 'profile'
export type IconName = 'link' | 'content-copy' | 'add-pin' | 'add-circle' | 'add-plus' | 'arrow-back' | 'attractions' | 'barefoot' | 'bus' | 'calendar-month' | 'check-small' | 'time' | 'planet' | 'close' | 'edit-location' | 'pin-home' | 'image' | 'edit' | 'face' | 'hotel' | 'key' | 'delete-forever' | 'download' | 'upload-file' | 'docs' | 'plane' | 'sailing' | 'ticket' | 'train'

const STORAGE_KEY = 'tabi-trip-v1'
const UNSCHEDULED_KEY = 'unscheduled'
const ADMIN_EMAIL = 'mirrorkey6629@gmail.com'
const defaultTripBackground = `${import.meta.env.BASE_URL}assets/autumn-garden.jpg`
const cityPlaceholder = `${import.meta.env.BASE_URL}assets/city-placeholder.png`
const ruMonths = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const ruWeekdays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

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
const periodAdverb: Record<DayPeriod, string> = { morning: 'утром', day: 'днём', evening: 'вечером' }
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

const coordinatesFromGoogleMapsUrl = (value: string) => {
  const match = value.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ?? value.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (!match) return undefined
  const latitude = Number(match[1])
  const longitude = Number(match[2])
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : undefined
}

const fromApiTrip = (source: ApiTripDetails): Trip => {
  const backgroundDocument = source.documents.find((document) => !document.city_id && document.category === 'trip-background')
  const cities = source.cities.map<City>((city) => {
    const places: Record<string, Place[]> = {}
    source.places.filter((place) => place.city_id === city.id).forEach((place) => {
      const key = place.visit_date?.slice(0, 10) || UNSCHEDULED_KEY
      ;(places[key] ??= []).push({ id: place.id, name: place.name, url: place.google_maps_url, latitude: place.latitude ?? undefined, longitude: place.longitude ?? undefined })
    })
    const documents = source.documents.filter((document) => document.city_id === city.id)
    const trainIn = documents.find((document) => document.category.startsWith('train-in:'))?.original_name || city.train_in
    const trainOut = documents.find((document) => document.category.startsWith('train-out:'))?.original_name || city.train_out
    const imageDocument = documents.find((document) => document.category === 'city-image')
    return {
      id: city.id,
      name: city.name,
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
      trainIn,
      trainOut,
      transportIn: { type: city.transport_in_type ?? undefined, departureTime: city.transport_in_departure_time, arrivalTime: city.transport_in_arrival_time, departureStation: city.transport_in_departure_station, departureStationUrl: city.transport_in_departure_station_url, arrivalStation: city.transport_in_arrival_station, arrivalStationUrl: city.transport_in_arrival_station_url, notes: city.transport_in_notes ?? '' },
      transportOut: { type: city.transport_out_type ?? undefined, departureTime: city.transport_out_departure_time, arrivalTime: city.transport_out_arrival_time, departureStation: city.transport_out_departure_station, departureStationUrl: city.transport_out_departure_station_url, arrivalStation: city.transport_out_arrival_station, arrivalStationUrl: city.transport_out_arrival_station_url, notes: city.transport_out_notes ?? '' },
      places,
      tasks: source.tasks.filter((task) => task.city_id === city.id).map((task) => ({ id: task.id, title: task.title, done: task.done })),
      files: documents.map((document) => ({ id: document.id, name: document.original_name, category: document.category, uploadedBy: document.created_by_name, uploadedAt: document.created_at })),
      image: imageDocument ? { id: imageDocument.id, name: imageDocument.original_name, category: imageDocument.category, uploadedBy: imageDocument.created_by_name, uploadedAt: imageDocument.created_at } : undefined,
    }
  }).sort(compareCitiesByDate)
  return { id: source.id, role: source.role, name: source.name, startDate: source.start_date.slice(0, 10), endDate: source.end_date.slice(0, 10), cities, dayDescriptions: Object.fromEntries(source.day_notes.map((note) => [note.day_date.slice(0, 10), note.description])), members: source.members.map((member) => ({ id: member.id, email: member.email, displayName: member.display_name, role: member.role, hasAvatar: member.has_avatar })), background: backgroundDocument ? { id: backgroundDocument.id, name: backgroundDocument.original_name, category: backgroundDocument.category } : undefined, backgroundUrl: source.background_removed ? undefined : defaultTripBackground, backgroundRemoved: Boolean(source.background_removed) }
}

// BASE_URL — это vite base, всегда со слэшем на конце. Строки, которые JS собирает
// сам, Vite префиксом не дополняет, в отличие от путей в HTML и CSS.
export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return <img className="ui-icon" src={`${import.meta.env.BASE_URL}assets/icons/${name}.svg`} width={size} height={size} alt="" aria-hidden="true" />
}

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
        <Icon name="planet" size={40} />
        <span className="type-head-l">Travel Space</span>
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
      <h1>{mode === 'login' ? 'Вход' : 'Регистрация'}</h1>
      <div className="form-stack tight">
        {mode === 'register' && <Input theme="accent" icon={<Icon name="face" size={28} />} value={name} onChange={(event) => setName(event.target.value)} placeholder="Как тебя называть" autoComplete="name" autoFocus />}
        <Input theme="accent" icon={<Icon name="planet" size={28} />} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" autoComplete="email" autoFocus={mode === 'login'} />
        <Input theme="accent" icon={<Icon name="key" size={28} />} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Пароль — минимум 8 символов" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
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
    <form className="glass auth-modal" onSubmit={async (event) => { event.preventDefault(); if (valid) await onSubmit(link, name, email, password, mode) }}>
      <h1>Вставляйте ссылку<br />и поехали</h1>
      <div className="form-stack">
        <div className="form-stack tight">
          <Input theme="accent" icon={<Icon name="link" size={28} />} value={link} onChange={(event) => setLink(event.target.value)} placeholder="Ссылка на поездку" />
          {mode === 'register' && <Input theme="accent" icon={<Icon name="face" size={28} />} value={name} onChange={(event) => setName(event.target.value)} placeholder="Как тебя называть" autoComplete="name" />}
          <Input theme="accent" icon={<Icon name="planet" size={28} />} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" autoComplete="email" />
          <Input theme="accent" icon={<Icon name="key" size={28} />} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Пароль — минимум 8 символов" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </div>
        <Button type="submit" disabled={!valid}>Я в деле</Button>
      </div>
      <button className="auth-mode-switch" type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'Создать новый аккаунт' : 'У меня уже есть аккаунт'}
      </button>
    </form>
  )
}

function ProfileScreen({ user, onBack, onSave, onAvatar }: { user: CurrentUser; onBack: () => void; onSave: (value: { displayName: string; email: string; password?: string }) => Promise<void>; onAvatar: (file: File) => Promise<string> }) {
  const [displayName, setDisplayName] = useState(user.displayName)
  const [email, setEmail] = useState(user.email)
  const [password, setPassword] = useState('')
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
        <h1>Профиль</h1>
        <button className="profile-avatar-button" type="button" onClick={() => avatarInputRef.current?.click()} aria-label="Загрузить новый аватар">
          <img className="profile-avatar" src={avatarUrl} alt="Аватар профиля" />
          <span className="profile-avatar-overlay"><Icon name="edit" size={32} /></span>
        </button>
        <input ref={avatarInputRef} className="hidden-file-input" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current); avatarPreviewRef.current = URL.createObjectURL(file); setAvatarUrl(avatarPreviewRef.current); setAvatarFile(file); setMessage(''); event.currentTarget.value = '' }} />
        <div className="profile-fields">
          <Input icon={<Icon name="face" />} aria-label="Имя" placeholder="Имя" value={displayName} onChange={(event) => { setDisplayName(event.target.value); setMessage('') }} autoComplete="name" />
          <Input icon={<Icon name="planet" />} aria-label="Почта" placeholder="Почта" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setMessage('') }} autoComplete="email" />
          <Input icon={<Icon name="key" />} aria-label="Новый пароль" type="password" value={password} onChange={(event) => { setPassword(event.target.value); setMessage('') }} placeholder="Новый пароль" autoComplete="new-password" />
        </div>
        <Button type="submit" disabled={busy || !changed || !valid}>{busy ? 'Сохраняем…' : 'Сохранить'}</Button>
        {message && <p className="form-hint">{message}</p>}
      </form>
    </main>
  )
}

function TripsScreen({ trips, canCreate, deleteTarget, onOpen, onCreate, onClose, onDelete, onCloseDelete, onConfirmDelete, onExport, onImport }: { trips: ApiTripSummary[]; canCreate: boolean; deleteTarget: ApiTripSummary | null; onOpen: (id: string) => void; onCreate: () => void; onClose: () => void; onDelete: (trip: ApiTripSummary) => void; onCloseDelete: () => void; onConfirmDelete: () => Promise<void>; onExport: (trip: ApiTripSummary) => Promise<void>; onImport: (file: File) => Promise<void> }) {
  const importRef = useRef<HTMLInputElement>(null)
  return (
    <main className="screen auth-screen trips-screen">
      <GalaxyBackground />
      <IconButton className="back-button" size="l" icon={<Icon name="arrow-back" />} onClick={onClose} aria-label="Назад" title="Назад" />
      <section className="glass trips-card">
        {deleteTarget ? <DeleteTripDialog key={deleteTarget.id} trip={deleteTarget} onClose={onCloseDelete} onConfirm={onConfirmDelete} /> : <div className="trips-default-view setup-transition">
          <header className="trips-header"><h1>Мои поездки</h1></header>
          <div className="trips-content">
            <div className="trips-list">
              {trips.map((item) => <InfoRow key={item.id} image={`${import.meta.env.BASE_URL}assets/autumn-garden.jpg`} imageAlt="" title={item.name} subtitle={<>{item.role === 'owner' ? 'Владелец' : 'Гость'} · {formatLongRange(item.start_date.slice(0, 10), item.end_date.slice(0, 10))}</>} onClick={() => onOpen(item.id)} actionTheme="secondary" actions={item.role === 'owner' ? [{ icon: <Icon name="download" />, label: `Экспортировать поездку ${item.name}`, title: 'Экспортировать', onClick: () => void onExport(item) }, { icon: <Icon name="delete-forever" />, label: `Удалить поездку ${item.name}`, title: 'Удалить', className: 'trip-delete-trigger', onClick: () => onDelete(item) }] : []} />)}
            </div>
            {canCreate && <>
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

function InviteScreen({ trip, onBack, onCreate, onRemove }: { trip: Trip; onBack: () => void; onCreate: (hours: number) => Promise<{ url: string; expiresAt: string }>; onRemove: (member: TripMember) => Promise<void> }) {
  const [invite, setInvite] = useState<{ url: string; expiresAt: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const isOwner = trip.role === 'owner'
  const members = [...(trip.members ?? [])].sort((left, right) => {
    if (left.role === right.role) return 0
    return left.role === 'owner' ? -1 : 1
  })
  return <main className="screen trip-background setup-screen" style={tripBackgroundStyle(trip)}>
    <IconButton className="back-button" size="l" icon={<Icon name="arrow-back" />} onClick={onBack} aria-label="Назад" title="Назад" />
    <section className="glass setup-card invite-screen-card">
      <h1>Участники «{trip.name}»</h1>
      {members.length > 0
        ? <div className="member-list">{members.map((member) => <InfoRow key={member.id} image={member.avatarUrl || `${import.meta.env.BASE_URL}assets/${member.role === 'owner' ? 'person-owner.png' : 'person-member.png'}`} imageAlt={`Аватар ${member.displayName}`} imageShape="circle" title={member.displayName} subtitle={member.email} actionTheme="secondary" actions={!isOwner || member.role === 'owner' ? [] : [{ icon: <Icon name="delete-forever" />, label: `Удалить ${member.displayName} из поездки`, title: 'Удалить участника', onClick: () => { if (window.confirm(`Удалить ${member.displayName} из поездки?`)) void onRemove(member) } }]} />)}</div>
        : <p>Не удалось загрузить список участников.</p>}
      {isOwner && <>
        <div className="invite-divider" />
        <TypographyGroup headingLevel="h2" variant="head-m-text" title="Ссылка-приглашение" text="Ссылка действует 24 часа. Новая ссылка сразу отключит предыдущую. Все вошедшие по ней станут гостями." />
        {invite && <div className="invite-result"><Input readOnly value={invite.url} trailingIcon={<Icon name="content-copy" />} trailingIconLabel="Скопировать ссылку" onTrailingIconClick={() => void navigator.clipboard.writeText(invite.url)} /><small>Действует до {new Date(invite.expiresAt).toLocaleString('ru-RU')}</small></div>}
        <Button size="l" disabled={busy} onClick={async () => { setBusy(true); try { setInvite(await onCreate(24)) } finally { setBusy(false) } }}>{busy ? 'Создаём…' : invite ? 'Создать новую ссылку' : 'Создать ссылку'}</Button>
      </>}
    </section>
  </main>
}

const emptyTransport = (): TransportDetails => ({ departureTime: '', arrivalTime: '', departureStation: '', departureStationUrl: '', arrivalStation: '', arrivalStationUrl: '', notes: '' })
const transportPayload = (city: City) => ({
  transportInType: city.transportIn?.type,
  transportOutType: city.transportOut?.type,
  transportInDepartureTime: city.transportIn?.departureTime ?? '',
  transportInArrivalTime: city.transportIn?.arrivalTime ?? '',
  transportOutDepartureTime: city.transportOut?.departureTime ?? '',
  transportOutArrivalTime: city.transportOut?.arrivalTime ?? '',
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
})
const hotelPayload = (city: City) => ({ hotelNotNeeded: city.hotelNotNeeded, hotel: city.hotel, hotelUrl: city.hotelUrl, hotelCheckInTime: city.hotelCheckInTime ?? '', hotelCheckOutTime: city.hotelCheckOutTime ?? '', hotelNotes: city.hotelNotes ?? '' })
const emptyCity = (): City => ({ id: uid(), name: '', arrival: '', departure: '', arrivalPeriod: 'morning', departurePeriod: 'evening', hotelNotNeeded: false, hotel: '', hotelUrl: '', hotelCheckInTime: '', hotelCheckOutTime: '', hotelNotes: '', trainIn: '', trainOut: '', transportIn: emptyTransport(), transportOut: emptyTransport(), places: {}, tasks: [], files: [] })

function CityEditor({ trip, initial, onSave, onClose }: { trip: Trip; initial?: City; onSave: (city: City) => void; onClose: () => void }) {
  const [city, setCity] = useState<City>(() => initial ? { ...initial, arrivalPeriod: initial.arrivalPeriod ?? 'morning', departurePeriod: initial.departurePeriod ?? 'evening' } : emptyCity())
  const imageFileRef = useRef<HTMLInputElement>(null)
  const imagePreviewUrlRef = useRef<string | null>(null)
  const sameDayPeriodsValid = city.arrival !== city.departure || periodOrder[city.departurePeriod ?? 'evening'] >= periodOrder[city.arrivalPeriod ?? 'morning']
  const valid = city.name.trim() && city.arrival && city.departure && city.departure >= city.arrival && sameDayPeriodsValid
  const tripDates = dateRange(trip.startDate, trip.endDate)
  const departureDates = tripDates.filter((date) => !city.arrival || date >= city.arrival)
  const hasImage = Boolean(city.imageFile || city.image || city.imageUrl)
  return (
    <form className="city-editor-view setup-transition" onSubmit={(event) => { event.preventDefault(); if (valid) onSave(city) }}>
      <div className="modal-title">
        <div>{!initial && <span className="eyebrow">Новая локация</span>}<h2>{initial ? city.name : 'Добавить город'}</h2></div>
        <IconButton type="button" icon={<Icon name="close" />} onClick={onClose} aria-label="Закрыть" />
      </div>
      <InfoRow className="city-image-row" image={hasImage ? city.imageUrl || cityPlaceholder : undefined} imageAlt="Фото города" title={hasImage ? 'Фото города' : 'Прикрепить фото города'} subtitle={hasImage ? city.imageFile?.name || city.image?.name || 'Фото города' : 'Лучше в вертикальном формате'} actionTheme="secondary" actions={hasImage ? [{ icon: <Icon name="edit" />, label: 'Выбрать новое фото города', onClick: () => imageFileRef.current?.click() }, { icon: <Icon name="delete-forever" />, label: 'Удалить фото города', onClick: () => setCity((current) => ({ ...current, imageDeleteId: current.image?.id, image: undefined, imageFile: undefined, imageUrl: undefined })) }] : [{ icon: <Icon name="add-plus" />, label: 'Прикрепить фото города', onClick: () => imageFileRef.current?.click() }]} />
      <input ref={imageFileRef} className="hidden-file-input" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (imagePreviewUrlRef.current) URL.revokeObjectURL(imagePreviewUrlRef.current); imagePreviewUrlRef.current = URL.createObjectURL(file); setCity((current) => ({ ...current, imageFile: file, imageUrl: imagePreviewUrlRef.current ?? undefined })); event.currentTarget.value = '' }} />
      <div className="field-grid">
        <label className="field span-2"><span>Город</span><Input value={city.name} onChange={(e) => setCity({ ...city, name: e.target.value })} placeholder="Например, Осака" autoFocus /></label>
        <label className="field"><span>Прибытие</span><div className="date-time-fields"><Select content="date" icon={<Icon name="calendar-month" />} value={city.arrival} onChange={(e) => { const value = e.target.value; setCity((current) => ({ ...current, arrival: value, departure: current.departure < value ? '' : current.departure })) }}><option value="">Выберите дату</option>{tripDates.map((date) => <option key={date} value={date}>{formatDate(date)} · {ruWeekdays[parseDate(date).getDay()]}</option>)}</Select><Select content="list" icon={<Icon name="time" />} aria-label="Время прибытия" value={city.arrivalPeriod ?? 'morning'} onChange={(e) => setCity((current) => ({ ...current, arrivalPeriod: e.target.value as DayPeriod }))}><option value="morning">Утро</option><option value="day">День</option><option value="evening">Вечер</option></Select></div></label>
        <label className="field"><span>Отъезд</span><div className="date-time-fields"><Select content="date" icon={<Icon name="calendar-month" />} value={city.departure} disabled={!city.arrival} onChange={(e) => setCity((current) => ({ ...current, departure: e.target.value }))}><option value="">Выберите дату</option>{departureDates.map((date) => <option key={date} value={date}>{formatDate(date)} · {ruWeekdays[parseDate(date).getDay()]}</option>)}</Select><Select content="list" icon={<Icon name="time" />} aria-label="Время отъезда" value={city.departurePeriod ?? 'evening'} onChange={(e) => setCity((current) => ({ ...current, departurePeriod: e.target.value as DayPeriod }))}><option value="morning">Утро</option><option value="day">День</option><option value="evening">Вечер</option></Select></div></label>
        <label className="city-hotel-toggle span-2"><input type="checkbox" checked={city.hotelNotNeeded} onChange={(event) => setCity((current) => ({ ...current, hotelNotNeeded: event.target.checked }))} /><span className={`document-check${city.hotelNotNeeded ? ' checked' : ''}`} aria-hidden="true" /><SecondaryText>Отель не нужен</SecondaryText></label>
      </div>
      <Button type="submit" disabled={!valid}>{initial ? 'Сохранить' : 'Добавить'}</Button>
    </form>
  )
}

function AllCitiesEditor({ trip, onSave, onClose }: { trip: Trip; onSave: (cities: City[]) => void; onClose: () => void }) {
  const [cities, setCities] = useState(() => trip.cities.map((city) => ({ ...city })))
  const tripDates = dateRange(trip.startDate, trip.endDate)
  const updateCity = (id: string, patch: Partial<City>) => setCities((current) => current.map((city) => city.id === id ? { ...city, ...patch } : city))
  const valid = cities.every((city) => {
    const arrivalPeriod = city.arrivalPeriod ?? 'morning'
    const departurePeriod = city.departurePeriod ?? 'evening'
    return city.name.trim() && city.arrival && city.departure && city.departure >= city.arrival && (city.arrival !== city.departure || periodOrder[departurePeriod] >= periodOrder[arrivalPeriod])
  })

  return (
    <form className="all-cities-editor setup-transition" onSubmit={(event) => { event.preventDefault(); if (valid) onSave(cities) }}>
      <IconButton type="button" className="bulk-edit-button" icon={<Icon name="close" />} onClick={onClose} aria-label="Закрыть редактирование" />
      <div className="all-cities-scroll">
        <h2>Все города</h2>
        <div className="all-cities-list">
          {cities.map((city) => {
            const departureDates = tripDates.filter((date) => !city.arrival || date >= city.arrival)
            return (
              <section className="all-city-fields" key={city.id}>
                <label className="field city-name-field"><span>Город</span><Input value={city.name} onChange={(event) => updateCity(city.id, { name: event.target.value })} /></label>
                <label className="field"><span>Прибытие</span><div className="date-time-fields"><Select content="date" icon={<Icon name="calendar-month" />} value={city.arrival} onChange={(event) => { const arrival = event.target.value; updateCity(city.id, { arrival, departure: city.departure < arrival ? '' : city.departure }) }}><option value="">Выберите дату</option>{tripDates.map((date) => <option key={date} value={date}>{formatDate(date)} · {ruWeekdays[parseDate(date).getDay()]}</option>)}</Select><Select content="list" icon={<Icon name="time" />} aria-label={`Время прибытия в ${city.name}`} value={city.arrivalPeriod ?? 'morning'} onChange={(event) => updateCity(city.id, { arrivalPeriod: event.target.value as DayPeriod })}><option value="morning">Утро</option><option value="day">День</option><option value="evening">Вечер</option></Select></div></label>
                <label className="field"><span>Отъезд</span><div className="date-time-fields"><Select content="date" icon={<Icon name="calendar-month" />} value={city.departure} disabled={!city.arrival} onChange={(event) => updateCity(city.id, { departure: event.target.value })}><option value="">Выберите дату</option>{departureDates.map((date) => <option key={date} value={date}>{formatDate(date)} · {ruWeekdays[parseDate(date).getDay()]}</option>)}</Select><Select content="list" icon={<Icon name="time" />} aria-label={`Время отъезда из ${city.name}`} value={city.departurePeriod ?? 'evening'} onChange={(event) => updateCity(city.id, { departurePeriod: event.target.value as DayPeriod })}><option value="morning">Утро</option><option value="day">День</option><option value="evening">Вечер</option></Select></div></label>
                <label className="city-hotel-toggle all-city-hotel-toggle"><input type="checkbox" checked={city.hotelNotNeeded} onChange={(event) => updateCity(city.id, { hotelNotNeeded: event.target.checked })} /><span className={`document-check${city.hotelNotNeeded ? ' checked' : ''}`} aria-hidden="true" /><SecondaryText>Отель не нужен</SecondaryText></label>
              </section>
            )
          })}
        </div>
        <Button type="submit" disabled={!valid}>Сохранить</Button>
      </div>
    </form>
  )
}

function SetupScreen({ initial, onCreate, onExit }: { initial: Trip | null; onCreate: (trip: Trip) => void; onExit: () => void }) {
  const [trip, setTrip] = useState<Trip>(initial ?? { name: '', startDate: '', endDate: '', cities: [], dayDescriptions: {} })
  const [editing, setEditing] = useState<City | null | undefined>(undefined)
  const [editingAll, setEditingAll] = useState(false)
  const startDateRef = useRef<HTMLInputElement>(null)
  const endDateRef = useRef<HTMLInputElement>(null)
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
      <section className={`glass setup-card${editingAll ? ' editing-all' : ''}`}>
        {editingAll ? (
          <AllCitiesEditor trip={trip} onClose={() => setEditingAll(false)} onSave={(cities) => { setTrip((current) => ({ ...current, cities: sortCitiesByDate(cities) })); setEditingAll(false) }} />
        ) : editing !== undefined ? (
          <CityEditor trip={trip} initial={editing ?? undefined} onSave={upsertCity} onClose={() => setEditing(undefined)} />
        ) : (
          <div className="setup-content setup-transition">
            <div className="trip-fields">
              <input className="title-input" value={trip.name} onChange={(e) => setTrip((current) => ({ ...current, name: e.target.value }))} placeholder="Название поездки" />
              <div className="date-summary">
                <button type="button" onClick={() => openDatePicker(startDateRef)}>{trip.startDate ? formatDate(trip.startDate) : 'Дата начала'}</button>
                <span>—</span>
                <button type="button" onClick={() => openDatePicker(endDateRef)}>{trip.endDate ? formatDate(trip.endDate) : 'Дата окончания'}</button>
                {datesValid && <span>· {formatDays(tripDays)}</span>}
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
            {trip.cities.length > 0 && <Button disabled={!trip.name.trim()} onClick={() => onCreate(trip)}>{initial ? 'Сохранить' : 'Создать'}</Button>}
          </div>
        )}
      </section>
    </main>
  )
}

function DocumentStatus({ checked, children, onClick }: { checked: boolean; children: React.ReactNode; onClick?: () => void }) {
  return <button type="button" className="document-row" onClick={onClick}><span className={`document-check${checked ? ' checked' : ''}`} role="checkbox" aria-checked={checked} /><SecondaryText interactive>{children}</SecondaryText></button>
}

const isTransportComplete = (details: TransportDetails | undefined, ticketName: string) => Boolean(
  ticketName.trim()
  && details?.type
  && details.departureTime.trim()
  && details.arrivalTime.trim()
  && details.departureStation.trim()
  && details.arrivalStation.trim(),
)

const isHotelComplete = (city: City) => Boolean(city.hotel.trim() && city.hotelUrl.trim() && city.hotelCheckInTime?.trim() && city.hotelCheckOutTime?.trim() && city.files.some((file) => file.category === 'hotel-booking'))

const transportIcons: Record<TransportType, IconName> = { train: 'train', plane: 'plane', bus: 'bus', ship: 'sailing' }
const TransportLabel = ({ label, type }: { label: string; type?: TransportType }) => <span className="transport-label">{type && <Icon name={transportIcons[type]} size={20} />}<span>{label}</span></span>
const withNote = (label: string, note?: string) => note?.trim() ? `${label} (${note.trim()})` : label

function TripSidebar({ trip, user, tripCount, selectedCityId, onCity, onHotel, onTransport, onEdit, onInvite, onTrips, onProfile }: { trip: Trip; user: CurrentUser | null; tripCount: number; selectedCityId?: string | null; onCity: (city: City) => void; onHotel: (city: City) => void; onTransport: (city: City, direction: 'in' | 'out') => void; onEdit: () => void; onInvite: () => void; onTrips: () => void; onProfile: () => void }) {
  const daysLeft = Math.ceil((parseDate(trip.startDate).getTime() - new Date().getTime()) / 86400000)
  const isAdmin = user?.email.toLowerCase() === ADMIN_EMAIL
  const showTrips = tripCount > 1 || isAdmin
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
        <TypographyGroup title={trip.name} text={<>{formatLongRange(trip.startDate, trip.endDate)} · {formatDays(daysBetween(trip.startDate, trip.endDate) + 1)} · <button type="button" className="participants-link" onClick={onInvite}>{formatParticipants(Math.max(1, trip.members?.length ?? 0))}</button></>} />
        <div className="city-list">{trip.cities.map((city, index) => {
          const previousCity = trip.cities[index - 1]
          const ticketComplete = previousCity
            ? isTransportComplete(previousCity.transportOut, previousCity.trainOut) || isTransportComplete(city.transportIn, city.trainIn)
            : isTransportComplete(city.transportIn, city.trainIn)
          const hotelComplete = isHotelComplete(city)
          return (
            <div className="sidebar-city-entry" key={city.id}>
              <CityRow city={city.name} dates={formatShortRange(city.arrival, city.departure)} duration={formatDays(cityDays(city))} image={city.imageUrl || cityPlaceholder} imageAlt="Изображение города" imageFallback={cityPlaceholder} selected={city.id === selectedCityId} aria-current={city.id === selectedCityId ? 'true' : undefined} onClick={() => onCity(city)} />
              <div className="sidebar-city-actions">
                {!city.hotelNotNeeded && <span className="sidebar-city-action"><IconButton size="m" theme="secondary" icon={<Icon name="hotel" />} aria-label={`Отель в ${city.name}`} title={`Отель в ${city.name}`} onClick={() => onHotel(city)} />{hotelComplete && <span className="city-action-complete" aria-hidden="true"><Icon name="check-small" size={16} /></span>}</span>}
                <span className="sidebar-city-action"><IconButton size="m" theme="secondary" icon={<Icon name="ticket" />} aria-label={`Билет в ${city.name}`} title={`Билет в ${city.name}`} onClick={() => previousCity ? onTransport(previousCity, 'out') : onTransport(city, 'in')} />{ticketComplete && <span className="city-action-complete" aria-hidden="true"><Icon name="check-small" size={16} /></span>}</span>
              </div>
            </div>
          )
        })}</div>
        {trip.role === 'owner' && <div className="trip-summary-actions">
          <Button size="m" onClick={onEdit}>Редактировать</Button>
          <Button size="m" theme="secondary" onClick={onInvite}>Пригласить</Button>
        </div>}
      </section>
      <section className="glass sidebar-card links-card">
        <TypographyGroup className="readiness-heading" title="Готовность к поездке" text={`${countdownText} · Готовность ${readinessPercent}%`} />
        {hotelCities.length > 0 && <><h3>Отели</h3>{hotelCities.map((city) => <DocumentStatus key={city.id} checked={isHotelComplete(city)} onClick={() => onHotel(city)}>{withNote(city.name, city.hotelNotes)}</DocumentStatus>)}</>}
        <h3 className={hotelCities.length > 0 ? 'readiness-transport-heading' : undefined}>Транспорт</h3>
        {trip.cities[0] && <DocumentStatus checked={isTransportComplete(trip.cities[0].transportIn, trip.cities[0].trainIn)} onClick={() => onTransport(trip.cities[0], 'in')}><TransportLabel label={withNote('Приезд', trip.cities[0].transportIn?.notes)} type={trip.cities[0].transportIn?.type} /></DocumentStatus>}
        {trip.cities.slice(0, -1).map((city, index) => {
          const nextCity = trip.cities[index + 1]
          const checked = isTransportComplete(city.transportOut, city.trainOut) || isTransportComplete(nextCity.transportIn, nextCity.trainIn)
          const type = city.transportOut?.type ?? nextCity.transportIn?.type
          const note = city.transportOut?.notes.trim() || nextCity.transportIn?.notes.trim()
          return <DocumentStatus key={`${city.id}:${nextCity.id}`} checked={checked} onClick={() => onTransport(city, 'out')}><TransportLabel label={withNote(`${city.name} — ${nextCity.name}`, note)} type={type} /></DocumentStatus>
        })}
        {trip.cities.at(-1) && <DocumentStatus checked={isTransportComplete(trip.cities.at(-1)!.transportOut, trip.cities.at(-1)!.trainOut)} onClick={() => onTransport(trip.cities.at(-1)!, 'out')}><TransportLabel label={withNote('Отъезд', trip.cities.at(-1)!.transportOut?.notes)} type={trip.cities.at(-1)!.transportOut?.type} /></DocumentStatus>}
      </section>
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

function DayCard({ date, cities, allCities, description, hidden, onEvent, onCity, onAddLocations, onDescriptionChange }: { date: string; cities: City[]; allCities: City[]; description: string; hidden: boolean; onEvent: (city: City, panel: 'hotel' | 'in' | 'out') => void; onCity: (city: City) => void; onAddLocations: (city: City, date: string) => void; onDescriptionChange: (description: string) => void }) {
  const day = parseDate(date)
  const [descriptionDraft, setDescriptionDraft] = useState(description)
  useEffect(() => setDescriptionDraft(description), [description])
  type DayEvent = { key: string; title: string; subtitle?: string; icon?: IconName; city: City; panel?: 'hotel' | 'in' | 'out' }
  const events: DayEvent[] = []
  const transferCityIds = new Set<string>()
  allCities.slice(0, -1).forEach((departureCity, index) => {
    const arrivalCity = allCities[index + 1]
    if (departureCity.departure !== date || arrivalCity.arrival !== date) return
    transferCityIds.add(departureCity.id)
    transferCityIds.add(arrivalCity.id)
    if (!departureCity.hotelNotNeeded) {
      const checkOutTime = departureCity.hotelCheckOutTime.trim()
      events.push({ key: `${departureCity.id}:check-out`, title: departureCity.hotel.trim() || 'Отель', subtitle: checkOutTime ? `Выселение в ${checkOutTime}` : 'Выселение', icon: 'hotel', city: departureCity, panel: 'hotel' })
    }
    const outgoing = departureCity.transportOut
    const incoming = arrivalCity.transportIn
    const departureTime = outgoing.departureTime.trim() || incoming.departureTime.trim()
    const arrivalTime = outgoing.arrivalTime.trim() || incoming.arrivalTime.trim()
    const departureLabel = departureTime ? `Отъезд в ${departureTime}` : `Отъезд ${periodAdverb[departureCity.departurePeriod ?? 'evening']}`
    const arrivalLabel = arrivalTime ? `Прибытие в ${arrivalTime}` : `Прибытие ${periodAdverb[arrivalCity.arrivalPeriod ?? 'morning']}`
    const hasOutgoingDetails = Boolean(departureCity.trainOut || outgoing.type || outgoing.departureTime.trim() || outgoing.arrivalTime.trim() || outgoing.departureStation.trim() || outgoing.arrivalStation.trim())
    events.push({ key: `${departureCity.id}:${arrivalCity.id}:transfer`, title: `${departureCity.name} — ${arrivalCity.name}`, subtitle: `${departureLabel} · ${arrivalLabel}`, icon: 'ticket', city: hasOutgoingDetails ? departureCity : arrivalCity, panel: hasOutgoingDetails ? 'out' : 'in' })
    if (!arrivalCity.hotelNotNeeded) {
      const checkInTime = arrivalCity.hotelCheckInTime.trim()
      events.push({ key: `${arrivalCity.id}:check-in`, title: arrivalCity.hotel.trim() || 'Отель', subtitle: checkInTime ? `Заселение в ${checkInTime}` : 'Заселение', icon: 'hotel', city: arrivalCity, panel: 'hotel' })
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
      const departurePlace = city.transportIn.departureStation.trim() || previousTransport?.departureStation.trim() || 'Место отъезда'
      const arrivalPlace = city.transportIn.arrivalStation.trim() || previousTransport?.arrivalStation.trim() || city.name
      const hasIncomingDetails = Boolean(city.trainIn || city.transportIn.type || city.transportIn.departureTime.trim() || city.transportIn.arrivalTime.trim() || city.transportIn.departureStation.trim() || city.transportIn.arrivalStation.trim())
      const departureLabel = departureTime ? `Отъезд в ${departureTime}` : 'Отъезд'
      const arrivalLabel = arrivalTime ? `Прибытие в ${arrivalTime}` : `Прибытие ${periodAdverb[city.arrivalPeriod ?? 'morning']}`
      result.push({ key: `${city.id}:arrival`, title: `${departurePlace} — ${arrivalPlace}`, subtitle: `${departureLabel} · ${arrivalLabel}`, icon: 'ticket', city: hasIncomingDetails || !previousCity ? city : previousCity, panel: hasIncomingDetails || !previousCity ? 'in' : 'out' })
      if (!city.hotelNotNeeded) {
        const checkInTime = city.hotelCheckInTime.trim()
        result.push({ key: `${city.id}:check-in`, title: city.hotel.trim() || 'Отель', subtitle: checkInTime ? `Заселение в ${checkInTime}` : 'Заселение', icon: 'hotel', city, panel: 'hotel' })
      }
    }
    if (date === city.departure) {
      if (!city.hotelNotNeeded) {
        const checkOutTime = city.hotelCheckOutTime.trim()
        result.push({ key: `${city.id}:check-out`, title: city.hotel.trim() || 'Отель', subtitle: checkOutTime ? `Выселение в ${checkOutTime}` : 'Выселение', icon: 'hotel', city, panel: 'hotel' })
      }
      const departureTime = city.transportOut.departureTime.trim()
      const departurePlace = city.transportOut.departureStation.trim() || city.name
      result.push({ key: `${city.id}:departure`, title: departurePlace, subtitle: departureTime ? `Отъезд в ${departureTime}` : `Отъезд ${periodAdverb[city.departurePeriod ?? 'evening']}`, icon: 'ticket', city, panel: 'out' })
    }
    if (result.length === 0) result.push({ key: `${city.id}:city-day`, title: `День в ${cityInLocative(city.name)}`, icon: 'barefoot', city })
    events.push(...result)
  })
  const places = cities.flatMap((city) => (city.places[date] ?? []).map((place) => ({ ...place, city })))
  const locationCity = cities.at(-1)
  return (
    <article className={`glass day-card${hidden ? ' past' : ''}`}>
      <header><strong>{day.getDate()} {ruMonths[day.getMonth()].slice(0, 3)}</strong><span>{ruWeekdays[day.getDay()]}</span></header>
      <div className="day-content">
        <label className="day-column day-description">
          <span>Опишите день</span>
          <textarea value={descriptionDraft} placeholder="Короткое описание дня" onChange={(event) => setDescriptionDraft(event.target.value)} onBlur={() => { if (descriptionDraft !== description) onDescriptionChange(descriptionDraft) }} />
        </label>
        <section className={`day-column day-schedule${cities.length === 0 ? ' day-schedule-empty' : ''}`} aria-label="События и локации дня">
          {cities.length === 0 ? <p className="day-empty-city">Добавьте город для посещения</p> : <><div className="day-events">
            <h3>События</h3>
            {events.length > 0 && <ul className="day-event-list">{events.map((event) => <li key={event.key}><button type="button" className="day-event-line" onClick={() => event.panel ? onEvent(event.city, event.panel) : onCity(event.city)}>{event.icon && <Icon name={event.icon} size={16} />}<span>{event.title}{event.subtitle ? ` · ${event.subtitle}` : ''}</span></button></li>)}</ul>}
            {events.length === 0 && <p className="empty-text">В этот день пока нет событий</p>}
          </div>
          <div className="day-places">
            <h3>Локации</h3>
            {places.length > 0 && <ol>{places.map((place) => <li key={`${place.city.id}:${place.id}`}><button type="button" onClick={() => onCity(place.city)}>{place.name}</button></li>)}</ol>}
            {places.length === 0 && locationCity && <button type="button" className="day-add-locations" onClick={() => onAddLocations(locationCity, date)}>Добавьте места для посещения</button>}
          </div>
          </>}
        </section>
      </div>
    </article>
  )
}

const transportNames: Record<TransportType, string> = { train: 'Поезд', plane: 'Самолёт', bus: 'Автобус', ship: 'Корабль' }
const transportTabs = (Object.keys(transportNames) as TransportType[]).map((value) => ({ value, label: <TransportLabel label={transportNames[value]} type={value} /> }))
const manualTime = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits
}
const documentMetadata = (file: TravelFile) => {
  if (!file.uploadedBy && !file.uploadedAt) return undefined
  const uploadedAt = file.uploadedAt ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(file.uploadedAt)) : ''
  return [file.uploadedBy, uploadedAt].filter(Boolean).join(' · ')
}

function TransportDialog({ title, value, ticketName, tickets, onSave, onTicket, onOpenTicket, onDownloadTicket, onDeleteTicket, onClose }: { title: string; value: TransportDetails; ticketName: string; tickets: TravelFile[]; onSave: (value: TransportDetails) => void; onTicket: () => void; onOpenTicket: (ticket: TravelFile) => void; onDownloadTicket: (ticket: TravelFile) => void; onDeleteTicket: (ticket: TravelFile) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<TransportDetails>({ ...value })
  const visibleTickets = tickets.slice(0, 2)
  const legacyTicketName = visibleTickets.length === 0 ? ticketName : ''
  const ticketCount = visibleTickets.length + Number(Boolean(legacyTicketName))
  return (
    <div className="overlay" role="presentation">
      <form className="glass modal editor transport-dialog" role="dialog" aria-modal="true" aria-labelledby="transport-title" onSubmit={(event) => { event.preventDefault(); if (draft.type) onSave(draft) }}>
        <div className="modal-title transport-dialog-title">
          <div id="transport-title"><TypographyGroup headingLevel="h2" title={<TransportLabel label={title} type={draft.type} />} text="Галочка в меню появится, когда будут заполнены время и места, а также прикреплён билет" /></div>
          <IconButton type="button" icon={<Icon name="close" />} onClick={onClose} aria-label="Закрыть" />
        </div>
        <Tabs value={draft.type} options={transportTabs} ariaLabel="Тип перемещения" onChange={(type) => setDraft({ ...draft, type })} />
        <div className="field-grid transport-fields">
          <div className="transport-column">
            <Input label="Отъезд" icon={<Icon name="time" />} type="text" inputMode="numeric" maxLength={5} placeholder="--:--" value={draft.departureTime} onChange={(event) => setDraft({ ...draft, departureTime: manualTime(event.target.value) })} />
            <Input icon={<Icon name="attractions" />} aria-label="Название места отъезда" placeholder="Название места" value={draft.departureStation} onChange={(event) => setDraft({ ...draft, departureStation: event.target.value })} />
            <Input icon={<Icon name="add-pin" />} trailingIcon={draft.departureStationUrl.trim() ? <Icon name="content-copy" /> : undefined} trailingIconLabel="Скопировать ссылку" onTrailingIconClick={draft.departureStationUrl.trim() ? () => void navigator.clipboard.writeText(draft.departureStationUrl.trim()) : undefined} controlClassName="transport-link-input" aria-label="Ссылка на место отъезда в Google Maps" type="url" placeholder="Ссылка Google Maps" value={draft.departureStationUrl} onChange={(event) => setDraft({ ...draft, departureStationUrl: event.target.value })} />
          </div>
          <div className="transport-column">
            <Input label="Прибытие" icon={<Icon name="time" />} type="text" inputMode="numeric" maxLength={5} placeholder="--:--" value={draft.arrivalTime} onChange={(event) => setDraft({ ...draft, arrivalTime: manualTime(event.target.value) })} />
            <Input icon={<Icon name="attractions" />} aria-label="Название места прибытия" placeholder="Название места" value={draft.arrivalStation} onChange={(event) => setDraft({ ...draft, arrivalStation: event.target.value })} />
            <Input icon={<Icon name="add-pin" />} trailingIcon={draft.arrivalStationUrl.trim() ? <Icon name="content-copy" /> : undefined} trailingIconLabel="Скопировать ссылку" onTrailingIconClick={draft.arrivalStationUrl.trim() ? () => void navigator.clipboard.writeText(draft.arrivalStationUrl.trim()) : undefined} controlClassName="transport-link-input" aria-label="Ссылка на место прибытия в Google Maps" type="url" placeholder="Ссылка Google Maps" value={draft.arrivalStationUrl} onChange={(event) => setDraft({ ...draft, arrivalStationUrl: event.target.value })} />
          </div>
          <Textarea controlClassName="transport-wide" aria-label="Заметки" placeholder="Заметки" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
        </div>
        <div className="transport-ticket-list">
          {visibleTickets.map((ticket) => <div className="document-card-group" key={ticket.id}><InfoRow className="transport-ticket-row" image={`${import.meta.env.BASE_URL}assets/ticket-placeholder.png`} imageAlt="Билет" title="Билет" subtitle={ticket.name} onClick={() => onOpenTicket(ticket)} actionTheme="secondary" actions={[{ icon: <Icon name="download" />, label: 'Скачать билет', onClick: () => onDownloadTicket(ticket) }, { icon: <Icon name="delete-forever" />, label: 'Удалить билет', onClick: () => onDeleteTicket(ticket) }]} />{documentMetadata(ticket) && <p className="document-card-metadata">{documentMetadata(ticket)}</p>}</div>)}
          {legacyTicketName && <InfoRow className="transport-ticket-row" image={`${import.meta.env.BASE_URL}assets/ticket-placeholder.png`} imageAlt="Билет" title="Билет" subtitle={legacyTicketName} />}
          {ticketCount < 2 && <InfoRow className="transport-ticket-row transport-ticket-row-empty" image={`${import.meta.env.BASE_URL}assets/ticket-placeholder.png`} imageAlt="Билет" title="Прикрепить билет" subtitle="Лучше в PDF формате" onClick={onTicket} actionTheme="secondary" actions={[{ icon: <Icon name="add-plus" />, label: 'Прикрепить билет', onClick: onTicket }]} />}
        </div>
        <Button type="submit" disabled={!draft.type}>Сохранить</Button>
      </form>
    </div>
  )
}

function HotelDialog({ cityName, value, booking, onSave, onBooking, onOpenBooking, onDownloadBooking, onDeleteBooking, onClose }: { cityName: string; value: HotelDetails; booking?: TravelFile; onSave: (value: HotelDetails) => void; onBooking: () => void; onOpenBooking?: () => void; onDownloadBooking?: () => void; onDeleteBooking?: () => void; onClose: () => void }) {
  const [draft, setDraft] = useState(value)
  return (
    <div className="overlay" role="presentation">
      <form className="glass modal editor transport-dialog hotel-dialog" role="dialog" aria-modal="true" aria-labelledby="hotel-title" onSubmit={(event) => { event.preventDefault(); onSave({ name: draft.name.trim(), url: draft.url.trim(), checkInTime: draft.checkInTime, checkOutTime: draft.checkOutTime, notes: draft.notes.trim() }) }}>
        <div className="modal-title transport-dialog-title">
          <div id="hotel-title"><TypographyGroup headingLevel="h2" title={`Отель ${cityName}`} text="Галочка в меню появится, когда все поля будут заполнены и появится файл с бронью отеля" /></div>
          <IconButton type="button" icon={<Icon name="close" />} onClick={onClose} aria-label="Закрыть" />
        </div>
        <div className="field-grid">
          <Input label="Время заселения" icon={<Icon name="time" />} type="text" inputMode="numeric" maxLength={5} placeholder="--:--" value={draft.checkInTime} onChange={(event) => setDraft({ ...draft, checkInTime: manualTime(event.target.value) })} />
          <Input label="Время выселения" icon={<Icon name="time" />} type="text" inputMode="numeric" maxLength={5} placeholder="--:--" value={draft.checkOutTime} onChange={(event) => setDraft({ ...draft, checkOutTime: manualTime(event.target.value) })} />
          <Input icon={<Icon name="attractions" />} controlClassName="transport-wide" aria-label="Название отеля" placeholder="Название отеля" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} autoFocus />
          <Input icon={<Icon name="add-pin" />} trailingIcon={draft.url.trim() ? <Icon name="content-copy" /> : undefined} trailingIconLabel="Скопировать ссылку" onTrailingIconClick={draft.url.trim() ? () => void navigator.clipboard.writeText(draft.url.trim()) : undefined} controlClassName="transport-wide transport-link-input" aria-label="Ссылка на отель в Google Maps" type="url" placeholder="Ссылка Google Maps" value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} />
          <Textarea controlClassName="transport-wide" aria-label="Заметки" placeholder="Заметки" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
        </div>
        <div className={booking ? 'document-card-group' : ''}><InfoRow className={booking ? 'transport-ticket-row' : 'transport-ticket-row transport-ticket-row-empty'} image={`${import.meta.env.BASE_URL}assets/hotel-placeholder.png`} imageAlt="Отель" title={booking ? 'Бронь отеля' : 'Прикрепить бронь'} subtitle={booking ? booking.name : 'Лучше в PDF формате'} onClick={booking ? onOpenBooking : onBooking} actionTheme="secondary" actions={booking ? [{ icon: <Icon name="download" />, label: 'Скачать бронь', onClick: onDownloadBooking }, { icon: <Icon name="delete-forever" />, label: 'Удалить бронь', onClick: onDeleteBooking }] : [{ icon: <Icon name="add-plus" />, label: 'Прикрепить бронь', onClick: onBooking }]} />{booking && documentMetadata(booking) && <p className="document-card-metadata">{documentMetadata(booking)}</p>}</div>
        <Button type="submit">Сохранить</Button>
      </form>
    </div>
  )
}

function CityPanel({ city, previousCity, nextCity, initialPanel, initialDate, onChange, onAddPlace, onUpdatePlace, onTrainChange, onHotelChange, onOpenDocument, onDownloadDocument, onDeleteDocument, onPanelClose, onClose }: { city: City; previousCity?: City; nextCity?: City; initialPanel?: 'hotel' | 'in' | 'out' | null; initialDate?: string | null; onChange: (city: City) => void; onAddPlace: (city: City, date: string, place: Place) => void; onUpdatePlace: (city: City, date: string, place: Place) => void; onTrainChange: (city: City, direction: 'in' | 'out', file: TravelFile, source: File) => Promise<TravelFile | undefined>; onHotelChange: (city: City, file: TravelFile, source: File) => Promise<TravelFile | undefined>; onOpenDocument: (file: TravelFile) => void; onDownloadDocument: (file: TravelFile) => void; onDeleteDocument: (file: TravelFile) => Promise<void>; onPanelClose: () => void; onClose: () => void }) {
  const [draft, setDraft] = useState(() => ({ ...city, transportIn: city.transportIn ?? emptyTransport(), transportOut: city.transportOut ?? emptyTransport() }))
  const [transportDirection, setTransportDirection] = useState<'in' | 'out' | null>(initialPanel === 'in' || initialPanel === 'out' ? initialPanel : null)
  const [hotelOpen, setHotelOpen] = useState(initialPanel === 'hotel')
  const [place, setPlace] = useState('')
  const [placeUrl, setPlaceUrl] = useState('')
  const [placeCoordinates, setPlaceCoordinates] = useState<{ latitude: number; longitude: number } | undefined>()
  const [selectedDate, setSelectedDate] = useState(initialDate && initialDate >= city.arrival && initialDate <= city.departure ? initialDate : dateRange(city.arrival, city.departure)[0])
  const [focusedPlace, setFocusedPlace] = useState<Place | null>(null)
  const hotelFileRef = useRef<HTMLInputElement>(null)
  const trainInFileRef = useRef<HTMLInputElement>(null)
  const trainOutFileRef = useRef<HTMLInputElement>(null)
  const addPlace = (event: FormEvent) => {
    event.preventDefault()
    if (!place.trim()) return
    const coordinates = placeCoordinates ?? coordinatesFromGoogleMapsUrl(placeUrl)
    const next = { ...draft, places: { ...draft.places, [selectedDate]: [...(draft.places[selectedDate] ?? []), { id: uid(), name: place.trim(), url: placeUrl.trim(), ...coordinates }] } }
    setDraft(next); onAddPlace(next, selectedDate, next.places[selectedDate].at(-1)!); setPlace(''); setPlaceUrl(''); setPlaceCoordinates(undefined)
  }
  const addTrainFiles = (files: FileList | null, direction: 'in' | 'out') => {
    const existingCount = draft.files.filter((file) => file.category.startsWith(`train-${direction}:`)).length
    const selected = Array.from(files ?? []).slice(0, Math.max(0, 2 - existingCount))
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
  const mapPoint = focusedPlace?.name || draft.transportIn.arrivalStation || draft.transportOut.departureStation || draft.name
  const transportDocuments = (direction: 'in' | 'out') => draft.files.filter((file) => file.category.startsWith(`train-${direction}:`)).slice(0, 2)
  const hotelDocument = draft.files.find((file) => file.category === 'hotel-booking')
  const pointsCount = Object.values(draft.places).reduce((total, places) => total + places.length, 0)
  const saveTransport = (value: TransportDetails) => {
    if (!transportDirection) return
    let next = { ...draft, [transportDirection === 'in' ? 'transportIn' : 'transportOut']: value }
    if (transportDirection === 'in' && value.arrivalStationUrl.trim()) {
      const arrivalPlaces = next.places[next.arrival] ?? []
      const previousUrl = draft.transportIn.arrivalStationUrl.trim()
      const existing = arrivalPlaces.find((item) => item.url.trim() === previousUrl || item.url.trim() === value.arrivalStationUrl.trim())
      if (existing) {
        const place = { ...existing, name: value.arrivalStation.trim() || 'Место приезда', url: value.arrivalStationUrl.trim() }
        next = { ...next, places: { ...next.places, [next.arrival]: arrivalPlaces.map((item) => item.id === place.id ? place : item) } }
        onUpdatePlace(next, next.arrival, place)
      } else {
        const place = { id: uid(), name: value.arrivalStation.trim() || 'Место приезда', url: value.arrivalStationUrl.trim() }
        next = { ...next, places: { ...next.places, [next.arrival]: [...arrivalPlaces, place] } }
        onAddPlace(next, next.arrival, place)
      }
    }
    setDraft(next)
    onChange(next)
    setTransportDirection(null)
    onPanelClose()
  }
  return (
    <>
      <section className="glass city-page-card setup-transition">
        <div className="city-compact-header">
          <IconButton type="button" className="city-inline-back" icon={<Icon name="calendar-month" />} onClick={onClose} aria-label="Вернуться к календарю" title="Вернуться к календарю" />
          <TypographyGroup className="city-compact-copy" title={draft.name} text={<>{formatLongRange(draft.arrival, draft.departure)} · {formatDays(cityDays(draft))} · {formatLocations(pointsCount)}</>} />
        </div>
        <input ref={trainInFileRef} className="hidden-file-input" type="file" multiple onChange={(e) => { addTrainFiles(e.target.files, 'in'); e.currentTarget.value = '' }} />
        <input ref={trainOutFileRef} className="hidden-file-input" type="file" multiple onChange={(e) => { addTrainFiles(e.target.files, 'out'); e.currentTarget.value = '' }} />
        <input ref={hotelFileRef} className="hidden-file-input" type="file" onChange={(e) => addHotelFile(e.target.files)} />
        <div className="city-main">
          <div className="city-days">
            <div className="city-day unscheduled-day"><h3>Без даты</h3>{(draft.places[UNSCHEDULED_KEY] ?? []).map((item, index) => <button key={item.id} type="button" onClick={() => setFocusedPlace(item)}>{index + 1}. {item.name}</button>)}</div>
            {dateRange(draft.arrival, draft.departure).map((date) => <div className="city-day" key={date}><h3>{formatDate(date)}</h3>{(draft.places[date] ?? []).map((item, index) => <button key={item.id} type="button" onClick={() => setFocusedPlace(item)}>{index + 1}. {item.name}</button>)}</div>)}
          </div>
          <div className="city-route-content">
            <div className="city-map">
              <GoogleMapPicker
                query={mapPoint}
                queryCoordinates={focusedPlace?.latitude !== undefined && focusedPlace.longitude !== undefined ? { lat: focusedPlace.latitude, lng: focusedPlace.longitude } : undefined}
                places={Object.values(draft.places).flat()}
                onSelect={(url, coordinates) => { setPlaceUrl(url); setPlaceCoordinates({ latitude: coordinates.lat, longitude: coordinates.lng }) }}
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
            <form className="route-form" onSubmit={addPlace}>
              <Select content="date" icon={<Icon name="calendar-month" />} aria-label="Дата посещения" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}><option value={UNSCHEDULED_KEY}>Без даты</option>{dateRange(draft.arrival, draft.departure).map((date) => <option key={date} value={date}>{formatDate(date)}</option>)}</Select>
              <Input icon={<Icon name="attractions" />} aria-label="Название места" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Название места" />
              <Input icon={<Icon name="add-pin" />} controlClassName="map-link-input" aria-label="Ссылка Google Maps" value={placeUrl} onChange={(e) => { setPlaceUrl(e.target.value); setPlaceCoordinates(undefined) }} placeholder="Ссылка Google Maps" />
              <Button>Добавить точку</Button>
            </form>
          </div>
        </div>
      </section>
      {transportDirection && <TransportDialog title={transportDirection === 'in' ? (previousCity ? `${previousCity.name} — ${draft.name}` : 'Приезд') : (nextCity ? `${draft.name} — ${nextCity.name}` : 'Отъезд')} value={transportDirection === 'in' ? draft.transportIn : draft.transportOut} ticketName={transportDirection === 'in' ? draft.trainIn : draft.trainOut} tickets={transportDocuments(transportDirection)} onTicket={() => (transportDirection === 'in' ? trainInFileRef : trainOutFileRef).current?.click()} onOpenTicket={onOpenDocument} onDownloadTicket={onDownloadDocument} onDeleteTicket={(file) => { const direction = transportDirection; const previous = draft; setDraft((current) => { const remaining = current.files.filter((item) => item.id !== file.id); const nextTicket = remaining.find((item) => item.category.startsWith(`train-${direction}:`)); return { ...current, [direction === 'in' ? 'trainIn' : 'trainOut']: nextTicket?.name ?? '', files: remaining } }); void onDeleteDocument(file).catch(() => setDraft(previous)) }} onClose={() => { setTransportDirection(null); onPanelClose() }} onSave={saveTransport} />}
      {hotelOpen && <HotelDialog cityName={draft.name} value={{ name: draft.hotel, url: draft.hotelUrl, checkInTime: draft.hotelCheckInTime, checkOutTime: draft.hotelCheckOutTime, notes: draft.hotelNotes }} booking={hotelDocument} onBooking={() => hotelFileRef.current?.click()} onOpenBooking={hotelDocument ? () => onOpenDocument(hotelDocument) : undefined} onDownloadBooking={hotelDocument ? () => onDownloadDocument(hotelDocument) : undefined} onDeleteBooking={hotelDocument ? () => { const file = hotelDocument; const previous = draft; setDraft((current) => ({ ...current, files: current.files.filter((item) => item.id !== file.id) })); void onDeleteDocument(file).catch(() => setDraft(previous)) } : undefined} onClose={() => { setHotelOpen(false); onPanelClose() }} onSave={(hotel) => { const next = { ...draft, hotel: hotel.name, hotelUrl: hotel.url, hotelCheckInTime: hotel.checkInTime, hotelCheckOutTime: hotel.checkOutTime, hotelNotes: hotel.notes }; setDraft(next); onChange(next); setHotelOpen(false); onPanelClose() }} />}
    </>
  )
}

function Dashboard({ trip, user, tripCount, onChange, onEdit, onTrips, onProfile, onInvite, onCityChange, onDayDescriptionChange, onAddPlace, onUpdatePlace, onTrainUpload, onHotelUpload, onDocumentDelete }: { trip: Trip; user: CurrentUser | null; tripCount: number; onChange: (trip: Trip) => void; onEdit: () => void; onTrips: () => void; onProfile: () => void; onInvite: () => void; onCityChange: (city: City) => void; onDayDescriptionChange: (date: string, description: string) => void; onAddPlace: (city: City, date: string, place: Place) => void; onUpdatePlace: (city: City, date: string, place: Place) => void; onTrainUpload: (city: City, direction: 'in' | 'out', file: File) => Promise<TravelFile | undefined>; onHotelUpload: (city: City, file: File) => Promise<TravelFile | undefined>; onDocumentDelete: (file: TravelFile) => Promise<void> }) {
  const [showPast, setShowPast] = useState(false)
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null)
  const [selectedPanel, setSelectedPanel] = useState<'hotel' | 'in' | 'out' | null>(null)
  const [panelReturnCityId, setPanelReturnCityId] = useState<string | null>(null)
  const [selectedCityDate, setSelectedCityDate] = useState<string | null>(null)
  const today = isoDate(new Date())
  const allDays = dateRange(trip.startDate, trip.endDate)
  const visibleDays = showPast ? allDays : allDays.filter((date) => date >= today)
  const selectedCity = trip.cities.find((city) => city.id === selectedCityId) ?? null
  const selectedCityIndex = selectedCity ? trip.cities.findIndex((city) => city.id === selectedCity.id) : -1
  return (
    <main className="screen trip-background dashboard" style={tripBackgroundStyle(trip)}>
      <TripSidebar trip={trip} user={user} tripCount={tripCount} selectedCityId={selectedCityId} onCity={(city) => { setSelectedCityId(city.id); setPanelReturnCityId(city.id); setSelectedCityDate(null); setSelectedPanel(null) }} onHotel={(city) => { setPanelReturnCityId(selectedCityId); setSelectedCityDate(null); setSelectedCityId(city.id); setSelectedPanel('hotel') }} onTransport={(city, direction) => { setPanelReturnCityId(selectedCityId); setSelectedCityDate(null); setSelectedCityId(city.id); setSelectedPanel(direction) }} onEdit={onEdit} onInvite={onInvite} onTrips={onTrips} onProfile={onProfile} />
      <section className={`calendar-column${selectedCity ? ' city-active' : ''}`}>
        {selectedCity ? (
          <CityPanel
            key={`${selectedCity.id}:${selectedPanel ?? 'city'}:${selectedCityDate ?? 'default'}`}
            city={selectedCity}
            initialPanel={selectedPanel}
            initialDate={selectedCityDate}
            previousCity={trip.cities[selectedCityIndex - 1]}
            nextCity={trip.cities[selectedCityIndex + 1]}
            onPanelClose={() => { setSelectedCityId(panelReturnCityId); setSelectedPanel(null) }}
            onClose={() => { setSelectedCityId(null); setPanelReturnCityId(null); setSelectedCityDate(null); setSelectedPanel(null) }}
            onChange={(nextCity) => { onChange({ ...trip, cities: trip.cities.map((city) => city.id === nextCity.id ? nextCity : city) }); onCityChange(nextCity) }}
            onAddPlace={(nextCity, date, place) => { onChange({ ...trip, cities: trip.cities.map((city) => city.id === nextCity.id ? nextCity : city) }); onAddPlace(nextCity, date, place) }}
            onUpdatePlace={(nextCity, date, place) => { onChange({ ...trip, cities: trip.cities.map((city) => city.id === nextCity.id ? nextCity : city) }); onUpdatePlace(nextCity, date, place) }}
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
            {visibleDays.map((date) => <DayCard key={date} date={date} cities={trip.cities.filter((city) => date >= city.arrival && date <= city.departure)} allCities={trip.cities} description={trip.dayDescriptions[date] ?? ''} hidden={date < today} onDescriptionChange={(description) => onDayDescriptionChange(date, description)} onEvent={(city, panel) => { setPanelReturnCityId(null); setSelectedCityDate(null); setSelectedCityId(city.id); setSelectedPanel(panel) }} onCity={(city) => { setSelectedCityId(city.id); setPanelReturnCityId(city.id); setSelectedCityDate(null); setSelectedPanel(null) }} onAddLocations={(city, selectedDate) => { setSelectedCityId(city.id); setPanelReturnCityId(city.id); setSelectedCityDate(selectedDate); setSelectedPanel(null) }} />)}
            {visibleDays.length === 0 && <article className="glass empty-calendar"><h2>Все дни уже прошли</h2><Button onClick={() => setShowPast(true)}>Показать поездку</Button></article>}
          </div>
        )}
      </section>
    </main>
  )
}

export default function App() {
  const invitationLink = window.location.pathname.includes('/join/') ? window.location.href : ''
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
  const [screen, setScreen] = useState<Screen>(invitationLink ? 'join' : 'start')
  const [loading, setLoading] = useState(Boolean(session.token))
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ApiTripSummary | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  const loadCurrentUser = async () => {
    const account = await api.me()
    const user: CurrentUser = account.user
    if (user.hasAvatar) {
      const blob = await api.downloadAvatar()
      if (avatarObjectUrlRef.current) URL.revokeObjectURL(avatarObjectUrlRef.current)
      avatarObjectUrlRef.current = URL.createObjectURL(blob)
      user.avatarUrl = avatarObjectUrlRef.current
    }
    setCurrentUser(user)
    return user
  }

  useEffect(() => {
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
    window.setTimeout(() => previousCityImageUrls.forEach((url) => URL.revokeObjectURL(url)), 1_000)
    return value
  }

  const refreshTrips = async () => {
    const result = await api.trips()
    setTrips(result.trips)
    return result.trips
  }

  const createFromDraft = async (draft: Trip) => {
    const created = await api.createTrip({ name: draft.name, startDate: draft.startDate, endDate: draft.endDate, backgroundRemoved: draft.backgroundRemoved })
    const cityIds = new Map<string, string>()
    for (const [position, city] of draft.cities.entries()) {
      const result = await api.createCity(created.trip.id, {
        name: city.name, position, arrivalDate: city.arrival, departureDate: city.departure,
        arrivalPeriod: city.arrivalPeriod, departurePeriod: city.departurePeriod, ...hotelPayload(city), ...transportPayload(city),
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
        await api.updateTrip(draft.id, { name: draft.name, startDate: draft.startDate, endDate: draft.endDate, backgroundRemoved: draft.backgroundRemoved })
        const remote = (await api.trip(draft.id)).trip
        const existingIds = new Set(remote.cities.map((city) => city.id))
        const draftIds = new Set(draft.cities.map((city) => city.id))
        for (const city of remote.cities) {
          if (!draftIds.has(city.id)) await api.deleteCity(draft.id, city.id)
        }
        for (const [position, city] of draft.cities.entries()) {
          const payload = { name: city.name, position, arrivalDate: city.arrival, departureDate: city.departure, arrivalPeriod: city.arrivalPeriod, departurePeriod: city.departurePeriod, ...hotelPayload(city), ...transportPayload(city) }
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
    try { await api.updateCity(trip.id, city.id, { name: city.name, arrivalDate: city.arrival, departureDate: city.departure, arrivalPeriod: city.arrivalPeriod, departurePeriod: city.departurePeriod, ...hotelPayload(city), ...transportPayload(city) }) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Ошибка сохранения') }
  }

  const addPlace = async (city: City, date: string, place: Place) => {
    if (!trip?.id) return
    try {
      await api.createPlace(trip.id, city.id, { name: place.name, googleMapsUrl: place.url, latitude: place.latitude, longitude: place.longitude, ...(date === UNSCHEDULED_KEY ? {} : { visitDate: date }) })
      await loadTrip(trip.id)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ошибка добавления места') }
  }

  const updatePlace = async (city: City, date: string, place: Place) => {
    if (!trip?.id) return
    try {
      await api.updatePlace(trip.id, place.id, { name: place.name, googleMapsUrl: place.url, latitude: place.latitude, longitude: place.longitude, ...(date === UNSCHEDULED_KEY ? {} : { visitDate: date }) })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ошибка обновления места') }
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

  if (loading) return <AuthShell><div className="glass auth-modal compact"><h1>Загружаем поездку…</h1></div></AuthShell>

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
  if (screen === 'profile' && currentUser) return <ProfileScreen user={currentUser} onBack={() => setScreen(trip ? 'dashboard' : trips.length ? 'trips' : 'start')} onSave={async (value) => { const result = await api.updateProfile(value); setCurrentUser((existing) => ({ ...result.user, avatarUrl: existing?.avatarUrl })) }} onAvatar={async (file) => {
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
  if (screen === 'setup') return <><SetupScreen initial={trip} onExit={() => setScreen(trip ? 'dashboard' : trips.length ? 'trips' : 'start')} onCreate={(value) => void saveTrip(value)} />{error && <p className="app-error">{error}</p>}</>
  if (!trip) return null
  if (inviteOpen) return <><InviteScreen trip={trip} onBack={() => setInviteOpen(false)} onCreate={async (hours) => (await api.createInvitation(trip.id!, hours)).invitation} onRemove={async (member) => { await api.removeMember(trip.id!, member.id); await loadTrip(trip.id!) }} />{error && <p className="app-error">{error}</p>}</>
  return <><Dashboard trip={trip} user={currentUser} tripCount={trips.length} onChange={setTrip} onEdit={() => setScreen('setup')} onTrips={async () => { await refreshTrips(); setScreen('trips') }} onProfile={() => setScreen('profile')} onInvite={() => setInviteOpen(true)} onCityChange={(city) => void updateCity(city)} onDayDescriptionChange={(date, description) => { setTrip((current) => current ? { ...current, dayDescriptions: { ...current.dayDescriptions, [date]: description } } : current); if (!trip.id) return; void api.updateDayDescription(trip.id, date, description).catch((reason) => { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить описание дня'); void loadTrip(trip.id!) }) }} onAddPlace={(city, date, place) => void addPlace(city, date, place)} onUpdatePlace={(city, date, place) => void updatePlace(city, date, place)} onTrainUpload={uploadTrain} onHotelUpload={uploadHotel} onDocumentDelete={async (file) => { if (!trip.id) return; try { await api.deleteDocument(file.id); await loadTrip(trip.id) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось удалить файл'); throw reason } }} />{error && <p className="app-error">{error}</p>}</>
}
