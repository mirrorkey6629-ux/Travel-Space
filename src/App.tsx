import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiTripDetails, ApiTripSummary, session } from './api'
import { Button, IconButton } from './components/Button'
import { Input, Select } from './components/FormControls'
import { TypographyGroup } from './components/TypographyGroup'

type Place = { id: string; name: string; url: string }
type Task = { id: string; title: string; done: boolean }
type TravelFile = { id: string; name: string; category: string }
type TripMember = { id: string; email: string; displayName: string; role: 'owner' | 'member' }
type DayPeriod = 'morning' | 'day' | 'evening'
type City = {
  id: string
  name: string
  arrival: string
  departure: string
  arrivalPeriod?: DayPeriod
  departurePeriod?: DayPeriod
  hotel: string
  trainIn: string
  trainOut: string
  places: Record<string, Place[]>
  tasks: Task[]
  files: TravelFile[]
}
type Trip = { id?: string; role?: 'owner' | 'member'; name: string; startDate: string; endDate: string; cities: City[]; members?: TripMember[] }
type Screen = 'start' | 'login' | 'join' | 'trips' | 'setup' | 'dashboard'
export type IconName = 'link' | 'add-pin' | 'add-circle' | 'add-plus' | 'arrow-back' | 'attractions' | 'calendar-month' | 'time' | 'planet' | 'close' | 'edit-location' | 'pin-home' | 'image' | 'edit' | 'face' | 'key' | 'delete-forever' | 'file-export'

