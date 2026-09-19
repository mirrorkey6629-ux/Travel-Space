# PWA и оффлайн-режим — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать приложение устанавливаемым PWA, в котором открытая поездка со всеми картинками, аватарами и документами доступна без интернета, а недостающее докачивается в фоне.

**Architecture:** Service worker на `vite-plugin-pwa` в режиме `injectManifest` живёт под scope `/travel/` и раскладывает запросы по четырём кэшам плюс precache оболочки. Список ресурсов поездки строит приложение чистой функцией и отправляет его в SW сообщением; SW качает файлы по два и шлёт обратно прогресс. Индикатор у названия поездки показывает кольцо прогресса или оффлайн-иконку, а оффлайн переиспользует уже существующий сквозной проп `readOnly`.

**Tech Stack:** Vite, React, TypeScript, `vite-plugin-pwa` + Workbox, vitest.

Спека: `docs/superpowers/specs/2026-09-19-pwa-offline-design.md`

---

## Порядок задач

1. Чистые функции с тестами (`classifyRequest`, `resources`, `cacheState`, `placeMapsHref`) — их можно писать по TDD и они ни от чего не зависят.
2. Service worker и подключение плагина.
3. UI: индикатор, оффлайн-режим, точки без карты.
4. Проверка и документация.

---

### Task 1: `classifyRequest` — раскладка запроса по кэшам

Чистая функция, вынесенная из SW: внутри service worker её нечем тестировать, а правила раскладки — самая ошибкоопасная часть.

**Files:**
- Create: `src/offline/classifyRequest.ts`
- Test: `src/offline/classifyRequest.test.ts`

- [ ] **Step 1: Написать падающий тест**

```ts
import { describe, expect, it } from 'vitest'
import { classifyRequest } from './classifyRequest'

const scope = new URL('https://example.com/travel/')
const at = (path: string, method = 'GET') => classifyRequest(method, new URL(path, 'https://example.com'), scope)

describe('classifyRequest', () => {
  it('раскладывает статику и данные поездки', () => {
    expect(at('/travel/assets/autumn-garden.jpg')).toBe('asset')
    expect(at('/travel/assets/icons/place.svg')).toBe('asset')
    expect(at('/travel/api/trips')).toBe('data')
    expect(at('/travel/api/trips/abc')).toBe('data')
    expect(at('/travel/api/me')).toBe('data')
    expect(at('/travel/api/public-trips/tok')).toBe('data')
  })

  it('отделяет неизменяемые файлы от аватаров', () => {
    expect(at('/travel/api/documents/abc/download')).toBe('media')
    expect(at('/travel/api/public-trips/tok/documents/abc')).toBe('media')
    expect(at('/travel/api/me/avatar')).toBe('avatar')
    expect(at('/travel/api/trips/abc/members/def/avatar')).toBe('avatar')
  })

  it('не трогает мутации, экспорт, чужой origin и пути вне базы', () => {
    expect(at('/travel/api/trips', 'POST')).toBeNull()
    expect(at('/travel/api/trips/abc/export')).toBeNull()
    expect(at('/other/api/trips')).toBeNull()
    expect(classifyRequest('GET', new URL('https://maps.googleapis.com/maps/api/js'), scope)).toBeNull()
  })

  it('работает с другим префиксом публикации', () => {
    const other = new URL('https://example.com/plan/')
    expect(classifyRequest('GET', new URL('https://example.com/plan/api/trips'), other)).toBe('data')
    expect(classifyRequest('GET', new URL('https://example.com/travel/api/trips'), other)).toBeNull()
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `pnpm vitest run src/offline/classifyRequest.test.ts`
Expected: FAIL — `Failed to resolve import "./classifyRequest"`

- [ ] **Step 3: Реализовать**

```ts
export type CacheKind = 'asset' | 'data' | 'media' | 'avatar'

/**
 * Определяет, в какой кэш попадает запрос, или `null` — если он обслуживается
 * только сетью.
 *
 * Живёт отдельным модулем, а не внутри `sw.ts`: в service worker эту логику
 * нечем покрыть тестами, а она решает, что вообще окажется доступно оффлайн.
 *
 * `scope` приходит из `self.registration.scope`, поэтому префикс публикации не
 * задаётся здесь константой: он уже определён в `vite.config.ts` и в конфиге API.
 */
export function classifyRequest(method: string, url: URL, scope: URL): CacheKind | null {
  if (method !== 'GET') return null
  if (url.origin !== scope.origin) return null
  if (!url.pathname.startsWith(scope.pathname)) return null
  const rest = url.pathname.slice(scope.pathname.length)
  if (rest.startsWith('assets/')) return 'asset'
  if (!rest.startsWith('api/')) return null
  const endpoint = rest.slice('api/'.length)
  // Экспорт поездки — разовая выгрузка архива. Класть её в кэш данных значит
  // удвоить вес всех документов ради файла, который нужен один раз.
  if (/^trips\/[^/]+\/export$/.test(endpoint)) return null
  if (endpoint.endsWith('/avatar')) return 'avatar'
  if (/^documents\/[^/]+\/download$/.test(endpoint)) return 'media'
  if (/^public-trips\/[^/]+\/documents\/[^/]+$/.test(endpoint)) return 'media'
  return 'data'
}
```

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `pnpm vitest run src/offline/classifyRequest.test.ts`
Expected: PASS, 4 теста

- [ ] **Step 5: Коммит**

```bash
git add src/offline/classifyRequest.ts src/offline/classifyRequest.test.ts
git commit -m "feat: classify requests into offline caches"
```

---

### Task 2: Список ресурсов поездки

**Files:**
- Create: `src/offline/resources.ts`
- Test: `src/offline/resources.test.ts`

- [ ] **Step 1: Написать падающий тест**

```ts
import { describe, expect, it } from 'vitest'
import type { ApiDocument, ApiMember, ApiTripDetails, ApiTripSummary } from '../api'
import { STATIC_OFFLINE_ASSETS, tripResourceUrls, tripsListResourceUrls } from './resources'

const base = '/travel/'

const document = (id: string, category: string): ApiDocument =>
  ({ id, city_id: null, category, original_name: `${id}.pdf`, created_by: 'u', created_by_name: 'U', created_at: '2026-09-19' })

