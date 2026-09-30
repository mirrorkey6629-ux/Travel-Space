import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { MapSearch, type SearchResult } from './MapSearch'
import { PlacePopup } from './PlacePopup'
import { iconForGoogleTypes, type PlaceIconKey } from '../placeIcons'
import { UNSCHEDULED_KEY, placeMapsHref, type PlaceDraft } from '../places'
import { createPlaceMarkerElement } from './PlaceMarker'

type Coordinates = { lat: number; lng: number }

export type MapPlace = {
  id: string
  name: string
  url: string
  icon: PlaceIconKey
  date: string
  latitude?: number
  longitude?: number
  notes?: string
  dateLocked?: boolean
  editTarget?: { cityId: string; panel: 'hotel' | 'in' | 'out' }
  hotelDetails?: { cityName: string; dateLabel: string; checkInTime: string; checkOutTime: string; hasBooking: boolean }
  attachmentId?: string
  attachmentKind?: 'hotel' | 'ticket'
}

let mapsPromise: Promise<any> | null = null
const geocodeCache = new Map<string, Coordinates | null>()
const geocodeAddressCache = new Map<string, string>()

function loadMaps(key: string) {
  const existing = (window as any).google?.maps
  if (existing) return Promise.resolve(existing)
  if (!mapsPromise) mapsPromise = new Promise((resolve, reject) => {
    const callback = `travelMapsReady${Date.now()}`
    ;(window as any)[callback] = () => { resolve((window as any).google.maps); delete (window as any)[callback] }
    const script = document.createElement('script')
    // libraries обязателен: без marker не будет AdvancedMarkerElement, без places — поиска.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places,marker&callback=${callback}&v=weekly&loading=async`
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
      if (status === 'OK' && results?.[0]?.formatted_address) geocodeAddressCache.set(normalized, results[0].formatted_address)
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

export function PlacesMap({ query, centerUrl = '', places, dates, activeDate, accentColor, pointCardTint, readOnly, formatDate, formatDateOption, onAdd, onUpdate, onDelete, onResolvePlace, onEditTarget, onOpenAttachment, onOpenBooking, focusRequest, onFocusHandled }: {
  query: string
  centerUrl?: string
  places: MapPlace[]
  dates: string[]
  activeDate: string | null
  accentColor?: string
  pointCardTint?: string
  readOnly?: boolean
  formatDate: (value: string) => string
  formatDateOption: (value: string) => string
  onAdd: (value: { name: string; icon: PlaceIconKey; date: string; notes: string; position: Coordinates }) => void
  onUpdate: (id: string, value: { name: string; icon: PlaceIconKey; date: string; notes: string }) => void
  onDelete: (id: string) => void
  onResolvePlace?: (id: string, coordinates: Coordinates) => void
  onEditTarget?: (target: NonNullable<MapPlace['editTarget']>) => void
  onOpenAttachment?: (attachmentId: string) => void
  onOpenBooking?: (cityId: string) => void
  focusRequest?: string | null
  onFocusHandled?: () => void
}) {
  const placesMapRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const centeredPopupRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const mapsRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const cameraAnimationRef = useRef<number | null>(null)
  const [mapsReady, setMapsReady] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [draftPosition, setDraftPosition] = useState<Coordinates | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<PlaceDraft | null>(null)
  const [editing, setEditing] = useState(false)
  const [resolvedCoordinates, setResolvedCoordinates] = useState<Record<string, Coordinates>>({})
  const [resolvedAddresses, setResolvedAddresses] = useState<Record<string, string>>({})
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
  const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined

  const selected = places.find((place) => place.id === selectedId) ?? null
  const selectedCoordinates = selected
    ? Number.isFinite(selected.latitude) && Number.isFinite(selected.longitude)
      ? { lat: selected.latitude!, lng: selected.longitude! }
      : resolvedCoordinates[selected.id]
    : undefined
  const firstKnown = places.find((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude))
  const initialCoordinates = firstKnown ? { lat: firstKnown.latitude!, lng: firstKnown.longitude! } : undefined
  const placesSignature = useMemo(
    () => JSON.stringify(places.map(({ id, name, icon, date, latitude, longitude }) => [id, name, icon, date, latitude, longitude])),
    [places],
  )

  const callbacks = useRef({ onAdd, onUpdate, onDelete, onResolvePlace, onEditTarget, onOpenAttachment, onOpenBooking, onFocusHandled })
  useEffect(() => { callbacks.current = { onAdd, onUpdate, onDelete, onResolvePlace, onEditTarget, onOpenAttachment, onOpenBooking, onFocusHandled } })

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
        zoomControl: false,
        cameraControl: false,
        keyboardShortcuts: false,
        isFractionalZoomEnabled: true,
        // Штатный fullscreen Google разворачивает только внутренний map-div и
        // отсекает наши React-overlay: поиск и карточку точки.
        fullscreenControl: false,
        // mapId обязателен: без него AdvancedMarkerElement молча не отрисуется.
        mapId,
      })
      setMapsReady(true)
    }).catch(() => undefined)
    return () => { active = false }
  }, [key])

  // setOptions нужен не только при создании: в dev-режиме Fast Refresh
  // сохраняет уже живой экземпляр Google Maps вместе со старыми контролами.
  useEffect(() => {
    mapRef.current?.setOptions({
      cameraControl: false,
      zoomControl: false,
      fullscreenControl: false,
      keyboardShortcuts: false,
    })
  }, [mapsReady])

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = document.fullscreenElement === placesMapRef.current
      setFullscreen(active)
      const map = mapRef.current
      const maps = mapsRef.current
      if (!map || !maps) return
      const center = map.getCenter()
      requestAnimationFrame(() => {
        maps.event.trigger(map, 'resize')
        if (center) map.setCenter(center)
      })
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement === placesMapRef.current) {
      void document.exitFullscreen()
      return
    }
    void placesMapRef.current?.requestFullscreen()
  }

  // Диалоги системных точек живут выше карты в дереве приложения. Браузер
  // показывает в fullscreen только содержимое fullscreen-элемента, поэтому
  // перед открытием такого диалога возвращаемся в обычный режим.
  const runOutsideFullscreen = (action: () => void) => {
    if (document.fullscreenElement !== placesMapRef.current) {
      action()
      return
    }
    void document.exitFullscreen()
      .then(() => requestAnimationFrame(() => action()))
      .catch(() => action())
  }

  const changeZoom = (delta: number) => {
    const map = mapRef.current
    if (!map) return
    map.setZoom((map.getZoom() ?? 12) + delta)
  }

  const animateToPoint = (coordinates: Coordinates, minimumZoom = 15) => {
    const map = mapRef.current
    if (!map) return
    if (cameraAnimationRef.current !== null) cancelAnimationFrame(cameraAnimationRef.current)

    const center = map.getCenter()
    const startZoom = map.getZoom() ?? minimumZoom
    const targetZoom = Math.max(startZoom, minimumZoom)
    if (!center || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      map.moveCamera({ center: coordinates, zoom: targetZoom })
      return
    }

    const start = { lat: center.lat(), lng: center.lng() }
    const startedAt = performance.now()
    const duration = 520
    const frame = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1)
      const eased = progress < .5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2
      map.moveCamera({
        center: {
          lat: start.lat + (coordinates.lat - start.lat) * eased,
          lng: start.lng + (coordinates.lng - start.lng) * eased,
        },
        zoom: startZoom + (targetZoom - startZoom) * eased,
      })
      if (progress < 1) cameraAnimationRef.current = requestAnimationFrame(frame)
      else cameraAnimationRef.current = null
    }
    cameraAnimationRef.current = requestAnimationFrame(frame)
  }

  useEffect(() => () => {
    if (cameraAnimationRef.current !== null) cancelAnimationFrame(cameraAnimationRef.current)
  }, [])

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
    // При неудачной или прерванной инициализации Maps addListener может не
    // вернуть дескриптор. Cleanup обязан оставаться безопасным в Strict Mode.
    return () => listener?.remove?.()
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
      const interactive = Boolean(place.url.trim())
      const content = createPlaceMarkerElement({ icon: place.icon, dimmed, interactive, managed: Boolean(place.editTarget), selected: selectedId === place.id, accentColor })
      const marker = new maps.marker.AdvancedMarkerElement({
        map,
        position: coordinates,
        // title не задаём: браузер рисует по нему свой чёрный системный тултип,
        // который дублирует попап и перекрывает соседние точки.
        content,
        // Без gmpClickable маркер с собственным content не генерирует событий клика.
        gmpClickable: interactive,
      })
      marker.__placeId = place.id
      marker.__content = content
      if (interactive) marker.addEventListener('gmp-click', () => {
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
        setResolvedCoordinates((current) => {
          const existing = current[place.id]
          return existing?.lat === coordinates.lat && existing.lng === coordinates.lng ? current : { ...current, [place.id]: coordinates }
        })
        const address = geocodeAddressCache.get(place.name.trim().toLocaleLowerCase())
        if (address) setResolvedAddresses((current) => current[place.id] === address ? current : { ...current, [place.id]: address })
        callbacks.current.onResolvePlace?.(place.id, coordinates)
      })
    })
    return () => { active = false }
  }, [mapsReady, placesSignature, activeDate, accentColor])

  // Меняем класс на уже отрисованном DOM-маркере: если пересоздать
  // AdvancedMarkerElement, CSS-transition не успеет показать переход из default в selected.
  useEffect(() => {
    markersRef.current.forEach((marker) => marker.__content?.classList.toggle('is-selected', marker.__placeId === selectedId))
  }, [selectedId])

  // Черновой пин — тот же AdvancedMarkerElement, но с иконкой pin-add.
  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (!maps || !map || !draftPosition) return
    const marker = new maps.marker.AdvancedMarkerElement({
      map,
      position: draftPosition,
      content: createPlaceMarkerElement({ draft: true, accentColor }),
      gmpClickable: true,
    })
    marker.addEventListener('gmp-click', () => {
      setDraft((current) => current ?? { name: '', icon: 'default', date: activeDate ?? UNSCHEDULED_KEY, notes: '' })
      setEditing(true)
    })
    return () => { marker.map = null }
  }, [mapsReady, draftPosition, activeDate, accentColor])

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
      setDraftPosition(null)
      setEditing(false)
      setDraft(null)
      setSelectedId(place.id)
    }
    callbacks.current.onFocusHandled?.()
  }, [focusRequest, placesSignature, mapsReady, resolvedCoordinates])

  // Карточка выбранной точки закреплена в углу карты, поэтому сам маркер
  // можно держать строго по центру и не пересчитывать сдвиг по высоте карточки.
  useEffect(() => {
    if (!mapsReady || !selected) return
    const map = mapRef.current
    if (!map) return
    if (!selectedCoordinates) return
    animateToPoint(selectedCoordinates)
  }, [mapsReady, selectedId, selectedCoordinates?.lat, selectedCoordinates?.lng])

  const pickSearchResult = (result: SearchResult) => {
    const map = mapRef.current
    map?.panTo(result.position)
    map?.setZoom(16)
    setSelectedId(null)
    setDraftPosition(result.position)
    setDraft({ name: result.name, icon: iconForGoogleTypes(result.types), date: activeDate ?? UNSCHEDULED_KEY, notes: '' })
    setEditing(true)
  }

  const saveDraft = () => {
    if (!draft || !draft.name.trim()) return
    if (selected) callbacks.current.onUpdate(selected.id, { ...draft, name: draft.name.trim() })
    else if (draftPosition) callbacks.current.onAdd({ ...draft, name: draft.name.trim(), position: draftPosition })
    closePopup()
  }

  if (!key) return <iframe title={`Карта: ${query}`} src={`https://www.google.com/maps?q=${encodeURIComponent(addressFromMapsUrl(centerUrl) || query)}&z=12&output=embed`} loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />

  const popupPosition = selected
    ? Number.isFinite(selected.latitude) && Number.isFinite(selected.longitude)
      ? { lat: selected.latitude!, lng: selected.longitude! }
      : resolvedCoordinates[selected.id] ?? null
    : draftPosition
  const popupDraft = editing
    ? draft
    : selected
      ? { name: selected.name, icon: selected.icon, date: selected.date, notes: selected.notes ?? '' }
      : null

  return (
    <div ref={placesMapRef} className={`places-map${pointCardTint ? ' places-map-tinted' : ''}`} style={pointCardTint ? { '--map-point-card-tint': pointCardTint } as CSSProperties : undefined}>
      <div ref={containerRef} className="google-map-picker" aria-label="Карта точек" />
      {/* Оффлайн Google Maps не загружается. Пустой прямоугольник выглядел бы
          поломкой, поэтому область карты прямо говорит, что происходит. */}
      {!mapsReady && <p className="places-map-fallback">Карта недоступна без интернета</p>}
      {!readOnly && mapsReady && <MapSearch maps={mapsRef.current} map={mapRef.current} onPick={pickSearchResult} />}
      {mapsReady && <div className="map-controls" aria-label="Управление картой">
        <button type="button" className={`map-control-button map-fullscreen-button${fullscreen ? ' is-fullscreen' : ''}`} aria-label={fullscreen ? 'Выйти из полноэкранного режима' : 'Открыть карту на весь экран'} title={fullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран'} onClick={toggleFullscreen}><span aria-hidden="true" /></button>
        <button type="button" className="map-control-button map-zoom-button map-zoom-in" aria-label="Увеличить масштаб" title="Увеличить масштаб" onClick={() => changeZoom(1)}><span aria-hidden="true" /></button>
        <button type="button" className="map-control-button map-zoom-button map-zoom-out" aria-label="Уменьшить масштаб" title="Уменьшить масштаб" onClick={() => changeZoom(-1)}><span aria-hidden="true" /></button>
      </div>}
      {mapsReady && popupPosition && popupDraft && (
        <div ref={centeredPopupRef} className="places-map-point-popup">
          <PlacePopup
            mode={editing ? 'edit' : 'view'}
            draft={popupDraft}
            dates={dates}
            formatDate={formatDate}
            formatDateOption={formatDateOption}
            readOnly={readOnly}
            dateLocked={selected?.dateLocked}
            mapsUrl={selected ? placeMapsHref(selected) || undefined : undefined}
            mapsAddress={selected ? resolvedAddresses[selected.id] : undefined}
            hotelDetails={selected?.hotelDetails}
            attachmentKind={selected?.attachmentKind}
            onOpenAttachment={selected?.attachmentId ? () => runOutsideFullscreen(() => callbacks.current.onOpenAttachment?.(selected.attachmentId!)) : undefined}
            onOpenBooking={selected?.hotelDetails?.hasBooking ? () => runOutsideFullscreen(() => callbacks.current.onOpenBooking?.(selected.editTarget?.cityId ?? '')) : undefined}
            onEdit={() => {
              if (selected?.editTarget) {
                const target = selected.editTarget
                closePopup()
                runOutsideFullscreen(() => callbacks.current.onEditTarget?.(target))
                return
              }
              setDraft(popupDraft)
              setEditing(true)
            }}
            onChange={setDraft}
            onSave={saveDraft}
            onDelete={selected && !readOnly ? () => { callbacks.current.onDelete(selected.id); closePopup() } : undefined}
            onClose={closePopup}
          />
        </div>
      )}
      {/* Без карты попап некуда якорить, поэтому он показывается по центру
          области. Правки оффлайн закрыты через readOnly, так что достаточно
          режима просмотра: название, дата и ссылка в приложение карт. */}
      {!mapsReady && selected && (
        <div className="places-map-detached-popup">
          <PlacePopup
            mode="view"
            draft={{ name: selected.name, icon: selected.icon, date: selected.date, notes: selected.notes ?? '' }}
            dates={dates}
            formatDate={formatDate}
            formatDateOption={formatDateOption}
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