const STORAGE_KEY = 'tabi-trip-v1'
const UNSCHEDULED_KEY = 'unscheduled'
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
const cityDays = (city: City) => {
  const dateDays = daysBetween(city.arrival, city.departure)
  const arrivalPeriod = city.arrivalPeriod ?? 'morning'
  const departurePeriod = city.departurePeriod ?? 'evening'
  const duration = dateDays + periodDayPart[departurePeriod] - periodDayPart[arrivalPeriod]
  return Math.max(0, Math.round(duration * 2) / 2)
}
const formatDays = (value: number) => {
  if (!Number.isInteger(value)) return `${String(value).replace('.', ',')} дня`
  const mod100 = Math.abs(value) % 100
  const mod10 = mod100 % 10
  const word = mod100 >= 11 && mod100 <= 14 ? 'дней' : mod10 === 1 ? 'день' : mod10 >= 2 && mod10 <= 4 ? 'дня' : 'дней'
  return `${value} ${word}`
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

const fromApiTrip = (source: ApiTripDetails): Trip => {
  const cities = source.cities.map<City>((city) => {
    const places: Record<string, Place[]> = {}
    source.places.filter((place) => place.city_id === city.id).forEach((place) => {
      const key = place.visit_date?.slice(0, 10) || UNSCHEDULED_KEY
      ;(places[key] ??= []).push({ id: place.id, name: place.name, url: place.google_maps_url })
    })
    const documents = source.documents.filter((document) => document.city_id === city.id)
    const trainIn = documents.find((document) => document.category.startsWith('train-in:'))?.original_name || city.train_in
    const trainOut = documents.find((document) => document.category.startsWith('train-out:'))?.original_name || city.train_out
    return {
      id: city.id,
      name: city.name,
      arrival: city.arrival_date.slice(0, 10),
      departure: city.departure_date.slice(0, 10),
      arrivalPeriod: city.arrival_period,
      departurePeriod: city.departure_period,
      hotel: city.hotel,
      trainIn,
      trainOut,
      places,
      tasks: source.tasks.filter((task) => task.city_id === city.id).map((task) => ({ id: task.id, title: task.title, done: task.done })),
      files: documents.map((document) => ({ id: document.id, name: document.original_name, category: document.category })),
    }
  })
  return { id: source.id, role: source.role, name: source.name, startDate: source.start_date.slice(0, 10), endDate: source.end_date.slice(0, 10), cities, members: source.members.map((member) => ({ id: member.id, email: member.email, displayName: member.display_name, role: member.role })) }
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

function TripsScreen({ trips, onOpen, onCreate, onDelete, onExport, onImport }: { trips: ApiTripSummary[]; onOpen: (id: string) => void; onCreate: () => void; onDelete: (trip: ApiTripSummary) => void; onExport: (trip: ApiTripSummary) => Promise<void>; onImport: (file: File) => Promise<void> }) {
  const importRef = useRef<HTMLInputElement>(null)
  return (
    <main className="screen auth-screen trips-screen">
      <GalaxyBackground />
      <section className="glass trips-card">
        <header className="trips-header"><h1>Мои поездки</h1><div className="trips-header-actions"><button className="trip-import-trigger" onClick={() => importRef.current?.click()}>Импорт</button><input ref={importRef} className="hidden-file-input" type="file" accept=".travelspace,application/vnd.travel-space+json,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onImport(file); event.currentTarget.value = '' }} /></div></header>
        <div className="trips-list">
          {trips.map((item) => <article className="trip-list-row" key={item.id}>
            <button className="trip-list-main" onClick={() => onOpen(item.id)}><strong>{item.name}</strong><small>{item.role === 'owner' ? 'Владелец' : 'Гость'} · {formatLongRange(item.start_date.slice(0, 10), item.end_date.slice(0, 10))}</small></button>
            {item.role === 'owner' && <div className="trip-owner-actions"><IconButton icon={<Icon name="file-export" />} onClick={() => void onExport(item)} aria-label={`Экспортировать поездку ${item.name}`} title="Экспортировать" /><IconButton className="trip-delete-trigger" icon={<Icon name="delete-forever" />} onClick={() => onDelete(item)} aria-label={`Удалить поездку ${item.name}`} title="Удалить" /></div>}
          </article>)}
        </div>
        <IconButton className="trip-create-row" size="l" icon={<Icon name="add-plus" />} onClick={onCreate} aria-label="Создать ещё одну поездку" />
      </section>
    </main>
  )
}

function DeleteTripDialog({ trip, onClose, onConfirm }: { trip: ApiTripSummary; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  return <div className="overlay"><section className="glass modal destructive-dialog"><h2>Удалить «{trip.name}»?</h2><p>Поездка, города, места и документы будут удалены без возможности восстановления. Введите название поездки вручную:</p><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={trip.name} autoFocus /><div className="dialog-actions"><Button theme="secondary" size="m" onClick={onClose}>Отмена</Button><button className="danger" disabled={confirmation !== trip.name || busy} onClick={async () => { setBusy(true); try { await onConfirm() } finally { setBusy(false) } }}>{busy ? 'Удаляем…' : 'Удалить поездку'}</button></div></section></div>
}

function InviteDialog({ trip, onClose, onCreate, onRemove }: { trip: Trip; onClose: () => void; onCreate: (hours: number) => Promise<{ url: string; expiresAt: string }>; onRemove: (member: TripMember) => Promise<void> }) {
  const [hours, setHours] = useState(72)
  const [invite, setInvite] = useState<{ url: string; expiresAt: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<TripMember | null>(null)
  const guests = (trip.members ?? []).filter((member) => member.role === 'member')
  return <div className="overlay"><section className="glass modal invite-dialog"><h2>Участники «{trip.name}»</h2>{guests.length > 0 ? <div className="member-list">{guests.map((member) => <div className="member-row" key={member.id}><div><strong>{member.displayName}</strong><small>{member.email}</small></div>{removeTarget?.id === member.id ? <div className="member-confirm"><button onClick={() => setRemoveTarget(null)}>Отмена</button><button className="danger" onClick={async () => { await onRemove(member); setRemoveTarget(null) }}>Удалить</button></div> : <button className="member-remove" onClick={() => setRemoveTarget(member)}>Убрать</button>}</div>)}</div> : <p>Пока в поездке нет приглашённых друзей.</p>}<div className="invite-divider" /><h2>Ссылка-приглашение</h2><p>Новая ссылка сразу отключит предыдущую. Все вошедшие по ней станут гостями.</p><label className="field"><span>Срок действия</span><Select content="list" value={hours} onChange={(event) => setHours(Number(event.target.value))}><option value={24}>24 часа</option><option value={72}>3 дня</option><option value={168}>7 дней</option></Select></label>{invite && <div className="invite-result"><input readOnly value={invite.url} /><small>Действует до {new Date(invite.expiresAt).toLocaleString('ru-RU')}</small><button onClick={() => void navigator.clipboard.writeText(invite.url)}>Скопировать ссылку</button></div>}<div className="dialog-actions"><Button theme="secondary" size="m" onClick={onClose}>Закрыть</Button><Button size="m" disabled={busy} onClick={async () => { setBusy(true); try { setInvite(await onCreate(hours)) } finally { setBusy(false) } }}>{busy ? 'Создаём…' : invite ? 'Создать новую ссылку' : 'Создать ссылку'}</Button></div></section></div>
}

const emptyCity = (): City => ({ id: uid(), name: '', arrival: '', departure: '', arrivalPeriod: 'morning', departurePeriod: 'evening', hotel: '', trainIn: '', trainOut: '', places: {}, tasks: [], files: [] })

function CityEditor({ trip, initial, onSave, onClose }: { trip: Trip; initial?: City; onSave: (city: City) => void; onClose: () => void }) {
  const [city, setCity] = useState<City>(() => initial ? { ...initial, arrivalPeriod: initial.arrivalPeriod ?? 'morning', departurePeriod: initial.departurePeriod ?? 'evening' } : emptyCity())
  const sameDayPeriodsValid = city.arrival !== city.departure || periodOrder[city.departurePeriod ?? 'evening'] >= periodOrder[city.arrivalPeriod ?? 'morning']
  const valid = city.name.trim() && city.arrival && city.departure && city.departure >= city.arrival && sameDayPeriodsValid
  const tripDates = dateRange(trip.startDate, trip.endDate)
  const departureDates = tripDates.filter((date) => !city.arrival || date >= city.arrival)
  return (
    <form className="city-editor-view setup-transition" onSubmit={(event) => { event.preventDefault(); if (valid) onSave(city) }}>
      <div className="modal-title">
        <div>{!initial && <span className="eyebrow">Новая локация</span>}<h2>{initial ? city.name : 'Добавить город'}</h2></div>
        <IconButton type="button" icon={<Icon name="close" />} onClick={onClose} aria-label="Закрыть" />
      </div>
      <div className="field-grid">
        <label className="field span-2"><span>Город</span><Input value={city.name} onChange={(e) => setCity({ ...city, name: e.target.value })} placeholder="Например, Осака" autoFocus /></label>
        <label className="field"><span>Прибытие</span><div className="date-time-fields"><Select content="date" icon={<Icon name="calendar-month" />} value={city.arrival} onChange={(e) => { const value = e.target.value; setCity((current) => ({ ...current, arrival: value, departure: current.departure < value ? '' : current.departure })) }}><option value="">Выберите дату</option>{tripDates.map((date) => <option key={date} value={date}>{formatDate(date)} · {ruWeekdays[parseDate(date).getDay()]}</option>)}</Select><Select content="list" icon={<Icon name="time" />} aria-label="Время прибытия" value={city.arrivalPeriod ?? 'morning'} onChange={(e) => setCity((current) => ({ ...current, arrivalPeriod: e.target.value as DayPeriod }))}><option value="morning">Утро</option><option value="day">День</option><option value="evening">Вечер</option></Select></div></label>
        <label className="field"><span>Отъезд</span><div className="date-time-fields"><Select content="date" icon={<Icon name="calendar-month" />} value={city.departure} disabled={!city.arrival} onChange={(e) => setCity((current) => ({ ...current, departure: e.target.value }))}><option value="">Выберите дату</option>{departureDates.map((date) => <option key={date} value={date}>{formatDate(date)} · {ruWeekdays[parseDate(date).getDay()]}</option>)}</Select><Select content="list" icon={<Icon name="time" />} aria-label="Время отъезда" value={city.departurePeriod ?? 'evening'} onChange={(e) => setCity((current) => ({ ...current, departurePeriod: e.target.value as DayPeriod }))}><option value="morning">Утро</option><option value="day">День</option><option value="evening">Вечер</option></Select></div></label>
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
  const [trip, setTrip] = useState<Trip>(initial ?? { name: '', startDate: '', endDate: '', cities: [] })
  const [editing, setEditing] = useState<City | null | undefined>(undefined)
  const [editingAll, setEditingAll] = useState(false)
  const startDateRef = useRef<HTMLInputElement>(null)
  const endDateRef = useRef<HTMLInputElement>(null)
  const datesValid = trip.startDate && trip.endDate && trip.endDate >= trip.startDate
  const tripDays = datesValid ? daysBetween(trip.startDate, trip.endDate) : 0
  const openDatePicker = (ref: React.RefObject<HTMLInputElement | null>) => {
    const input = ref.current
    if (!input) return
    input.focus()
    try { input.showPicker() } catch { input.click() }
  }
  const upsertCity = (city: City) => {
    const exists = trip.cities.some((item) => item.id === city.id)
    const cities = exists ? trip.cities.map((item) => item.id === city.id ? city : item) : [...trip.cities, city]
    setTrip({ ...trip, cities: cities.sort((a, b) => a.arrival.localeCompare(b.arrival)) })
    setEditing(undefined)
  }
  return (
    <main className="screen trip-background setup-screen">
      <IconButton className="back-button" size="l" icon={<Icon name="arrow-back" />} onClick={onExit} aria-label="Назад" />
      <section className={`glass setup-card${editingAll ? ' editing-all' : ''}`}>
        {editingAll ? (
          <AllCitiesEditor trip={trip} onClose={() => setEditingAll(false)} onSave={(cities) => { setTrip((current) => ({ ...current, cities: [...cities].sort((a, b) => a.arrival.localeCompare(b.arrival)) })); setEditingAll(false) }} />
        ) : editing !== undefined ? (
          <CityEditor trip={trip} initial={editing ?? undefined} onSave={upsertCity} onClose={() => setEditing(undefined)} />
        ) : (
          <div className="setup-content setup-transition">
            {trip.cities.length > 0 && <IconButton type="button" className="bulk-edit-button" icon={<Icon name="edit" />} onClick={() => setEditingAll(true)} aria-label="Редактировать все города" />}
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
            <div className="city-editor-group">
              {trip.cities.length > 0 && <div className="city-list setup-list">{trip.cities.map((city) => <button className="city-row" key={city.id} onClick={() => setEditing(city)}><strong>{city.name}</strong><span>{formatShortRange(city.arrival, city.departure)}</span><span>{formatDays(cityDays(city))}</span></button>)}</div>}
              <IconButton className="add-city" size="l" icon={<Icon name="add-plus" />} disabled={!datesValid} onClick={() => setEditing(null)} aria-label="Добавить город" />
            </div>
            {trip.cities.length > 0 && <Button disabled={!trip.name.trim()} onClick={() => onCreate(trip)}>{initial ? 'Сохранить' : 'Создать'}</Button>}
          </div>
        )}
      </section>
    </main>
  )
}

function DocumentStatus({ checked, children }: { checked: boolean; children: React.ReactNode }) {
  return <p className="document-row"><span className={`document-check${checked ? ' checked' : ''}`} role="checkbox" aria-checked={checked} />{children}</p>
}

function TripSidebar({ trip, selectedCityId, onCity, onEdit }: { trip: Trip; selectedCityId?: string | null; onCity: (city: City) => void; onEdit: () => void }) {
  const daysLeft = Math.ceil((parseDate(trip.startDate).getTime() - new Date().getTime()) / 86400000)
  return (
    <aside className="sidebar">
      <section className="glass sidebar-card trip-summary">
        <TypographyGroup title={trip.name} text={<>{formatLongRange(trip.startDate, trip.endDate)} · {formatDays(daysBetween(trip.startDate, trip.endDate) + 1)}</>} />
        <div className="city-list">{trip.cities.map((city) => <button className={`city-row${city.id === selectedCityId ? ' selected' : ''}`} key={city.id} aria-current={city.id === selectedCityId ? 'true' : undefined} onClick={() => onCity(city)}><strong>{city.id === selectedCityId && '📌 '}{city.name}</strong><span>{formatShortRange(city.arrival, city.departure)}</span><span>{formatDays(cityDays(city))}</span></button>)}</div>
        {trip.role === 'owner' && <Button className="edit-trip" onClick={onEdit}>Редактировать</Button>}
        <p className="countdown">{daysLeft > 0 ? `🎉 Едем через ${formatDays(daysLeft)}` : daysLeft === 0 ? '🎉 Поездка начинается сегодня' : '🎉 Путешествие уже началось'}</p>
      </section>
      <section className="glass sidebar-card links-card">
        <h3>✈️ Самолёты <IconButton type="button" size="s" icon={<Icon name="add-plus" size={16} />} aria-label="Добавить билеты" /></h3>
        <DocumentStatus checked={false}>Билеты туда</DocumentStatus>
        <DocumentStatus checked={false}>Билеты обратно</DocumentStatus>
        <div className="divider" />
        <h3>🏨 Отели <IconButton type="button" size="s" icon={<Icon name="add-plus" size={16} />} aria-label="Добавить бронь отеля" /></h3>
        {trip.cities.map((city) => <DocumentStatus key={city.id} checked={Boolean(city.hotel)}>{city.name}</DocumentStatus>)}
        <div className="divider" />
        <h3>🚅 Поезда <IconButton type="button" size="s" icon={<Icon name="add-plus" size={16} />} aria-label="Добавить билеты на поезд" /></h3>
        {trip.cities.slice(0, -1).map((city, index) => <DocumentStatus key={city.id} checked={Boolean(city.trainOut || trip.cities[index + 1].trainIn)}>{city.name} — {trip.cities[index + 1].name}</DocumentStatus>)}
      </section>
    </aside>
  )
}

function DayCard({ date, cities, hidden }: { date: string; cities: City[]; hidden: boolean }) {
  const day = parseDate(date)
  return (
    <article className={`glass day-card${hidden ? ' past' : ''}`}>
      <header><strong>{day.getDate()} {ruMonths[day.getMonth()].slice(0, 3)}</strong><span>{ruWeekdays[day.getDay()]}</span></header>
      <div className="day-content">
        {cities.map((city) => <TypographyGroup className="day-city" variant="head-m-text" headingLevel="h3" key={city.id} title={city.name} text={date === city.arrival ? 'Прибытие' : date === city.departure ? 'Отъезд' : 'День в городе'} />)}
        {cities.length === 0 && <p className="empty-text">Свободный день — добавьте город или переезд</p>}
      </div>
    </article>
  )
}

function CityPanel({ city, previousCity, nextCity, onChange, onAddPlace, onTrainChange, onClose }: { city: City; previousCity?: City; nextCity?: City; onChange: (city: City) => void; onAddPlace: (city: City, date: string, place: Place) => void; onTrainChange: (city: City, direction: 'in' | 'out', file: TravelFile, source: File) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(city)
  const [place, setPlace] = useState('')
  const [placeUrl, setPlaceUrl] = useState('')
  const [selectedDate, setSelectedDate] = useState(dateRange(city.arrival, city.departure)[0])
  const hotelInputRef = useRef<HTMLInputElement>(null)
  const trainInFileRef = useRef<HTMLInputElement>(null)
  const trainOutFileRef = useRef<HTMLInputElement>(null)
  const addPlace = (event: FormEvent) => {
    event.preventDefault()
    if (!place.trim()) return
    const next = { ...draft, places: { ...draft.places, [selectedDate]: [...(draft.places[selectedDate] ?? []), { id: uid(), name: place.trim(), url: placeUrl.trim() }] } }
    setDraft(next); onAddPlace(next, selectedDate, next.places[selectedDate].at(-1)!); setPlace(''); setPlaceUrl('')
  }
  const addTrainFile = (files: FileList | null, direction: 'in' | 'out') => {
    const file = files?.[0]
    if (!file) return
    const fileRecord = { id: uid(), name: file.name, category: direction === 'in' ? 'Поезд сюда' : 'Поезд дальше' }
    const next = { ...draft, [direction === 'in' ? 'trainIn' : 'trainOut']: file.name, files: [...draft.files, fileRecord] }
    setDraft(next)
    onTrainChange(next, direction, fileRecord, file)
  }
  const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(draft.name)}&z=12&output=embed`
  return (
      <section className="glass city-page-card setup-transition">
        <div className="city-compact-header">
          <IconButton type="button" className="city-inline-back" icon={<Icon name="arrow-back" />} onClick={onClose} aria-label="Назад" />
          <TypographyGroup className="city-compact-copy" title={draft.name} text={<>{formatLongRange(draft.arrival, draft.departure)} · {formatDays(cityDays(draft))}</>} />
        </div>
        <div className="info-strip">
          <div className="info-field"><div className="info-copy"><b>🏨 Твой отель</b><input ref={hotelInputRef} placeholder="Где будем жить" value={draft.hotel} onChange={(e) => setDraft({ ...draft, hotel: e.target.value })} onBlur={() => onChange(draft)} /></div><IconButton type="button" icon={<Icon name="add-plus" size={20} />} onClick={() => hotelInputRef.current?.focus()} aria-label="Добавить отель" /></div>
          <div className="info-field"><div className="info-copy"><b>🚅 {previousCity ? `${previousCity.name} — ${draft.name}` : 'Поезд сюда'}</b><input readOnly placeholder="Прикрепить билет" value={draft.trainIn} /></div><IconButton type="button" icon={<Icon name={draft.trainIn ? 'edit' : 'add-plus'} size={20} />} onClick={() => trainInFileRef.current?.click()} aria-label={draft.trainIn ? 'Заменить билет на поезд сюда' : 'Прикрепить билет на поезд сюда'} /><input ref={trainInFileRef} className="hidden-file-input" type="file" onChange={(e) => addTrainFile(e.target.files, 'in')} /></div>
          <div className="info-field"><div className="info-copy"><b>🚅 {nextCity ? `${draft.name} — ${nextCity.name}` : 'Поезд дальше'}</b><input readOnly placeholder="Прикрепить билет" value={draft.trainOut} /></div><IconButton type="button" icon={<Icon name={draft.trainOut ? 'edit' : 'add-plus'} size={20} />} onClick={() => trainOutFileRef.current?.click()} aria-label={draft.trainOut ? 'Заменить билет на поезд дальше' : 'Прикрепить билет на поезд дальше'} /><input ref={trainOutFileRef} className="hidden-file-input" type="file" onChange={(e) => addTrainFile(e.target.files, 'out')} /></div>
        </div>
        <div className="city-main">
          <div className="city-days">
            <div className="city-day unscheduled-day"><h3>Без даты</h3>{(draft.places[UNSCHEDULED_KEY] ?? []).map((item, index) => <a key={item.id} href={item.url || undefined} target="_blank" rel="noreferrer">{index + 1}. {item.name}</a>)}</div>
            {dateRange(draft.arrival, draft.departure).map((date) => <div className="city-day" key={date}><h3>{formatDate(date)}</h3>{(draft.places[date] ?? []).map((item, index) => <a key={item.id} href={item.url || undefined} target="_blank" rel="noreferrer">{index + 1}. {item.name}</a>)}</div>)}
          </div>
          <div className="city-route-content">
            <div className="city-map">
              <iframe title={`Карта города ${draft.name}`} src={mapUrl} loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />
            </div>
            <form className="route-form" onSubmit={addPlace}>
              <Select content="date" icon={<Icon name="calendar-month" />} aria-label="Дата посещения" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}><option value={UNSCHEDULED_KEY}>Без даты</option>{dateRange(draft.arrival, draft.departure).map((date) => <option key={date} value={date}>{formatDate(date)}</option>)}</Select>
              <Input icon={<Icon name="attractions" />} aria-label="Название места" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Название места" />
              <Input icon={<Icon name="add-pin" />} controlClassName="map-link-input" aria-label="Ссылка Google Maps" value={placeUrl} onChange={(e) => setPlaceUrl(e.target.value)} placeholder="Ссылка Google Maps" />
              <Button>Добавить точку</Button>
            </form>
          </div>
        </div>
      </section>
  )
}

function Dashboard({ trip, onChange, onEdit, onTrips, onInvite, onCityChange, onAddPlace, onTrainUpload }: { trip: Trip; onChange: (trip: Trip) => void; onEdit: () => void; onTrips: () => void; onInvite: () => void; onCityChange: (city: City) => void; onAddPlace: (city: City, date: string, place: Place) => void; onTrainUpload: (city: City, direction: 'in' | 'out', file: File) => void }) {
  const [showPast, setShowPast] = useState(false)
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null)
  const today = isoDate(new Date())
  const allDays = dateRange(trip.startDate, trip.endDate)
  const visibleDays = showPast ? allDays : allDays.filter((date) => date >= today)
  const selectedCity = trip.cities.find((city) => city.id === selectedCityId) ?? null
  const selectedCityIndex = selectedCity ? trip.cities.findIndex((city) => city.id === selectedCity.id) : -1
  return (
    <main className="screen trip-background dashboard">
      <nav className="dashboard-tools"><button onClick={onTrips}>Поездки</button>{trip.role === 'owner' && <button onClick={onInvite}>Пригласить</button>}</nav>
      <TripSidebar trip={trip} selectedCityId={selectedCityId} onCity={(city) => setSelectedCityId(city.id)} onEdit={onEdit} />
      <section className={`calendar-column${selectedCity ? ' city-active' : ''}`}>
        {selectedCity ? (
          <CityPanel
            key={selectedCity.id}
            city={selectedCity}
            previousCity={trip.cities[selectedCityIndex - 1]}
            nextCity={trip.cities[selectedCityIndex + 1]}
            onClose={() => setSelectedCityId(null)}
            onChange={(nextCity) => { onChange({ ...trip, cities: trip.cities.map((city) => city.id === nextCity.id ? nextCity : city) }); onCityChange(nextCity) }}
            onAddPlace={(nextCity, date, place) => { onChange({ ...trip, cities: trip.cities.map((city) => city.id === nextCity.id ? nextCity : city) }); onAddPlace(nextCity, date, place) }}
            onTrainChange={(nextCity, direction, file, source) => {
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
              onTrainUpload(nextCity, direction, source)
            }}
          />
        ) : (
          <div className="calendar-content setup-transition">
            {allDays.some((date) => date < today) && <button className="past-toggle" onClick={() => setShowPast(!showPast)}>{showPast ? 'Скрыть прошедшие дни' : 'Показать прошедшие дни'}</button>}
            {visibleDays.map((date) => <DayCard key={date} date={date} cities={trip.cities.filter((city) => date >= city.arrival && date <= city.departure)} hidden={date < today} />)}
            {visibleDays.length === 0 && <article className="glass empty-calendar"><h2>Все дни уже прошли</h2><Button onClick={() => setShowPast(true)}>Показать поездку</Button></article>}
          </div>
        )}
      </section>
    </main>
  )
}

export default function App() {
  const invitationLink = window.location.pathname.includes('/join/') ? window.location.href : ''
  const legacyTrip = useRef<Trip | null>((() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') } catch { return null }
  })())
  const [trip, setTrip] = useState<Trip | null>(null)
  const [trips, setTrips] = useState<ApiTripSummary[]>([])
  const [screen, setScreen] = useState<Screen>(invitationLink ? 'join' : 'start')
  const [loading, setLoading] = useState(Boolean(session.token))
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ApiTripSummary | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  useEffect(() => {
    if (!session.token) return
    if (invitationLink) {
      const token = invitationLink.split('/join/').at(-1)?.trim()
      if (token) {
        void api.acceptInvitation(token).then(async ({ tripId }) => {
          window.history.replaceState({}, '', '/')
          await refreshTrips(); await loadTrip(tripId); setScreen('dashboard'); setLoading(false)
        }).catch((reason) => { setError(reason instanceof Error ? reason.message : 'Не удалось принять приглашение'); setLoading(false) })
        return
      }
    }
    void openAccount().catch(() => { session.token = ''; setLoading(false) })
  }, [])

  const loadTrip = async (id: string) => {
    const result = await api.trip(id)
    const value = fromApiTrip(result.trip)
    setTrip(value)
    return value
  }

  const refreshTrips = async () => {
    const result = await api.trips()
    setTrips(result.trips)
    return result.trips
  }

  const createFromDraft = async (draft: Trip) => {
    const created = await api.createTrip({ name: draft.name, startDate: draft.startDate, endDate: draft.endDate })
    const cityIds = new Map<string, string>()
    for (const [position, city] of draft.cities.entries()) {
      const result = await api.createCity(created.trip.id, {
        name: city.name, position, arrivalDate: city.arrival, departureDate: city.departure,
        arrivalPeriod: city.arrivalPeriod, departurePeriod: city.departurePeriod, hotel: city.hotel,
      })
      cityIds.set(city.id, result.city.id)
      if (city.hotel) await api.updateCity(created.trip.id, result.city.id, { hotel: city.hotel })
      for (const [date, places] of Object.entries(city.places)) {
        for (const place of places) await api.createPlace(created.trip.id, result.city.id, { name: place.name, googleMapsUrl: place.url, ...(date === UNSCHEDULED_KEY ? {} : { visitDate: date }) })
      }
      for (const task of city.tasks) await api.createTask(created.trip.id, { cityId: result.city.id, title: task.title })
    }
    localStorage.removeItem(STORAGE_KEY)
    await refreshTrips()
    return loadTrip(created.trip.id)
  }

  const openAccount = async () => {
    setLoading(true); setError('')
    try {
      await api.me()
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
        await api.updateTrip(draft.id, { name: draft.name, startDate: draft.startDate, endDate: draft.endDate })
        const remote = (await api.trip(draft.id)).trip
        const existingIds = new Set(remote.cities.map((city) => city.id))
        for (const [position, city] of draft.cities.entries()) {
          const payload = { name: city.name, position, arrivalDate: city.arrival, departureDate: city.departure, arrivalPeriod: city.arrivalPeriod, departurePeriod: city.departurePeriod, hotel: city.hotel }
          if (existingIds.has(city.id)) await api.updateCity(draft.id, city.id, payload)
          else await api.createCity(draft.id, payload)
        }
        await loadTrip(draft.id)
      }
      setScreen('dashboard')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить') }
  }

  const updateCity = async (city: City) => {
    if (!trip?.id) return
    try { await api.updateCity(trip.id, city.id, { name: city.name, arrivalDate: city.arrival, departureDate: city.departure, arrivalPeriod: city.arrivalPeriod, departurePeriod: city.departurePeriod, hotel: city.hotel }) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Ошибка сохранения') }
  }

  const addPlace = async (city: City, date: string, place: Place) => {
    if (!trip?.id) return
    try {
      await api.createPlace(trip.id, city.id, { name: place.name, googleMapsUrl: place.url, ...(date === UNSCHEDULED_KEY ? {} : { visitDate: date }) })
      await loadTrip(trip.id)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ошибка добавления места') }
  }

  const uploadTrain = async (city: City, direction: 'in' | 'out', file: File) => {
    if (!trip?.id) return
    const index = trip.cities.findIndex((item) => item.id === city.id)
    const linked = direction === 'in' ? trip.cities[index - 1] : trip.cities[index + 1]
    const from = direction === 'in' ? linked : city
    const to = direction === 'in' ? city : linked
    if (!from || !to) return
    try {
      await api.uploadDocument(trip.id, city.id, `${direction === 'in' ? 'train-in' : 'train-out'}:${from.id}:${to.id}`, file)
      await api.uploadDocument(trip.id, linked.id, `${direction === 'in' ? 'train-out' : 'train-in'}:${from.id}:${to.id}`, file)
      await loadTrip(trip.id)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ошибка загрузки файла') }
  }

  const joinTrip = async (link: string, name: string, email: string, password: string, mode: 'login' | 'register') => {
    const token = link.split('/join/').at(-1)?.trim()
    if (!token) { setError('Неверная ссылка'); return }
    try {
      const auth = mode === 'register' ? await api.register(email, password, name) : await api.login(email, password)
      session.token = auth.token
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
  if (screen === 'trips') return <><TripsScreen trips={trips} onOpen={(id) => { void loadTrip(id).then(() => setScreen('dashboard')) }} onCreate={() => { setTrip(null); setScreen('setup') }} onDelete={setDeleteTarget} onExport={async (item) => { try { const blob = await api.exportTrip(item.id); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${item.name}.travelspace`; anchor.click(); URL.revokeObjectURL(url) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось экспортировать поездку') } }} onImport={async (file) => { try { const result = await api.importTrip(file); await refreshTrips(); await loadTrip(result.trip.id); setScreen('dashboard') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось импортировать поездку') } }} />{deleteTarget && <DeleteTripDialog trip={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={async () => { await api.deleteTrip(deleteTarget.id, deleteTarget.name); setDeleteTarget(null); const remaining = await refreshTrips(); if (remaining.length === 1) { await loadTrip(remaining[0].id); setScreen('dashboard') } }} />}{error && <p className="app-error">{error}</p>}</>
  if (screen === 'setup') return <><SetupScreen initial={trip} onExit={() => setScreen(trip ? 'dashboard' : trips.length ? 'trips' : 'start')} onCreate={(value) => void saveTrip(value)} />{error && <p className="app-error">{error}</p>}</>
  if (!trip) return null
  return <><Dashboard trip={trip} onChange={setTrip} onEdit={() => setScreen('setup')} onTrips={async () => { await refreshTrips(); setScreen('trips') }} onInvite={() => setInviteOpen(true)} onCityChange={(city) => void updateCity(city)} onAddPlace={(city, date, place) => void addPlace(city, date, place)} onTrainUpload={(city, direction, file) => void uploadTrain(city, direction, file)} />{inviteOpen && <InviteDialog trip={trip} onClose={() => setInviteOpen(false)} onCreate={async (hours) => (await api.createInvitation(trip.id!, hours)).invitation} onRemove={async (member) => { await api.removeMember(trip.id!, member.id); await loadTrip(trip.id!) }} />}{error && <p className="app-error">{error}</p>}</>
}
