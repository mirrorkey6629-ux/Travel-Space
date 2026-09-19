import { useEffect, useMemo, useRef, useState } from 'react'
import { MapOverlay } from './MapOverlay'
import { MapSearch, type SearchResult } from './MapSearch'
import { PlacePopup } from './PlacePopup'
import { iconForGoogleTypes, placeIconUrl, type PlaceIconKey } from '../placeIcons'
import { UNSCHEDULED_KEY, type PlaceDraft } from '../places'

type Coordinates = { lat: number; lng: number }

export type MapPlace = {
  id: string
  name: string
  url: string
  icon: PlaceIconKey
  date: string
  latitude?: number
  longitude?: number
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

export function PlacesMap({ query, places, dates, activeDate, readOnly, formatDate, onAdd, onUpdate, onDelete, onResolvePlace, focusRequest, onFocusHandled }: {
  query: string
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
  useEffect(() => {
    const map = mapRef.current
    if (!map || !focusRequest) return
    const place = places.find((item) => item.id === focusRequest)
    if (place && Number.isFinite(place.latitude) && Number.isFinite(place.longitude)) {
      map.panTo({ lat: place.latitude!, lng: place.longitude! })
      map.setZoom(Math.max(map.getZoom() ?? 15, 15))
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

  if (!key) return <iframe title={`Карта: ${query}`} src={`https://www.google.com/maps?q=${encodeURIComponent(query)}&z=12&output=embed`} loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />

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
      {!readOnly && mapsReady && <MapSearch maps={mapsRef.current} map={mapRef.current} onPick={pickSearchResult} />}
      {mapsReady && popupPosition && popupDraft && (
        <MapOverlay maps={mapsRef.current} map={mapRef.current} position={popupPosition}>
          <PlacePopup
            mode={editing ? 'edit' : 'view'}
            draft={popupDraft}
            dates={dates}
            formatDate={formatDate}
            readOnly={readOnly}
            mapsUrl={selected?.url || undefined}
            onEdit={() => { setDraft(popupDraft); setEditing(true) }}
            onChange={setDraft}
            onSave={saveDraft}
            onDelete={selected && !readOnly ? () => { callbacks.current.onDelete(selected.id); closePopup() } : undefined}
            onClose={closePopup}
          />
        </MapOverlay>
      )}
    </div>
  )
}
