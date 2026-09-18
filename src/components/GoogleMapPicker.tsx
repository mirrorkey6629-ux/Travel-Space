import { useEffect, useMemo, useRef, useState } from 'react'

type Coordinates = { lat: number; lng: number }
type MapPlace = { id: string; name: string; url: string; latitude?: number; longitude?: number }

let mapsPromise: Promise<any> | null = null
const geocodeCache = new Map<string, Coordinates | null>()

function loadMaps(key: string) {
  const existing = (window as any).google?.maps
  if (existing) return Promise.resolve(existing)
  if (!mapsPromise) mapsPromise = new Promise((resolve, reject) => {
    const callback = `travelMapsReady${Date.now()}`
    ;(window as any)[callback] = () => { resolve((window as any).google.maps); delete (window as any)[callback] }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=${callback}&v=weekly`
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

export function GoogleMapPicker({ query, queryCoordinates, places, onSelect, onResolvePlace }: {
  query: string
  queryCoordinates?: Coordinates
  places: MapPlace[]
  onSelect: (url: string, coordinates: Coordinates) => void
  onResolvePlace?: (id: string, coordinates: Coordinates) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const mapsRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const placeMarkersRef = useRef<any[]>([])
  const onSelectRef = useRef(onSelect)
  const onResolvePlaceRef = useRef(onResolvePlace)
  const [mapsReady, setMapsReady] = useState(false)
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
  const firstKnownPlace = places.find((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude))
  const initialCoordinates = queryCoordinates ?? (firstKnownPlace ? { lat: firstKnownPlace.latitude!, lng: firstKnownPlace.longitude! } : undefined)
  const placesSignature = useMemo(() => JSON.stringify(places.map(({ id, name, latitude, longitude }) => [id, name, latitude, longitude])), [places])

  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])
  useEffect(() => { onResolvePlaceRef.current = onResolvePlace }, [onResolvePlace])

  useEffect(() => {
    if (!key || !containerRef.current) return
    let active = true
    void loadMaps(key).then((maps) => {
      if (!active || !containerRef.current || mapRef.current) return
      mapsRef.current = maps
      mapRef.current = new maps.Map(containerRef.current, { center: initialCoordinates ?? { lat: 34.6937, lng: 135.5023 }, zoom: initialCoordinates ? 13 : 11, mapTypeControl: false, streetViewControl: false })
      ;(mapRef.current as any).__travelClick = mapRef.current.addListener('click', (event: any) => {
        const coordinates = { lat: event.latLng.lat(), lng: event.latLng.lng() }
        if (!markerRef.current) markerRef.current = new maps.Marker({ map: mapRef.current, position: coordinates })
        else markerRef.current.setPosition(coordinates)
        onSelectRef.current(`https://www.google.com/maps?q=${coordinates.lat.toFixed(6)},${coordinates.lng.toFixed(6)}`, coordinates)
      })
      setMapsReady(true)
    }).catch(() => undefined)
    return () => { active = false }
  }, [key])

  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (!maps || !map) return
    let active = true
    placeMarkersRef.current.forEach((marker) => marker.setMap(null))
    placeMarkersRef.current = []
    const geocoder = new maps.Geocoder()
    const render = (place: MapPlace, index: number, coordinates: Coordinates) => {
      if (!active) return
      placeMarkersRef.current.push(new maps.Marker({ map, position: coordinates, label: String(index + 1), title: place.name }))
    }
    places.forEach((place, index) => {
      if (Number.isFinite(place.latitude) && Number.isFinite(place.longitude)) {
        render(place, index, { lat: place.latitude!, lng: place.longitude! })
        return
      }
      void geocodeOnce(geocoder, place.name).then((coordinates) => {
        if (!coordinates) return
        render(place, index, coordinates)
        onResolvePlaceRef.current?.(place.id, coordinates)
      })
    })
    return () => { active = false }
  }, [mapsReady, placesSignature])

  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (!maps || !map) return
    if (queryCoordinates) {
      map.setCenter(queryCoordinates)
      map.setZoom(15)
      return
    }
    if (!query.trim() || places.some((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude))) return
    const geocoder = new maps.Geocoder()
    void geocodeOnce(geocoder, query).then((coordinates) => {
      if (!coordinates) return
      map.setCenter(coordinates)
      map.setZoom(13)
    })
  }, [mapsReady, placesSignature, query, queryCoordinates?.lat, queryCoordinates?.lng])

  if (!key) return <iframe title={`Карта: ${query}`} src={`https://www.google.com/maps?q=${encodeURIComponent(query)}&z=12&output=embed`} loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />
  return <div ref={containerRef} className="google-map-picker" aria-label="Выберите точку на карте" />
}