const member = (id: string, hasAvatar: boolean): ApiMember =>
  ({ id, email: `${id}@example.com`, display_name: id, role: 'member', joined_at: '2026-09-19', has_avatar: hasAvatar })

const trip = {
  id: 'trip-1',
  documents: [document('doc-ticket', 'train-in:city-1'), document('doc-bg', 'trip-background'), document('doc-city', 'city-image')],
  members: [member('m-1', true), member('m-2', false)],
} as unknown as ApiTripDetails

describe('tripResourceUrls', () => {
  it('ставит картинки раньше тяжёлых документов', () => {
    const urls = tripResourceUrls({ trip, base, hasOwnAvatar: true })
    const background = urls.indexOf('/travel/api/documents/doc-bg/download')
    const cityImage = urls.indexOf('/travel/api/documents/doc-city/download')
    const ticket = urls.indexOf('/travel/api/documents/doc-ticket/download')
    expect(background).toBeGreaterThan(-1)
    expect(cityImage).toBeLessThan(ticket)
    expect(background).toBeLessThan(ticket)
  })

  it('включает JSON поездки, статику и аватары только тех, у кого они есть', () => {
    const urls = tripResourceUrls({ trip, base, hasOwnAvatar: true })
    expect(urls).toContain('/travel/api/trips/trip-1')
    expect(urls).toContain('/travel/assets/autumn-garden.jpg')
    expect(urls).toContain('/travel/api/trips/trip-1/members/m-1/avatar')
    expect(urls).not.toContain('/travel/api/trips/trip-1/members/m-2/avatar')
    expect(urls).toContain('/travel/api/me/avatar')
  })

  it('не просит свой аватар, когда его нет', () => {
    expect(tripResourceUrls({ trip, base, hasOwnAvatar: false })).not.toContain('/travel/api/me/avatar')
  })

  it('в публичном режиме ходит по токену и не трогает приватные эндпоинты', () => {
    const urls = tripResourceUrls({ trip, base, hasOwnAvatar: true, publicToken: 'tok en' })
    expect(urls).toContain('/travel/api/public-trips/tok%20en')
    expect(urls).toContain('/travel/api/public-trips/tok%20en/documents/doc-bg')
    expect(urls.some((url) => url.includes('/members/'))).toBe(false)
    expect(urls).not.toContain('/travel/api/me/avatar')
  })

  it('не повторяет один URL дважды', () => {
    const urls = tripResourceUrls({ trip, base, hasOwnAvatar: true })
    expect(new Set(urls).size).toBe(urls.length)
    expect(STATIC_OFFLINE_ASSETS.length).toBeGreaterThan(0)
  })
})

