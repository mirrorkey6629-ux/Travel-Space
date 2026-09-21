import { useEffect, useMemo, useRef, useState } from 'react'
import { MapOverlay } from './MapOverlay'
import { MapSearch, type SearchResult } from './MapSearch'
import { PlacePopup } from './PlacePopup'
import { iconForGoogleTypes, placeIconUrl, type PlaceIconKey } from '../placeIcons'
import { UNSCHEDULED_KEY, placeMapsHref, type PlaceDraft } from '../places'

type Coordinates = { lat: number; lng: number }

export type MapPlace = {
  id: string
  name: string
  url: string
  icon: PlaceIconKey
  date: string
  latitude?: number
  longitude?: number
  dateLocked?: boolean
}

let mapsPromise: Promise<any> | null = null
const geocodeCache = new Map<string, Coordinates | null>()

function loadMaps(key: string) {
  const existing = (window as any).google?.maps
  if (existing) return Promise.resolve(existing)
  if (!mapsPromise) mapsPromise = new Promise((resolve, reject) => {
    const callback = `travelMapsReady${Date.now()}`
    ;(window as any)[callback] = () => { resolve((window as any).google.maps); delete (window as any)[callback] }
    const script = document.createElement('script')
    // libraries обязателен: без marker не будет AdvancedMarkerElement, без places — поиска.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places,marker&callback=${callback}&v=weekly`
    script.async = true
    script.onerror = () => reject(new Error('Не удалось загрузить Google Maps'))
    document.head.appendChild(script)
  })
  return mapsPromise
}

function geocodeOnce(geocoder: any, address: string): Promise<Coordinates | null> {
  const normalized = address.trim().toLocaleLowerCase()
  if (!normalized) return Promise.resolve(null)
  if (geocodeCache.has(normalized)) return Promise.resolve(geocodeCache.get(normalized) ?? null)
  return new Promise((resolve) => {
    geocoder.geocode({ address }, (results: any[], status: string) => {
      const location = status === 'OK' ? results?.[0]?.geometry?.location : null
      const coordinates = location ? { lat: location.lat(), lng: location.lng() } : null
      geocodeCache.set(normalized, coordinates)
      resolve(coordinates)
    })
  })
}

function coordinatesFromMapsUrl(value: string): Coordinates | null {
  let decoded = value.trim()
  try { decoded = decodeURIComponent(decoded) } catch { /* Оставляем исходную ссылку. */ }
  const match = decoded.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ?? decoded.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (!match) return null
  const lat = Number(match[1])
  const lng = Number(match[2])
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null
}

function addressFromMapsUrl(value: string): string {
  try {
    const url = new URL(value)
    const query = url.searchParams.get('q') || url.searchParams.get('query')
    if (query && !coordinatesFromMapsUrl(value)) return query
    const place = url.pathname.match(/\/place\/([^/]+)/)?.[1]
    return place ? decodeURIComponent(place).replace(/\+/g, ' ') : ''
  } catch {
    return ''
  }
}

function markerContent(icon: PlaceIconKey, dimmed: boolean, draft = false) {
  const element = document.createElement('div')
  element.className = `place-marker${draft ? ' place-marker-draft' : ''}${dimmed ? ' is-dimmed' : ''}`
  const image = document.createElement('img')
  image.className = 'ui-icon'
  image.width = 24
  image.height = 24
  image.alt = ''
  image.src = draft ? `${import.meta.env.BASE_URL}assets/icons/add-pin.svg` : placeIconUrl(icon)
  element.appendChild(image)
  return element
}

