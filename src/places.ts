import type { PlaceIconKey } from './placeIcons'

// Ключ дня «Без даты». Единственное место объявления: App.tsx, тултип, список
// дней и карта обязаны сравнивать даты с одним и тем же значением.
export const UNSCHEDULED_KEY = 'unscheduled'

export type PlaceDraft = { name: string; icon: PlaceIconKey; date: string }

/**
 * Ссылка «открыть в Google Maps».
 *
 * При известных координатах строится документированная форма Maps URLs API. Она
 * важна именно оффлайн: сохранённая ссылка часто короткая (`maps.app.goo.gl`),
 * а короткую без сети не развернуть — приложение карт упрётся в редирект.
 * Домен `google.com/maps` матчится app-link-ами приложения Google Maps и на
 * Android, и на iOS, поэтому пин ставится из офлайновых карт устройства.
 */
export function placeMapsHref(place: { url: string; latitude?: number; longitude?: number }): string {
  if (Number.isFinite(place.latitude) && Number.isFinite(place.longitude)) {
    const query = encodeURIComponent(`${place.latitude},${place.longitude}`)
    return `https://www.google.com/maps/search/?api=1&query=${query}`
  }
  return place.url
}