describe('tripsListResourceUrls', () => {
  const summary = (id: string, backgroundId: string | null, removed = false): ApiTripSummary =>
    ({ id, name: id, start_date: '2026-09-19', end_date: '2026-09-20', time_zone: 'UTC', role: 'owner', background_document_id: backgroundId, background_removed: removed })

  it('берёт фоны поездок и пропускает снятые', () => {
    const urls = tripsListResourceUrls([summary('a', 'bg-a'), summary('b', null), summary('c', 'bg-c', true)], base)
    expect(urls).toContain('/travel/api/trips')
    expect(urls).toContain('/travel/api/documents/bg-a/download')
    expect(urls).not.toContain('/travel/api/documents/bg-c/download')
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `pnpm vitest run src/offline/resources.test.ts`
Expected: FAIL — `Failed to resolve import "./resources"`

- [ ] **Step 3: Реализовать**

```ts
import type { ApiTripDetails, ApiTripSummary } from '../api'

// Категории документов, которые видны на экране сразу. Они качаются первыми,
// чтобы поездка выглядела целой раньше, чем докачаются PDF билетов.
const IMAGE_CATEGORIES = new Set(['trip-background', 'city-image'])

/**
 * Статика, которую не кладём в precache: `autumn-garden.jpg` весит 5.4 МБ и
 * растянул бы установку приложения. Забирается фоновой докачкой.
 */
export const STATIC_OFFLINE_ASSETS = [
  'assets/autumn-garden.jpg',
  'assets/city-placeholder.png',
  'assets/hotel-placeholder.png',
  'assets/ticket-placeholder.png',
  'assets/person-default.png',
  'assets/person-member.png',
  'assets/person-owner.png',
]

const unique = (urls: string[]) => [...new Set(urls)]

/**
 * Полный список того, что нужно поездке оффлайн.
 *
 * Список строит клиент, а не service worker: клиент и так разбирает
 * `ApiTripDetails`, поэтому знание о форме API остаётся в одном месте, а SW
 * остаётся простым загрузчиком.
 *
 * `base` передаётся параметром, а не читается из `import.meta.env`, чтобы
 * функция оставалась чистой и проверялась в node-окружении vitest.
 */
export function tripResourceUrls({ trip, base, hasOwnAvatar, publicToken }: {
  trip: ApiTripDetails
  base: string
  hasOwnAvatar: boolean
  publicToken?: string
}): string[] {
  const api = `${base}api`
  const token = publicToken ? encodeURIComponent(publicToken) : ''
  const documentUrl = (id: string) => publicToken ? `${api}/public-trips/${token}/documents/${id}` : `${api}/documents/${id}/download`
  const images = trip.documents.filter((item) => IMAGE_CATEGORIES.has(item.category))
  const rest = trip.documents.filter((item) => !IMAGE_CATEGORIES.has(item.category))
  return unique([
    ...STATIC_OFFLINE_ASSETS.map((path) => `${base}${path}`),
    // JSON поездки входит в докачку намеренно: на первой загрузке страница ещё
    // не под управлением SW, и обычный перехват fetch её не увидит.
    publicToken ? `${api}/public-trips/${token}` : `${api}/trips/${trip.id}`,
    ...images.map((item) => documentUrl(item.id)),
    ...(publicToken ? [] : trip.members.filter((item) => item.has_avatar).map((item) => `${api}/trips/${trip.id}/members/${item.id}/avatar`)),
    ...(!publicToken && hasOwnAvatar ? [`${api}/me/avatar`] : []),
    ...rest.map((item) => documentUrl(item.id)),
  ])
}

/** Фоны для экрана списка поездок — без них список оффлайн выглядит пустым. */
export function tripsListResourceUrls(trips: ApiTripSummary[], base: string): string[] {
  const api = `${base}api`
  return unique([
    `${api}/trips`,
    `${api}/me`,
    ...trips
      .filter((trip) => trip.background_document_id && !trip.background_removed)
      .map((trip) => `${api}/documents/${trip.background_document_id}/download`),
  ])
}
```

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `pnpm vitest run src/offline/resources.test.ts`
Expected: PASS, 6 тестов

- [ ] **Step 5: Коммит**

```bash
git add src/offline/resources.ts src/offline/resources.test.ts
git commit -m "feat: build the offline resource list for a trip"
```

---

### Task 3: Состояние индикатора

**Files:**
- Create: `src/offline/cacheState.ts`
- Test: `src/offline/cacheState.test.ts`

- [ ] **Step 1: Написать падающий тест**

```ts
import { describe, expect, it } from 'vitest'
import { cachePercent, cacheStateReducer, type CacheState } from './cacheState'

describe('cacheStateReducer', () => {
  it('переводит из idle в прогресс и в готовность', () => {
    const idle: CacheState = { kind: 'idle' }
    const progress = cacheStateReducer(idle, { type: 'prefetch-progress', tripId: 't', done: 3, total: 12 }, 't')
    expect(progress).toEqual({ kind: 'prefetching', tripId: 't', done: 3, total: 12 })
    expect(cacheStateReducer(progress, { type: 'prefetch-done', tripId: 't' }, 't')).toEqual({ kind: 'ready' })
  })

  it('игнорирует сообщения про другую поездку', () => {
    const progress: CacheState = { kind: 'prefetching', tripId: 't', done: 3, total: 12 }
    expect(cacheStateReducer(progress, { type: 'prefetch-done', tripId: 'other' }, 't')).toBe(progress)
  })

  it('запоминает, на чём остановилась докачка', () => {
    const progress: CacheState = { kind: 'prefetching', tripId: 't', done: 9, total: 12 }
    expect(cacheStateReducer(progress, { type: 'prefetch-blocked', tripId: 't', reason: 'quota' }, 't'))
      .toEqual({ kind: 'blocked', reason: 'quota', done: 9, total: 12 })
  })
})

describe('cachePercent', () => {
  it('считает долю файлов и не делит на ноль', () => {
    expect(cachePercent({ kind: 'prefetching', tripId: 't', done: 3, total: 12 })).toBe(25)
    expect(cachePercent({ kind: 'blocked', reason: 'network', done: 9, total: 12 })).toBe(75)
    expect(cachePercent({ kind: 'prefetching', tripId: 't', done: 0, total: 0 })).toBe(0)
    expect(cachePercent({ kind: 'ready' })).toBe(100)
    expect(cachePercent({ kind: 'idle' })).toBe(0)
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `pnpm vitest run src/offline/cacheState.test.ts`
Expected: FAIL — `Failed to resolve import "./cacheState"`

- [ ] **Step 3: Реализовать**

```ts
export type CacheBlockReason = 'quota' | 'network'

export type CacheState =
  | { kind: 'idle' }
  | { kind: 'prefetching'; tripId: string | null; done: number; total: number }
  | { kind: 'ready' }
  | { kind: 'blocked'; reason: CacheBlockReason; done: number; total: number }

export type CacheMessage =
  | { type: 'prefetch-progress'; tripId: string | null; done: number; total: number }
  | { type: 'prefetch-done'; tripId: string | null }
  | { type: 'prefetch-blocked'; tripId: string | null; reason: CacheBlockReason }

/**
 * Service worker один на все вкладки, поэтому сообщение может прийти про чужую
 * поездку — например, пока в соседней вкладке открыта другая. Такое сообщение
 * не должно двигать индикатор, поэтому `tripId` сверяется явно.
 */
export function cacheStateReducer(state: CacheState, message: CacheMessage, tripId: string | null): CacheState {
  if (message.tripId !== tripId) return state
  if (message.type === 'prefetch-progress') return { kind: 'prefetching', tripId, done: message.done, total: message.total }
  if (message.type === 'prefetch-done') return { kind: 'ready' }
  const done = state.kind === 'prefetching' ? state.done : 0
  const total = state.kind === 'prefetching' ? state.total : 0
  return { kind: 'blocked', reason: message.reason, done, total }
}

export function cachePercent(state: CacheState): number {
  if (state.kind === 'ready') return 100
  if (state.kind === 'idle') return 0
  return state.total > 0 ? Math.round((state.done / state.total) * 100) : 0
}
```

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `pnpm vitest run src/offline/cacheState.test.ts`
Expected: PASS, 4 теста

- [ ] **Step 5: Коммит**

```bash
git add src/offline/cacheState.ts src/offline/cacheState.test.ts
git commit -m "feat: track offline cache progress state"
```

---

### Task 4: Ссылка на место, которая открывается без сети

**Files:**
- Modify: `src/places.ts`
- Modify: `src/components/PlacesMap.tsx:255` (проп `mapsUrl` у `PlacePopup`)
- Test: `src/places.test.ts`

- [ ] **Step 1: Написать падающий тест**

```ts
import { describe, expect, it } from 'vitest'
import { placeMapsHref } from './places'

describe('placeMapsHref', () => {
  it('строит координатную ссылку, когда координаты известны', () => {
    expect(placeMapsHref({ url: 'https://maps.app.goo.gl/abc', latitude: 34.6937, longitude: 135.5023 }))
      .toBe('https://www.google.com/maps/search/?api=1&query=34.6937%2C135.5023')
  })

  it('возвращает сохранённую ссылку, если координат нет', () => {
    expect(placeMapsHref({ url: 'https://maps.app.goo.gl/abc' })).toBe('https://maps.app.goo.gl/abc')
    expect(placeMapsHref({ url: 'https://maps.app.goo.gl/abc', latitude: 34.69 })).toBe('https://maps.app.goo.gl/abc')
  })

  it('возвращает пустую строку, когда нет ни того, ни другого', () => {
    expect(placeMapsHref({ url: '' })).toBe('')
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `pnpm vitest run src/places.test.ts`
Expected: FAIL — `placeMapsHref is not a function`

- [ ] **Step 3: Реализовать**

Дописать в конец `src/places.ts`:

```ts
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
```

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `pnpm vitest run src/places.test.ts`
Expected: PASS, 3 теста

- [ ] **Step 5: Подключить в карте**

В `src/components/PlacesMap.tsx` добавить импорт:

```ts
import { UNSCHEDULED_KEY, placeMapsHref, type PlaceDraft } from '../places'
```

и заменить проп у `PlacePopup`:

```tsx
mapsUrl={selected ? placeMapsHref(selected) || undefined : undefined}
```

- [ ] **Step 6: Проверить типы**

Run: `pnpm typecheck`
Expected: без ошибок

- [ ] **Step 7: Коммит**

```bash
git add src/places.ts src/places.test.ts src/components/PlacesMap.tsx
git commit -m "feat: link places by coordinates so maps open offline"
```

---

### Task 5: Подключить vite-plugin-pwa и манифест

Здесь появляется каркас PWA. Service worker пишется следующей задачей, поэтому пока в `src/sw.ts` кладётся минимальная версия — только precache, чтобы сборка проходила.

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `index.html`
- Modify: `src/main.tsx`
- Modify: `src/vite-env.d.ts`
- Modify: `tsconfig.json`, `tsconfig.app.json`
- Create: `tsconfig.sw.json`
- Create: `src/sw.ts`
- Create: `public/assets/app-icon-192.png`, `public/assets/app-icon-512.png`, `public/assets/app-icon-512-maskable.png`

- [ ] **Step 1: Поставить зависимости**

```bash
pnpm add -D vite-plugin-pwa workbox-core workbox-precaching workbox-routing workbox-strategies workbox-window
```

Проект держит react и vite в `devDependencies` — новые пакеты идут туда же.

- [ ] **Step 2: Нарисовать иконки приложения**

Иконки — белый глиф `public/assets/icons/planet.svg` на фоне `#080808`, тот же логотип, что на экранах авторизации.

Создать `scratch/icon.html` во временной папке сессии (не в репозитории) следующего содержания, открыть его в браузере и забрать три data-URL через `canvas.toDataURL('image/png')`:

```html
<canvas id="c"></canvas>
<script>
const draw = (size, glyphScale) => new Promise((resolve) => {
  const canvas = document.getElementById('c')
  canvas.width = size; canvas.height = size
  const context = canvas.getContext('2d')
  context.fillStyle = '#080808'
  context.fillRect(0, 0, size, size)
  const image = new Image()
  image.onload = () => {
    const glyph = size * glyphScale
    context.drawImage(image, (size - glyph) / 2, (size - glyph) / 2, glyph, glyph)
    resolve(canvas.toDataURL('image/png'))
  }
  image.src = 'PLANET_SVG_AS_DATA_URI'
})
</script>
```

- `app-icon-192.png` — `draw(192, 0.62)`
- `app-icon-512.png` — `draw(512, 0.62)`
- `app-icon-512-maskable.png` — `draw(512, 0.44)`: у maskable безопасная зона — центральные 80 %, поэтому глиф мельче.

Data-URL декодировать в файлы:

```bash
node -e "require('fs').writeFileSync('public/assets/app-icon-192.png', Buffer.from(process.argv[1].split(',')[1], 'base64'))" "<data-url>"
```

Проверить результат:

```bash
node -e "const b=require('fs').readFileSync('public/assets/app-icon-512.png'); console.log(b.length, b.readUInt32BE(16)+'x'+b.readUInt32BE(20))"
```
Expected: непустой размер и `512x512`

- [ ] **Step 3: Включить плагин в `vite.config.ts`**

Добавить импорт и плагин; `preview` получает тот же proxy, что и `server` — без него собранную PWA негде проверить с живым API:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const basePath = (process.env.BASE_PATH ?? '/travel').replace(/\/+$/, '')
const proxy = { [`${basePath}/api`]: 'http://127.0.0.1:3000' }

export default defineConfig({
  base: `${basePath}/`,
  plugins: [
    react(),
    VitePWA({
      // injectManifest: precache и ревизии берёт workbox, вся остальная логика
      // своя — токен в докачке и отчёт о прогрессе чужой абстракцией не выразить.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // Новый worker ждёт и берёт управление при следующем холодном старте:
      // авто-перезагрузка посреди незакрытой формы города потеряла бы правки.
      injectRegister: null,
      registerType: 'prompt',
      // Крупные растровые картинки в precache не идут: autumn-garden.jpg весит
      // 5.4 МБ. Их забирает фоновая докачка в travel-assets-v1.
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,webmanifest}'] },
      // devOptions по умолчанию выключены: в dev SW только мешает кэшем.
      manifest: {
        name: 'Travel Space',
        short_name: 'Travel Space',
        description: 'Совместное планирование путешествий',
        lang: 'ru',
        display: 'standalone',
        background_color: '#080808',
        theme_color: '#080808',
        icons: [
          { src: 'assets/app-icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'assets/app-icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'assets/app-icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: { host: true, proxy },
  preview: { host: true, proxy },
  build: {
    // Lightning CSS drops the unprefixed backdrop-filter for this target set.
    // Keep the authored declarations so glass cards work in every browser.
    cssMinify: false,
  },
})
```

- [ ] **Step 4: Зарегистрировать worker в `src/main.tsx`**

Добавить импорт и вызов до `createRoot`:

```ts
import { registerSW } from 'virtual:pwa-register'

// immediate: false — новый worker ждёт и активируется при следующем холодном
// старте, не перезагружая страницу под руками у пользователя.
registerSW({ immediate: false })
```

- [ ] **Step 5: Добавить типы и apple-touch-icon**

`src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
```

В `index.html` внутрь `<head>` — путь относительный, абсолютный не переписался бы под `base`:

```html
    <link rel="apple-touch-icon" href="assets/app-icon-192.png" />
    <meta name="mobile-web-app-capable" content="yes" />
```

- [ ] **Step 6: Развести tsconfig для worker-кода**

`src/sw.ts` работает в WebWorker, а не в DOM, поэтому у него отдельный проект: библиотеки `DOM` и `WebWorker` в одном `lib` конфликтуют объявлениями.

Создать `tsconfig.sw.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "WebWorker"],
    "skipLibCheck": true,
    "strict": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src/sw.ts", "src/offline/classifyRequest.ts"]
}
```

В `tsconfig.app.json` добавить рядом с `include`:

```json
  "exclude": ["src/sw.ts"]
```

В `tsconfig.json` добавить ссылку:

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.sw.json" }]
}
```

- [ ] **Step 7: Заглушка service worker**

Создать `src/sw.ts`:

```ts
/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

precacheAndRoute(self.__WB_MANIFEST)
```

- [ ] **Step 8: Проверить сборку**

Run: `pnpm typecheck && pnpm build`
Expected: без ошибок; в выводе `vite build` видны `dist/sw.js` и `dist/manifest.webmanifest`

Run: `node -e "const m=require('./dist/manifest.webmanifest'); console.log(m.scope, m.start_url, m.icons.length)"`
Expected: `/travel/ /travel/ 3`

- [ ] **Step 9: Коммит**

```bash
git add package.json pnpm-lock.yaml vite.config.ts index.html src/main.tsx src/vite-env.d.ts src/sw.ts tsconfig.json tsconfig.app.json tsconfig.sw.json public/assets/app-icon-192.png public/assets/app-icon-512.png public/assets/app-icon-512-maskable.png
git commit -m "feat: make the app installable as a PWA"
```

---

### Task 6: Service worker — маршруты и фоновая докачка

**Files:**
- Modify: `src/sw.ts` (полностью переписывается)

- [ ] **Step 1: Написать worker целиком**

```ts
/// <reference lib="webworker" />
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate, type Strategy } from 'workbox-strategies'
import { classifyRequest, type CacheKind } from './offline/classifyRequest'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

const scope = new URL(self.registration.scope)

const CACHES: Record<CacheKind, string> = {
  asset: 'travel-assets-v1',
  data: 'travel-data-v1',
  media: 'travel-media-v1',
  avatar: 'travel-avatars-v1',
}

// Приватные кэши сносятся при выходе из аккаунта: ключ Cache API — это URL, а не
// токен, поэтому иначе следующий пользователь того же браузера увидел бы чужую
// поездку. Кэш статики приватного не содержит и переживает выход.
const PRIVATE_CACHES = [CACHES.data, CACHES.media, CACHES.avatar]
const KNOWN_CACHES = new Set<string>(Object.values(CACHES))

precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(
    names.filter((name) => name.startsWith('travel-') && !KNOWN_CACHES.has(name)).map((name) => caches.delete(name)),
  )))
})

async function broadcast(message: unknown) {
  // includeUncontrolled: на самой первой загрузке страница ещё не под
  // управлением worker-а, но прогресс ей уже нужен.
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
  clients.forEach((client) => client.postMessage(message))
}

// Состояние сети берётся из реальных запросов, а не из navigator.onLine: тот
// показывает «онлайн» и при Wi-Fi без интернета.
let online = true
function setOnline(value: boolean) {
  if (online === value) return
  online = value
  void broadcast({ type: 'network', online: value })
}

const networkSignal = {
  fetchDidSucceed: async ({ response }: { response: Response }) => { setOnline(true); return response },
  fetchDidFail: async () => { setOnline(false) },
}

const strategies: Record<CacheKind, Strategy> = {
  asset: new CacheFirst({ cacheName: CACHES.asset }),
  // Документ по id неизменяем: правка создаёт новую строку с новым id.
  media: new CacheFirst({ cacheName: CACHES.media }),
  // Аватар меняется по тому же URL, поэтому отдаём кэш и обновляем следом.
  avatar: new StaleWhileRevalidate({ cacheName: CACHES.avatar }),
  // Свежесть данных важнее кэша, но на плохой сети поездка всё равно откроется.
  data: new NetworkFirst({ cacheName: CACHES.data, networkTimeoutSeconds: 4, plugins: [networkSignal] }),
}

// Прямой заход на /travel/view/<token> должен открываться и оффлайн: сервер на
// такие пути отдаёт index.html, и worker обязан делать то же самое.
registerRoute(new NavigationRoute(createHandlerBoundToURL(`${scope.pathname}index.html`), {
  denylist: [new RegExp(`^${scope.pathname}api/`)],
}))

for (const kind of Object.keys(strategies) as CacheKind[]) {
  registerRoute(({ request, url }) => classifyRequest(request.method, url, scope) === kind, strategies[kind])
}

type PrefetchMessage = { type: 'prefetch'; tripId: string | null; token: string; urls: string[] }
type PrefetchTask = { tripId: string | null; token: string; cancelled: boolean }

let task: PrefetchTask | null = null

self.addEventListener('message', (event) => {
  const data = event.data as { type?: string } | null
  if (!data || typeof data !== 'object') return
  if (data.type === 'prefetch') event.waitUntil(prefetch(data as PrefetchMessage))
  if (data.type === 'clear-private') event.waitUntil(Promise.all(PRIVATE_CACHES.map((name) => caches.delete(name))))
})

/**
 * Кладёт один ресурс в его кэш.
 *
 * Токен подставляется только приватным эндпоинтам и живёт исключительно в
 * памяти worker-а: ни в кэш, ни в IndexedDB он не попадает.
 *
 * Ответ не-2xx не считается сбоем докачки: удалённый документ ронять всю
 * очередь не должен. Пробрасываются только настоящие сетевые ошибки и нехватка
 * места — на них останавливаться осмысленно.
 */
async function store(url: string, token: string) {
  const target = new URL(url, scope)
  const kind = classifyRequest('GET', target, scope)
  if (!kind) return
  const headers = new Headers()
  if (kind !== 'asset' && token) headers.set('Authorization', `Bearer ${token}`)
  let response: Response
  try {
    response = await fetch(target, { headers, credentials: 'same-origin' })
  } catch (reason) {
    setOnline(false)
    throw reason
  }
  setOnline(true)
  if (!response.ok) return
  const cache = await caches.open(CACHES[kind])
  await cache.put(target.toString(), response)
}

async function prefetch({ tripId, token, urls }: PrefetchMessage) {
  if (task) task.cancelled = true
  const current: PrefetchTask = { tripId, token, cancelled: false }
  task = current

  const pending: string[] = []
  let done = 0
  for (const url of urls) {
    const kind = classifyRequest('GET', new URL(url, scope), scope)
    if (!kind) continue
    const cache = await caches.open(CACHES[kind])
    if (await cache.match(url)) done += 1
    else pending.push(url)
  }
  if (current.cancelled) return

  const total = done + pending.length
  await broadcast({ type: 'prefetch-progress', tripId, done, total })
  if (!pending.length) { await broadcast({ type: 'prefetch-done', tripId }); if (task === current) task = null; return }

  let index = 0
  let blocked: 'quota' | 'network' | null = null
  // Два параллельных потока: больше не ускоряет мобильную сеть, но заметно
  // мешает обычным запросам страницы.
  const worker = async () => {
    while (!current.cancelled && !blocked) {
      const url = pending[index++]
      if (url === undefined) return
      try {
        await store(url, current.token)
      } catch (reason) {
        blocked = reason instanceof DOMException && reason.name === 'QuotaExceededError' ? 'quota' : 'network'
        return
      }
      done += 1
      await broadcast({ type: 'prefetch-progress', tripId, done, total })
    }
  }
  await Promise.all([worker(), worker()])

  if (current.cancelled) return
  if (blocked) await broadcast({ type: 'prefetch-blocked', tripId, reason: blocked })
  else await broadcast({ type: 'prefetch-done', tripId })
  if (task === current) task = null
}
```

- [ ] **Step 2: Проверить типы и сборку**

Run: `pnpm typecheck && pnpm build`
Expected: без ошибок

- [ ] **Step 3: Убедиться, что worker собрался целиком**

Run: `node -e "const s=require('fs').readFileSync('dist/sw.js','utf8'); for (const n of ['travel-media-v1','prefetch-progress','clear-private','Authorization']) if (!s.includes(n)) throw new Error('missing '+n); console.log('ok', s.length)"`
Expected: `ok <размер>`

- [ ] **Step 4: Коммит**

```bash
git add src/sw.ts
git commit -m "feat: cache trip resources in the service worker"
```

---

### Task 7: Мост между страницей и worker-ом

**Files:**
- Create: `src/offline/useOfflineCache.ts`

- [ ] **Step 1: Написать модуль**

```ts
import { useEffect, useRef, useState } from 'react'
import { session } from '../api'
import { cacheStateReducer, type CacheMessage, type CacheState } from './cacheState'

const supported = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator

async function activeWorker(): Promise<ServiceWorker | null> {
  if (!supported()) return null
  // getRegistration до ready: без зарегистрированного worker-а (в dev его нет)
  // navigator.serviceWorker.ready не резолвится никогда.
  const existing = await navigator.serviceWorker.getRegistration()
  if (!existing) return null
  const registration = await navigator.serviceWorker.ready
  return registration.active
}

/** Просит worker докачать список ресурсов. Новая задача отменяет предыдущую. */
export async function requestPrefetch(tripId: string | null, urls: string[]) {
  if (!urls.length) return
  const worker = await activeWorker()
  worker?.postMessage({ type: 'prefetch', tripId, token: session.token, urls })
}

/** Сносит приватные кэши при выходе из аккаунта. */
export async function clearPrivateCaches() {
  const worker = await activeWorker()
  worker?.postMessage({ type: 'clear-private' })
}

/**
 * Один раз просит браузер не вытеснять наш кэш. Для установленной PWA Chrome
 * выдаёт разрешение молча, в обычной вкладке — отказывает, и это не ошибка.
 */
export function keepStorage() {
  void navigator.storage?.persist?.().catch(() => undefined)
}

export function useOfflineCache(tripId: string | null) {
  const [state, setState] = useState<CacheState>({ kind: 'idle' })
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  const tripIdRef = useRef(tripId)
  tripIdRef.current = tripId

  // Два источника намеренно: события окна реагируют мгновенно на выключенный
  // Wi-Fi, а сообщения worker-а ловят случай «сеть есть, интернета нет».
  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  useEffect(() => {
    if (!supported()) return
    const onMessage = (event: MessageEvent) => {
      const data = event.data as (CacheMessage | { type: 'network'; online: boolean }) | null
      if (!data || typeof data !== 'object') return
      if (data.type === 'network') { setOnline(data.online); return }
      setState((current) => cacheStateReducer(current, data, tripIdRef.current))
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [])

  // Смена поездки обнуляет индикатор: прогресс прошлой к новой отношения не имеет.
  useEffect(() => { setState({ kind: 'idle' }) }, [tripId])

  return { state, online }
}
```

- [ ] **Step 2: Проверить типы**

Run: `pnpm typecheck`
Expected: без ошибок

- [ ] **Step 3: Коммит**

```bash
git add src/offline/useOfflineCache.ts
git commit -m "feat: bridge the page and the service worker"
```

---

### Task 8: Индикатор у названия поездки

**Files:**
- Create: `public/assets/icons/cloud-off.svg`
- Create: `src/components/CacheIndicator.tsx`
- Modify: `src/components/Icon.tsx:1`
- Modify: `src/styles.css`

- [ ] **Step 1: Добавить глиф**

Создать `public/assets/icons/cloud-off.svg` — Material Symbols Outlined `cloud_off`, приведённый к формату остальных иконок проекта:

```svg
<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF"><path d="M792-56 686-160H260q-92 0-156-64T40-380q0-77 47.5-137T210-594q3-8 6-15.5t6-16.5L56-792l56-56 736 736-56 56ZM260-240h346L284-562q-2 11-3 21t-1 21h-20q-58 0-99 41t-41 99q0 58 41 99t99 41Zm185-161Zm419 191-58-56q17-14 25.5-32.5T840-340q0-42-29-71t-71-29h-60v-80q0-83-58.5-141.5T480-720q-27 0-52 6.5T380-693l-58-58q35-24 74.5-36.5T480-800q117 0 198.5 81.5T760-520q69 8 114.5 59.5T920-340q0 39-15 72.5T864-210ZM593-479Z"/></svg>
```

- [ ] **Step 2: Объявить ключ иконки**

В `src/components/Icon.tsx` дописать `'cloud-off'` в union `IconName`:

```ts
export type IconName = 'link' | 'content-copy' | 'add-pin' | 'add-circle' | 'add-plus' | 'arrow-back' | 'attractions' | 'barefoot' | 'bus' | 'calendar-month' | 'casino' | 'check-small' | 'cloud-off' | 'time' | 'planet' | 'email' | 'encrypted' | 'refresh' | 'close' | 'edit-location' | 'pin-home' | 'image' | 'edit' | 'face' | 'hotel' | 'key' | 'delete-forever' | 'download' | 'upload-file' | 'docs' | 'plane' | 'rocket-launch' | 'sailing' | 'ticket' | 'train'
```

- [ ] **Step 3: Написать компонент**

Создать `src/components/CacheIndicator.tsx`:

```tsx
import { Icon } from './Icon'
import { cachePercent, type CacheState } from '../offline/cacheState'

// Кольцо рисуется штрихом по окружности: dasharray задаёт «закрашено / всего».
const RADIUS = 8
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const BLOCK_TITLES = {
  quota: 'Не хватило места, поездка сохранена не полностью',
  network: 'Докачка прервалась, продолжим при следующем открытии',
}

export function CacheIndicator({ state, online }: { state: CacheState; online: boolean }) {
  if (!online) {
    const title = 'Нет интернета — поездка открыта из кэша'
    return <span className="cache-indicator" title={title} role="img" aria-label={title}><Icon name="cloud-off" size={20} /></span>
  }
  if (state.kind !== 'prefetching' && state.kind !== 'blocked') return null
  const percent = cachePercent(state)
  const title = state.kind === 'blocked' ? BLOCK_TITLES[state.reason] : `Готовим поездку для оффлайна — ${percent}%`
  return (
    <span className={`cache-indicator${state.kind === 'blocked' ? ' is-blocked' : ''}`} title={title} role="img" aria-label={title}>
      <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true">
        <circle className="cache-indicator-track" cx="10" cy="10" r={RADIUS} />
        <circle className="cache-indicator-value" cx="10" cy="10" r={RADIUS} strokeDasharray={`${(CIRCUMFERENCE * percent) / 100} ${CIRCUMFERENCE}`} />
      </svg>
    </span>
  )
}
```

- [ ] **Step 4: Стили**

Дописать в конец `src/styles.css`:

```css
/* --- Индикатор оффлайн-кэша --- */

/* Индикатор стоит перед названием поездки внутри заголовка, поэтому
   выравнивается по тексту сдвигом, а не flex-ом: заголовок центрирован. */
.cache-indicator { display: inline-flex; vertical-align: -3px; margin-right: 8px; }
.cache-indicator .ui-icon { opacity: .6; }
.cache-indicator svg { transform-origin: center; animation: cache-indicator-spin 1.6s linear infinite; }
.cache-indicator circle { fill: none; stroke-width: 2; }
.cache-indicator-track { stroke: var(--color-background-secondary); }
.cache-indicator-value { stroke: #fff; transition: stroke-dasharray .2s linear; }
.cache-indicator.is-blocked svg { animation: none; transform: rotate(-90deg); }
.cache-indicator.is-blocked .cache-indicator-value { stroke: var(--color-text-secondary); }

/* Кольцо стартует с 12 часов, поэтому вращение идёт от -90deg. */
@keyframes cache-indicator-spin { from { transform: rotate(-90deg); } to { transform: rotate(270deg); } }

@media (prefers-reduced-motion: reduce) {
  .cache-indicator svg { animation: none; transform: rotate(-90deg); }
}
```

- [ ] **Step 5: Проверить типы**

Run: `pnpm typecheck`
Expected: без ошибок

- [ ] **Step 6: Коммит**

```bash
git add public/assets/icons/cloud-off.svg src/components/CacheIndicator.tsx src/components/Icon.tsx src/styles.css
git commit -m "feat: show cache progress and offline state by the trip name"
```

---

### Task 9: Встроить оффлайн в приложение

**Files:**
- Modify: `src/App.tsx` — `TripSidebar` (`:835`, `:855`), `Dashboard` (`:1291`, `:1304`), `App` (`:1382`), выход из аккаунта (`:1679`)

- [ ] **Step 1: Импорты**

В `src/App.tsx` добавить:

```ts
import { CacheIndicator } from './components/CacheIndicator'
import { tripResourceUrls, tripsListResourceUrls } from './offline/resources'
import { clearPrivateCaches, keepStorage, requestPrefetch, useOfflineCache } from './offline/useOfflineCache'
import type { CacheState } from './offline/cacheState'
```

- [ ] **Step 2: Провести состояние кэша до заголовка**

В сигнатуру `TripSidebar` добавить проп `cacheState` и `online`:

```tsx
function TripSidebar({ trip, user, tripCount, selectedCityId, readOnly = false, cacheState, online, onCity, onHotel, onTransport, onEdit, onInvite, onTrips, onProfile }: { trip: Trip; user: CurrentUser | null; tripCount: number; selectedCityId?: string | null; readOnly?: boolean; cacheState: CacheState; online: boolean; onCity: (city: City) => void; onHotel: (city: City) => void; onTransport: (city: City, direction: 'in' | 'out') => void; onEdit: () => void; onInvite: () => void; onTrips: () => void; onProfile: () => void }) {
```

и заменить заголовок:

```tsx
<TypographyGroup title={<><CacheIndicator state={cacheState} online={online} />{trip.name}</>} text={/* без изменений */} />
```

То же самое протянуть через `Dashboard`: добавить в его пропсы `cacheState: CacheState; online: boolean` и передать в `TripSidebar`.

- [ ] **Step 3: Подключить хук в `App`**

Рядом с остальными хуками `App`:

```tsx
const { state: cacheState, online } = useOfflineCache(trip?.id ?? null)
```

- [ ] **Step 4: Запускать докачку после загрузки поездки**

В конце `loadTrip`, сразу перед `return value`, добавить:

```tsx
  void requestPrefetch(id, [
    ...tripsListResourceUrls(trips, import.meta.env.BASE_URL),
    ...tripResourceUrls({ trip: result.trip, base: import.meta.env.BASE_URL, hasOwnAvatar: Boolean(currentUser?.hasAvatar) }),
  ])
```

В конце `loadPublicTrip`, перед `return value`:

```tsx
  void requestPrefetch(result.trip.id, tripResourceUrls({ trip: result.trip, base: import.meta.env.BASE_URL, hasOwnAvatar: false, publicToken: token }))
```

В `refreshTrips`, после `setTrips(...)`, когда поездка не открыта:

```tsx
  if (!trip) void requestPrefetch(null, tripsListResourceUrls(result.trips, import.meta.env.BASE_URL))
```

- [ ] **Step 5: Просить постоянное хранилище после входа**

В `loadCurrentUser`, сразу после `setCurrentUser(user)`:

```tsx
  keepStorage()
```

- [ ] **Step 6: Чистить приватные кэши при выходе**

В обработчике `onLogout` у `ProfileScreen`, первой строкой после `tripLoadSequenceRef.current += 1`:

```tsx
    void clearPrivateCaches()
```

- [ ] **Step 7: Оффлайн выключает правки**

В обоих местах рендера `Dashboard` передать состояние. В публичном режиме:

```tsx
return <Dashboard trip={trip} user={null} tripCount={0} readOnly cacheState={cacheState} online={online} /* остальные пропсы без изменений */ />
```

В основном режиме `readOnly` выводится из сети:

```tsx
return <><Dashboard trip={trip} user={currentUser} tripCount={trips.length} readOnly={!online} cacheState={cacheState} online={online} /* остальные пропсы без изменений */ ... />
```

- [ ] **Step 8: Проверить типы и тесты**

Run: `pnpm typecheck && pnpm test`
Expected: без ошибок, все тесты проходят

- [ ] **Step 9: Коммит**

```bash
git add src/App.tsx
git commit -m "feat: run offline caching and lock edits without network"
```

---

### Task 10: Точки и карта без интернета

Сейчас клик по точке в списке оффлайн не делает ничего: эффект фокуса начинается с `if (!map || !focusRequest) return`, выходит досрочно и не зовёт даже `onFocusHandled`, из-за чего `focusRequest` залипает.

**Files:**
- Modify: `src/components/PlacesMap.tsx:211-224` (эффект фокуса), `:246-275` (рендер)
- Modify: `src/styles.css`

- [ ] **Step 1: Развязать выбор точки и карту**

Заменить эффект центрирования:

```tsx
  // Центрирование на точке, выбранной в списке слева.
  //
  // Выбор точки намеренно не требует карты: оффлайн Google Maps не загрузится,
  // но посмотреть место и уйти в приложение карт по-прежнему нужно.
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
```

- [ ] **Step 2: Рисовать попап и заглушку, когда карты нет**

Заменить возвращаемую разметку:

```tsx
  return (
    <div className="places-map">
      <div ref={containerRef} className="google-map-picker" aria-label="Карта точек" />
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
          области. Редактирование оффлайн закрыто через readOnly, так что
          достаточно режима просмотра. */}
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
```

- [ ] **Step 3: Стили заглушки и открепленного попапа**

Дописать в `src/styles.css` в блок «Точки на карте»:

```css
/* Оффлайн Google Maps не загружается. Пустой прямоугольник выглядел бы
   поломкой, поэтому область карты прямо говорит, что происходит. */
.places-map-fallback { position: absolute; inset: 0; margin: 0; display: grid; place-items: center; padding: 24px; text-align: center; color: var(--color-text-secondary); }
.places-map-detached-popup { position: absolute; inset: 0; display: grid; place-items: center; padding: 16px; }
```

- [ ] **Step 4: Проверить типы и сборку**

Run: `pnpm typecheck && pnpm build`
Expected: без ошибок

- [ ] **Step 5: Коммит**

```bash
git add src/components/PlacesMap.tsx src/styles.css
git commit -m "fix: open a place from the list without the map"
```

---

### Task 11: Проверка в браузере и документация

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Прогнать всё**

Run: `pnpm typecheck && pnpm test && pnpm build && pnpm build:api`
Expected: без ошибок

- [ ] **Step 2: Поднять собранное приложение**

```bash
pnpm preview
```

API должен быть запущен отдельно (`pnpm dev:api`) — `preview` проксирует на него `/travel/api`.

- [ ] **Step 3: Проверить сценарий**

1. Открыть `/travel/`, войти, открыть поездку. В DevTools → Application → Service Workers виден worker со scope `/travel/`.
2. У названия поездки крутится кольцо и исчезает по завершении докачки. В Application → Cache Storage лежат `travel-assets-v1`, `travel-data-v1`, `travel-media-v1`, `travel-avatars-v1`.
3. Network → Offline, перезагрузить: поездка открывается, фон и картинки городов на месте, аватары видны, билет и бронь скачиваются.
4. Оффлайн у названия поездки — иконка `cloud-off`, кнопки правок недоступны.
5. Оффлайн клик по точке в списке открывает попап; ссылка ведёт на `google.com/maps/search/?api=1&query=<координаты>`.
6. Вернуть сеть, выйти из аккаунта: `travel-data-v1`, `travel-media-v1`, `travel-avatars-v1` исчезли, `travel-assets-v1` остался.

- [ ] **Step 4: Записать устойчивые правила в `AGENTS.md`**

Добавить раздел `## Оффлайн и PWA` после `## Развёртывание`:

```markdown
## Оффлайн и PWA

Приложение устанавливается как PWA; service worker собирается `vite-plugin-pwa` в режиме `injectManifest` из `src/sw.ts` и работает под scope `/travel/`. Префикс берётся из `self.registration.scope`, а не из константы: он уже задан в `vite.config.ts` и в конфиге API.

Кэшей четыре плюс precache оболочки: `travel-assets-v1` (CacheFirst для `/travel/assets/**`), `travel-data-v1` (NetworkFirst для GET-эндпоинтов API), `travel-media-v1` (CacheFirst для документов — документ по id неизменяем) и `travel-avatars-v1` (StaleWhileRevalidate). Крупные картинки в precache не идут: `autumn-garden.jpg` весит 5.4 МБ, его забирает фоновая докачка.

Список ресурсов поездки строит клиент чистой функцией `tripResourceUrls` и отправляет worker-у сообщением вместе с токеном; worker качает по два файла и шлёт назад прогресс. Токен живёт только в памяти worker-а. При выходе из аккаунта клиент шлёт `clear-private`, и приватные кэши удаляются: ключ Cache API — это URL, а не токен.

Оффлайн приложение работает только на чтение и переиспользует существующий сквозной проп `readOnly`. Очереди отложенных правок нет.

Ссылка на место строится `placeMapsHref`: при известных координатах — форма Maps URLs API `google.com/maps/search/?api=1&query=<lat>,<lng>`. Сохранённые короткие ссылки `maps.app.goo.gl` без сети не разворачиваются, а координатная форма открывает приложение карт локально.

Новый worker не вызывает `skipWaiting`: он берёт управление при следующем холодном старте, чтобы не перезагрузить страницу посреди незакрытой формы.
```

- [ ] **Step 5: Коммит**

```bash
git add AGENTS.md
git commit -m "docs: record offline and PWA rules"
```