export function PlacesMap({ query, centerUrl = '', places, dates, activeDate, readOnly, formatDate, onAdd, onUpdate, onDelete, onResolvePlace, focusRequest, onFocusHandled }: {
  query: string
  centerUrl?: string
  places: MapPlace[]
  dates: string[]
  activeDate: string | null
  readOnly?: boolean
  formatDate: (value: string) => string
  onAdd: (value: { name: string; icon: PlaceIconKey; date: string; position: Coordinates }) => void
  onUpdate: (id: string, value: { name: string; icon: PlaceIconKey; date: string }) => void
  onDelete: (id: string) => void
  onResolvePlace?: (id: string, coordinates: Coordinates) => void
  focusRequest?: string | null
  onFocusHandled?: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const mapsRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [mapsReady, setMapsReady] = useState(false)
  const [draftPosition, setDraftPosition] = useState<Coordinates | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<PlaceDraft | null>(null)
  const [editing, setEditing] = useState(false)
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
  const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined

  const selected = places.find((place) => place.id === selectedId) ?? null
  const firstKnown = places.find((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude))
  const initialCoordinates = firstKnown ? { lat: firstKnown.latitude!, lng: firstKnown.longitude! } : undefined
  const placesSignature = useMemo(
    () => JSON.stringify(places.map(({ id, name, icon, date, latitude, longitude }) => [id, name, icon, date, latitude, longitude])),
    [places],
  )

  const callbacks = useRef({ onAdd, onUpdate, onDelete, onResolvePlace, onFocusHandled })
  useEffect(() => { callbacks.current = { onAdd, onUpdate, onDelete, onResolvePlace, onFocusHandled } })

  const closePopup = () => { setDraftPosition(null); setSelectedId(null); setDraft(null); setEditing(false) }

  useEffect(() => {
    if (!key || !containerRef.current) return
    let active = true
    void loadMaps(key).then((maps) => {
      if (!active || !containerRef.current || mapRef.current) return
      mapsRef.current = maps
      mapRef.current = new maps.Map(containerRef.current, {
        center: initialCoordinates ?? { lat: 34.6937, lng: 135.5023 },
        zoom: initialCoordinates ? 13 : 11,
        mapTypeControl: false,
        streetViewControl: false,
        // mapId обязателен: без него AdvancedMarkerElement молча не отрисуется.
        mapId,
      })
      setMapsReady(true)
    }).catch(() => undefined)
    return () => { active = false }
  }, [key])

  // Ссылка города задаёт исходный центр независимо от наличия точек маршрута.
  // В полной ссылке Google Maps координаты обычно лежат после `@`; если их нет,
  // геокодируем название места из ссылки, а для короткой ссылки используем город.
  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (!maps || !map) return
    const direct = coordinatesFromMapsUrl(centerUrl)
    if (direct) {
      map.panTo(direct)
      map.setZoom(12)
      return
    }
    const address = addressFromMapsUrl(centerUrl) || query
    if (!address.trim()) return
    let active = true
    void geocodeOnce(new maps.Geocoder(), address).then((coordinates) => {
      if (!active || !coordinates) return
      map.panTo(coordinates)
      map.setZoom(12)
    })
    return () => { active = false }
  }, [mapsReady, centerUrl, query])

  // Клик по пустому месту карты ставит черновой пин, повторный клик его переставляет.
  useEffect(() => {
    const map = mapRef.current
    if (!map || readOnly) return
    const listener = map.addListener('click', (event: any) => {
      // У кликов по элементам поверх карты latLng отсутствует — такой клик не наш.
      if (!event.latLng) return
      setSelectedId(null)
      setEditing(false)
      setDraft(null)
      setDraftPosition({ lat: event.latLng.lat(), lng: event.latLng.lng() })
    })
    return () => listener.remove()
  }, [mapsReady, readOnly])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') closePopup() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Маркеры точек. Пересобираются целиком: их десятки, а не тысячи,
  // и полная пересборка проще и надёжнее точечной синхронизации.
  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (!maps || !map) return
    let active = true
    markersRef.current.forEach((marker) => { marker.map = null })
    markersRef.current = []
    const geocoder = new maps.Geocoder()

    const render = (place: MapPlace, coordinates: Coordinates) => {
      if (!active) return
      const dimmed = activeDate !== null && place.date !== activeDate
      const marker = new maps.marker.AdvancedMarkerElement({
        map,
        position: coordinates,
        // title не задаём: браузер рисует по нему свой чёрный системный тултип,
        // который дублирует попап и перекрывает соседние точки.
        content: markerContent(place.icon, dimmed),
        // Без gmpClickable маркер с собственным content не генерирует событий клика.
        gmpClickable: true,
      })
      marker.addListener('gmp-click', () => {
        setDraftPosition(null)
        setEditing(false)
        setDraft(null)
        setSelectedId(place.id)
      })
      markersRef.current.push(marker)
    }

    places.forEach((place) => {
      if (Number.isFinite(place.latitude) && Number.isFinite(place.longitude)) {
        render(place, { lat: place.latitude!, lng: place.longitude! })
        return
      }
      // Старые точки сохранялись без координат — доразрешаем их по названию.
      void geocodeOnce(geocoder, place.name).then((coordinates) => {
        if (!coordinates) return
        render(place, coordinates)
        callbacks.current.onResolvePlace?.(place.id, coordinates)
      })
    })
    return () => { active = false }
  }, [mapsReady, placesSignature, activeDate])

  // Черновой пин — тот же AdvancedMarkerElement, но с иконкой add-pin.
  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (!maps || !map || !draftPosition) return
    const marker = new maps.marker.AdvancedMarkerElement({
      map,
      position: draftPosition,
      content: markerContent('default', false, true),
      gmpClickable: true,
    })
    marker.addListener('gmp-click', () => {
      setDraft((current) => current ?? { name: '', icon: 'default', date: activeDate ?? UNSCHEDULED_KEY })
      setEditing(true)
    })
    return () => { marker.map = null }
  }, [mapsReady, draftPosition, activeDate])

  // Центрирование на точке, выбранной в списке слева.
  //
  // Выбор точки намеренно не требует карты: оффлайн Google Maps не загрузится,
  // но посмотреть место и уйти в приложение карт по-прежнему нужно. Поэтому
  // отсутствие карты отменяет только панорамирование, а не сам выбор — и
  // onFocusHandled зовётся всегда, иначе focusRequest залипал бы навсегда.
  useEffect(() => {
    if (!focusRequest) return
    const place = places.find((item) => item.id === focusRequest)
    if (place) {
      const map = mapRef.current
      if (map && Number.isFinite(place.latitude) && Number.isFinite(place.longitude)) {
        map.panTo({ lat: place.latitude!, lng: place.longitude! })
        map.setZoom(Math.max(map.getZoom() ?? 15, 15))
      }
      setDraftPosition(null)
      setEditing(false)
      setDraft(null)
      setSelectedId(place.id)
    }
    callbacks.current.onFocusHandled?.()
  }, [focusRequest, placesSignature, mapsReady])

  const pickSearchResult = (result: SearchResult) => {
    const map = mapRef.current
    map?.panTo(result.position)
    map?.setZoom(16)
    setSelectedId(null)
    setDraftPosition(result.position)
    setDraft({ name: result.name, icon: iconForGoogleTypes(result.types), date: activeDate ?? UNSCHEDULED_KEY })
    setEditing(true)
  }

  const saveDraft = () => {
    if (!draft || !draft.name.trim()) return
    if (selected) callbacks.current.onUpdate(selected.id, { ...draft, name: draft.name.trim() })
    else if (draftPosition) callbacks.current.onAdd({ ...draft, name: draft.name.trim(), position: draftPosition })
    closePopup()
  }

  if (!key) return <iframe title={`Карта: ${query}`} src={`https://www.google.com/maps?q=${encodeURIComponent(addressFromMapsUrl(centerUrl) || query)}&z=12&output=embed`} loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />

  const popupPosition = selected && Number.isFinite(selected.latitude) && Number.isFinite(selected.longitude)
    ? { lat: selected.latitude!, lng: selected.longitude! }
    : draftPosition
  const popupDraft = editing
    ? draft
    : selected
      ? { name: selected.name, icon: selected.icon, date: selected.date }
      : null

  return (
    <div className="places-map">
      <div ref={containerRef} className="google-map-picker" aria-label="Карта точек" />
      {/* Оффлайн Google Maps не загружается. Пустой прямоугольник выглядел бы
          поломкой, поэтому область карты прямо говорит, что происходит. */}
      {!mapsReady && <p className="places-map-fallback">Карта недоступна без интернета</p>}
      {!readOnly && mapsReady && <MapSearch maps={mapsRef.current} map={mapRef.current} onPick={pickSearchResult} />}
      {mapsReady && popupPosition && popupDraft && (
        <MapOverlay maps={mapsRef.current} map={mapRef.current} position={popupPosition}>
          <PlacePopup
            mode={editing ? 'edit' : 'view'}
            draft={popupDraft}
            dates={dates}
            formatDate={formatDate}
            readOnly={readOnly}
            dateLocked={selected?.dateLocked}
            mapsUrl={selected ? placeMapsHref(selected) || undefined : undefined}
            onEdit={() => { setDraft(popupDraft); setEditing(true) }}
            onChange={setDraft}
            onSave={saveDraft}
            onDelete={selected && !readOnly ? () => { callbacks.current.onDelete(selected.id); closePopup() } : undefined}
            onClose={closePopup}
          />
        </MapOverlay>
      )}
      {/* Без карты попап некуда якорить, поэтому он показывается по центру
          области. Правки оффлайн закрыты через readOnly, так что достаточно
          режима просмотра: название, дата и ссылка в приложение карт. */}
      {!mapsReady && selected && (
        <div className="places-map-detached-popup">
          <PlacePopup
            mode="view"
            draft={{ name: selected.name, icon: selected.icon, date: selected.date }}
            dates={dates}
            formatDate={formatDate}
            readOnly
            mapsUrl={placeMapsHref(selected) || undefined}
            onEdit={() => undefined}
            onChange={() => undefined}
            onSave={() => undefined}
            onClose={closePopup}
          />
        </div>
      )}
    </div>
  )
}
