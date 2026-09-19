import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

export type SearchResult = { name: string; types: string[]; position: { lat: number; lng: number } }

export function MapSearch({ maps, map, onPick }: {
  maps: any
  map: any
  onPick: (result: SearchResult) => void
}) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const tokenRef = useRef<any>(null)

  useEffect(() => {
    if (!maps?.places?.AutocompleteSuggestion || query.trim().length < 3) { setSuggestions([]); return }
    let active = true
    // Дебаунс не только экономит запросы, но и держит биллинг в пределах одного
    // сеанса: сеанс закрывается выбором места, а не каждым нажатием клавиши.
    const timer = window.setTimeout(async () => {
      tokenRef.current ??= new maps.places.AutocompleteSessionToken()
      try {
        const { suggestions: found } = await maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          sessionToken: tokenRef.current,
          locationBias: map?.getBounds() ?? undefined,
        })
        if (active) setSuggestions(found ?? [])
      } catch {
        if (active) setSuggestions([])
      }
    }, 300)
    return () => { active = false; window.clearTimeout(timer) }
  }, [maps, map, query])

  const pick = async (suggestion: any) => {
    const place = suggestion.placePrediction.toPlace()
    await place.fetchFields({ fields: ['location', 'displayName', 'types'] })
    // Токен сеанса одноразовый: после выбора места он обязан смениться, иначе
    // следующий поиск попадёт в уже закрытый сеанс и будет тарифицирован отдельно.
    tokenRef.current = null
    setQuery('')
    setSuggestions([])
    onPick({
      name: place.displayName ?? suggestion.placePrediction.text?.text ?? '',
      types: place.types ?? [],
      position: { lat: place.location.lat(), lng: place.location.lng() },
    })
  }

  return (
    <div className="map-search">
      <div className="map-search-field">
        <Icon name="add-pin" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти место" aria-label="Поиск места на карте" />
      </div>
      {suggestions.length > 0 && (
        <ul className="map-search-results">
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.placePrediction?.placeId ?? index}>
              <button type="button" onClick={() => void pick(suggestion)}>
                {suggestion.placePrediction?.text?.text ?? ''}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
