# Точки на карте — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить форму добавления места под картой на добавление точек прямо с карты — клик ставит пин с плюсиком, тултип создаёт точку с иконкой и датой, список дней получает drag-n-drop, на карте появляется поиск мест.

**Architecture:** Точка остаётся строкой в `places`, привязанной к городу, и получает поле `icon`. Чистая логика перестановки позиций выносится из эндпоинта в отдельный модуль и покрывается тестами. Карта переписывается на `AdvancedMarkerElement` с Map ID: маркер — обычный DOM-элемент, тултип — React-портал в кастомном `OverlayView`. Список дней уезжает из `CityPanel` в свой компонент на `@dnd-kit`.

**Tech Stack:** React 19 + Vite + TypeScript, Fastify + PostgreSQL (`pg`), Google Maps JavaScript API (`marker` и `places`), Places API (New), `@dnd-kit`, Vitest.

**Спека:** [docs/superpowers/specs/2026-09-19-map-places-design.md](../specs/2026-09-19-map-places-design.md)

---

## Структура файлов

**Создаются**

| Файл | Ответственность |
|---|---|
| `apps/api/src/places.ts` | Белый список иконок и чистая функция перестановки позиций. Без обращений к базе |
| `apps/api/src/places.test.ts` | Тесты этих двух вещей |
| `apps/api/src/migrations/020_place_icons.sql` | Колонка `icon` |
| `src/placeIcons.ts` | Каталог из восьми иконок и сопоставление типов Google с ключом иконки |
| `src/placeIcons.test.ts` | Тесты сопоставления |
| `src/components/MapOverlay.tsx` | Позиционирует React-портал в заданной координате карты. Одна задача |
| `src/components/PlacePopup.tsx` | Тултип в режимах просмотра, добавления и редактирования |
| `src/components/MapSearch.tsx` | Поле поиска и подсказки Places |
| `src/components/PlacesMap.tsx` | Карта, маркеры, черновой пин, сборка тултипа и поиска |
| `src/components/PlaceDayList.tsx` | Список дней, активный день, drag-n-drop |
| `vitest.config.ts` | Один конфиг на клиентские и серверные тесты |
| `public/assets/icons/{place,restaurant,local-cafe,shopping-bag,park,directions-transit}.svg` | Глифы иконок |

**Меняются**

| Файл | Что |
|---|---|
| `apps/api/src/server.ts` | `icon` в POST и PATCH, сброс даты в NULL, права, DELETE, move, экспорт и импорт |
| `src/api.ts` | Тип `ApiPlace`, сигнатуры `createPlace` и `updatePlace`, новые `deletePlace` и `movePlace` |
| `src/App.tsx` | `CityPanel` теряет `route-form`, получает активный день; новые обработчики удаления и переноса |
| `src/styles.css` | Стили маркера, тултипа, поиска, перетаскивания; удаление `.route-form` |
| `package.json`, `apps/api/package.json` | Зависимости и скрипт `test` |
| `.env.example`, `Dockerfile`, `compose.yaml` | `VITE_GOOGLE_MAPS_MAP_ID` |
| `AGENTS.md` | Фиксация новых правил |

**Удаляется:** `src/components/GoogleMapPicker.tsx`.

---

## Task 1: Тестовая инфраструктура

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Поставить Vitest**

```bash
pnpm add -D -w vitest
```

- [ ] **Step 2: Создать конфиг**

Создать `vitest.config.ts`. Один конфиг покрывает и клиентские, и серверные тесты — серверные тесты чистые, базы не требуют.

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'apps/api/src/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: Добавить скрипт в корневой `package.json`**

В блок `"scripts"` рядом с `"typecheck"`:

```json
"test": "vitest run",
```

- [ ] **Step 4: Проверить, что раннер стартует**

Run: `pnpm test`
Expected: `No test files found` и нулевой код возврата. Раннер найден, тестов пока нет.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore: add vitest for pure logic tests"
```

---

## Task 2: Белый список иконок на сервере

**Files:**
- Create: `apps/api/src/places.ts`
- Create: `apps/api/src/places.test.ts`

- [ ] **Step 1: Написать падающий тест**

Создать `apps/api/src/places.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { PLACE_ICONS, normalizePlaceIcon } from './places.js'

describe('normalizePlaceIcon', () => {
  it('содержит ровно восемь ключей', () => {
    expect(PLACE_ICONS).toEqual(['default', 'sightseeing', 'food', 'cafe', 'hotel', 'shopping', 'nature', 'transport'])
  })

  it('пропускает известный ключ', () => {
    expect(normalizePlaceIcon('food')).toBe('food')
  })

  it('подставляет default, когда значение не передано', () => {
    expect(normalizePlaceIcon(undefined)).toBe('default')
    expect(normalizePlaceIcon('')).toBe('default')
    expect(normalizePlaceIcon(null)).toBe('default')
  })

  it('возвращает undefined для неизвестного ключа', () => {
    expect(normalizePlaceIcon('casino')).toBeUndefined()
    expect(normalizePlaceIcon(42)).toBeUndefined()
  })
})
```

Отличие `default` от `undefined` важно: отсутствующее значение — это норма и превращается в `default`, а присланная чушь должна давать 400, а не молча становиться базовой иконкой.

- [ ] **Step 2: Запустить и убедиться, что падает**

Run: `pnpm test`
Expected: FAIL, `Failed to resolve import "./places.js"`.

- [ ] **Step 3: Реализовать**

Создать `apps/api/src/places.ts`:

```ts
export const PLACE_ICONS = ['default', 'sightseeing', 'food', 'cafe', 'hotel', 'shopping', 'nature', 'transport'] as const

export type PlaceIcon = (typeof PLACE_ICONS)[number]

// Отсутствие значения — это не ошибка, а базовая иконка. Неизвестная строка —
// ошибка, поэтому у неё отдельный результат, который вызывающий код превращает в 400.
export function normalizePlaceIcon(value: unknown): PlaceIcon | undefined {
  if (value === undefined || value === null || value === '') return 'default'
  return PLACE_ICONS.includes(value as PlaceIcon) ? (value as PlaceIcon) : undefined
}
```

- [ ] **Step 4: Запустить и убедиться, что проходит**

Run: `pnpm test`
Expected: PASS, 4 теста.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/places.ts apps/api/src/places.test.ts
git commit -m "feat(api): add place icon whitelist"
```

---

## Task 3: Чистая логика перестановки точек

Это единственное место с настоящим алгоритмическим риском: один drop меняет позиции сразу в двух днях. Логика живёт отдельно от базы, чтобы её можно было тестировать.

**Files:**
- Modify: `apps/api/src/places.ts`
- Modify: `apps/api/src/places.test.ts`

- [ ] **Step 1: Написать падающие тесты**

Дописать в `apps/api/src/places.test.ts`:

```ts
import { reorderPlaces } from './places.js'

type Row = { id: string; visit_date: string | null; position: number }

const rows: Row[] = [
  { id: 'a', visit_date: '2026-05-01', position: 0 },
  { id: 'b', visit_date: '2026-05-01', position: 1 },
  { id: 'c', visit_date: '2026-05-01', position: 2 },
  { id: 'd', visit_date: '2026-05-02', position: 0 },
  { id: 'e', visit_date: null, position: 0 },
]

const order = (result: Row[], date: string | null) =>
  result.filter((row) => row.visit_date === date).sort((l, r) => l.position - r.position).map((row) => row.id)

describe('reorderPlaces', () => {
  it('меняет порядок внутри одного дня', () => {
    const result = reorderPlaces(rows, 'a', '2026-05-01', 2)
    expect(order(result, '2026-05-01')).toEqual(['b', 'c', 'a'])
  })

  it('переносит точку в другой день на указанную позицию', () => {
    const result = reorderPlaces(rows, 'a', '2026-05-02', 0)
    expect(order(result, '2026-05-02')).toEqual(['a', 'd'])
    expect(order(result, '2026-05-01')).toEqual(['b', 'c'])
  })

  it('не оставляет дыр в позициях исходного дня', () => {
    const result = reorderPlaces(rows, 'b', '2026-05-02', 1)
    const source = result.filter((row) => row.visit_date === '2026-05-01').map((row) => row.position).sort()
    expect(source).toEqual([0, 1])
  })

  it('переносит точку в день без даты', () => {
    const result = reorderPlaces(rows, 'a', null, 0)
    expect(order(result, null)).toEqual(['a', 'e'])
  })

  it('переносит точку из дня без даты в датированный день', () => {
    const result = reorderPlaces(rows, 'e', '2026-05-01', 1)
    expect(order(result, '2026-05-01')).toEqual(['a', 'e', 'b', 'c'])
    expect(order(result, null)).toEqual([])
  })

  it('прижимает позицию больше длины дня к концу', () => {
    const result = reorderPlaces(rows, 'd', '2026-05-01', 99)
    expect(order(result, '2026-05-01')).toEqual(['a', 'b', 'c', 'd'])
  })

  it('прижимает отрицательную позицию к началу', () => {
    const result = reorderPlaces(rows, 'd', '2026-05-01', -5)
    expect(order(result, '2026-05-01')).toEqual(['d', 'a', 'b', 'c'])
  })

  it('нормализует позиции с дырами во входных данных', () => {
    const gapped: Row[] = [
      { id: 'x', visit_date: '2026-05-01', position: 4 },
      { id: 'y', visit_date: '2026-05-01', position: 9 },
    ]
    const result = reorderPlaces(gapped, 'y', '2026-05-01', 0)
    expect(result.map((row) => row.position).sort()).toEqual([0, 1])
    expect(order(result, '2026-05-01')).toEqual(['y', 'x'])
  })

  it('возвращает только затронутые дни', () => {
    const result = reorderPlaces(rows, 'a', '2026-05-02', 0)
    expect(result.some((row) => row.visit_date === null)).toBe(false)
  })

  it('бросает ошибку для неизвестной точки', () => {
    expect(() => reorderPlaces(rows, 'zzz', '2026-05-01', 0)).toThrow()
  })
})
```

- [ ] **Step 2: Запустить и убедиться, что падает**

Run: `pnpm test`
Expected: FAIL, `reorderPlaces is not a function` либо ошибка импорта.

- [ ] **Step 3: Реализовать**

Дописать в `apps/api/src/places.ts`:

```ts
export type OrderedPlace = { id: string; visit_date: string | null; position: number }

// Ключ дня: null и пустая строка должны схлопываться в одно ведро «без даты»,
// поэтому сравниваем не сами значения, а нормализованный ключ.
const dayKey = (value: string | null) => value ?? ''

/**
 * Возвращает новые значения visit_date и position для точек тех дней, которых
 * коснулся перенос. Дни, не участвующие в переносе, не возвращаются — их незачем
 * переписывать в базе.
 */
export function reorderPlaces<T extends OrderedPlace>(
  places: readonly T[],
  placeId: string,
  targetDate: string | null,
  targetPosition: number,
): OrderedPlace[] {
  const moved = places.find((place) => place.id === placeId)
  if (!moved) throw new Error(`Точка ${placeId} не найдена среди мест города`)

  const sourceKey = dayKey(moved.visit_date)
  const targetKey = dayKey(targetDate)

  const bucket = (key: string) =>
    places
      .filter((place) => dayKey(place.visit_date) === key)
      // id как вторичный ключ сортировки: позиции в базе могут дублироваться,
      // и без него порядок оказался бы недетерминированным.
      .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id))
      .map((place) => place.id)

  const source = bucket(sourceKey)
  const target = sourceKey === targetKey ? source : bucket(targetKey)

  source.splice(source.indexOf(placeId), 1)
  target.splice(Math.max(0, Math.min(targetPosition, target.length)), 0, placeId)

  const renumber = (ids: string[], date: string | null) =>
    ids.map((id, index) => ({ id, visit_date: date, position: index }))

  return sourceKey === targetKey
    ? renumber(target, targetDate)
    : [...renumber(source, moved.visit_date), ...renumber(target, targetDate)]
}
```

- [ ] **Step 4: Запустить и убедиться, что проходит**

Run: `pnpm test`
Expected: PASS, 14 тестов.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/places.ts apps/api/src/places.test.ts
git commit -m "feat(api): add pure place reordering logic"
```

---

## Task 4: Миграция колонки icon

**Files:**
- Create: `apps/api/src/migrations/020_place_icons.sql`

- [ ] **Step 1: Создать миграцию**

```sql
ALTER TABLE places ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT 'default';
```

- [ ] **Step 2: Применить на локальной базе**

```bash
pnpm db:up
pnpm db:migrate
```

Expected: миграция `020_place_icons` применена без ошибок.

- [ ] **Step 3: Проверить, что старые точки получили значение**

```bash
docker compose exec -T postgres psql -U travel -d travel -c "SELECT icon, count(*) FROM places GROUP BY icon;"
```

Expected: все существующие строки в группе `default`. Если таблица пуста — пустой результат, это тоже успех.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/migrations/020_place_icons.sql
git commit -m "feat(api): add icon column to places"
```

---

## Task 5: Иконка и сброс даты в эндпоинтах точек

**Files:**
- Modify: `apps/api/src/server.ts` (POST `/trips/:tripId/cities/:cityId/places`, PATCH `/trips/:tripId/places/:placeId`)

- [ ] **Step 1: Импортировать модуль точек**

К импортам `apps/api/src/server.ts` добавить:

```ts
import { normalizePlaceIcon, reorderPlaces } from './places.js'
```

И убедиться, что `transaction` уже импортируется из `./db.js` — он понадобится в Task 7:

```ts
import { db, transaction } from './db.js'
```

`reorderPlaces` понадобится в Task 7, но импорт делается один раз.

- [ ] **Step 2: Вынести проверку даты в helper**

Проверка «дата внутри дат города» нужна в трёх местах: POST, PATCH и move. Рядом с `validatedCityAssignees` в `apps/api/src/server.ts` добавить:

```ts
async function assertVisitDateInCity(tripId: string, cityId: string, visitDate: string) {
  const city = (await db.query<{ arrival_date: string; departure_date: string }>(
    'SELECT arrival_date::text, departure_date::text FROM cities WHERE id=$1 AND trip_id=$2', [cityId, tripId])).rows[0]
  if (!city) throw httpError(404, 'Город не найден')
  if (!datePattern.test(visitDate) || visitDate < city.arrival_date || visitDate > city.departure_date) {
    throw httpError(400, 'Дата места должна быть внутри дат города')
  }
}
```

- [ ] **Step 3: Принять icon в POST**

В обработчике `POST .../cities/:cityId/places`, после строки с `if (!name) throw httpError(400, 'Название места обязательно')`, добавить:

```ts
const icon = normalizePlaceIcon(body.icon)
if (!icon) throw httpError(400, 'Неизвестная иконка места')
```

В `INSERT` добавить колонку `icon` и параметр:

```ts
const result = await db.query(
  `INSERT INTO places(trip_id,city_id,visit_date,name,google_maps_url,latitude,longitude,position,icon,created_by)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
  [tripId, cityId, visitDate, name, text(body.googleMapsUrl), latitude ?? null, longitude ?? null, position, icon, user.id],
)
```

В том же обработчике заменить существующую inline-проверку города и даты на:

```ts
const city = (await db.query('SELECT id FROM cities WHERE id=$1 AND trip_id=$2', [cityId, tripId])).rows[0]
if (!city) throw httpError(404, 'Город не найден')
if (visitDate) await assertVisitDateInCity(tripId, cityId, visitDate)
```

- [ ] **Step 4: Переписать PATCH**

Заменить тело обработчика `PATCH /trips/:tripId/places/:placeId` целиком:

```ts
app.patch(`${apiPrefix}/trips/:tripId/places/:placeId`, async (request) => {
  const user = await requireUser(request)
  const { tripId, placeId } = request.params as { tripId: string; placeId: string }
  await requireTripRole(tripId, user.id)
  const place = (await db.query('SELECT * FROM places WHERE id=$1 AND trip_id=$2', [placeId, tripId])).rows[0]
  if (!place) throw httpError(404, 'Место не найдено')
  const body = bodyOf(request.body)
  const latitude = optionalCoordinate(body.latitude, -90, 90)
  const longitude = optionalCoordinate(body.longitude, -180, 180)
  if ((latitude === undefined) !== (longitude === undefined)) throw httpError(400, 'Широта и долгота должны быть указаны вместе')
  const icon = 'icon' in body ? normalizePlaceIcon(body.icon) : undefined
  if ('icon' in body && !icon) throw httpError(400, 'Неизвестная иконка места')
  // coalesce не различает «поле не прислали» и «прислали null», поэтому дату
  // разбираем отдельно: без этого точку невозможно вернуть в «Без даты».
  const visitDateGiven = 'visitDate' in body
  const visitDate = visitDateGiven ? (optionalText(body.visitDate) || null) : undefined
  if (visitDate) await assertVisitDateInCity(tripId, place.city_id, visitDate)
  const result = await db.query(
    `UPDATE places SET name=coalesce($3,name), google_maps_url=coalesce($4,google_maps_url),
       visit_date=CASE WHEN $5 THEN $6 ELSE visit_date END,
       position=coalesce($7,position), latitude=coalesce($8,latitude), longitude=coalesce($9,longitude),
       icon=coalesce($10,icon), updated_at=now()
     WHERE id=$1 AND trip_id=$2 RETURNING *`,
    [placeId, tripId, optionalText(body.name), optionalText(body.googleMapsUrl), visitDateGiven, visitDate ?? null,
     Number.isInteger(body.position) ? body.position : null, latitude ?? null, longitude ?? null, icon ?? null],
  )
  return { place: result.rows[0] }
})
```

Проверка `role !== 'owner' && place.created_by !== user.id` удалена намеренно: по решению из спеки точки правит любой участник поездки, иначе участник не смог бы перетащить чужую точку.

- [ ] **Step 5: Проверить типы**

Run: `pnpm --dir apps/api typecheck`
Expected: без ошибок.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/server.ts
git commit -m "feat(api): accept place icon and allow clearing visit date"
```

---

## Task 6: Удаление точки

**Files:**
- Modify: `apps/api/src/server.ts`

- [ ] **Step 1: Добавить эндпоинт**

Сразу после обработчика `PATCH /trips/:tripId/places/:placeId`:

```ts
app.delete(`${apiPrefix}/trips/:tripId/places/:placeId`, async (request, reply) => {
  const user = await requireUser(request)
  const { tripId, placeId } = request.params as { tripId: string; placeId: string }
  await requireTripRole(tripId, user.id)
  const result = await db.query('DELETE FROM places WHERE id=$1 AND trip_id=$2 RETURNING id', [placeId, tripId])
  if (result.rowCount === 0) throw httpError(404, 'Место не найдено')
  reply.code(204)
})
```

- [ ] **Step 2: Проверить типы**

Run: `pnpm --dir apps/api typecheck`
Expected: без ошибок.

- [ ] **Step 3: Проверить вручную**

Поднять API (`pnpm dev:api`) и выполнить запрос с токеном действующего пользователя:

```bash
curl -i -X DELETE "http://localhost:3000/api/trips/$TRIP/places/$PLACE" -H "Authorization: Bearer $TOKEN"
```

Expected: `HTTP/1.1 204`. Повторный запрос — `404` с телом `{"error":"Место не найдено"}`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/server.ts
git commit -m "feat(api): add place deletion endpoint"
```

---

## Task 7: Перенос точки между днями

**Files:**
- Modify: `apps/api/src/server.ts`

- [ ] **Step 1: Добавить эндпоинт**

После обработчика `DELETE .../places/:placeId`:

```ts
app.patch(`${apiPrefix}/trips/:tripId/places/:placeId/move`, async (request) => {
  const user = await requireUser(request)
  const { tripId, placeId } = request.params as { tripId: string; placeId: string }
  await requireTripRole(tripId, user.id)
  const body = bodyOf(request.body)
  const position = Number(body.position)
  if (!Number.isInteger(position) || position < 0) throw httpError(400, 'Некорректная позиция точки')
  const visitDate = optionalText(body.visitDate) || null
  const place = (await db.query('SELECT city_id FROM places WHERE id=$1 AND trip_id=$2', [placeId, tripId])).rows[0]
  if (!place) throw httpError(404, 'Место не найдено')
  if (visitDate) await assertVisitDateInCity(tripId, place.city_id, visitDate)

  await transaction(async (client) => {
    // FOR UPDATE держит строки города до конца транзакции: без блокировки два
    // одновременных переноса могли бы разъехаться в перенумерации позиций.
    const current = await client.query(
      'SELECT id, visit_date::text, position FROM places WHERE city_id=$1 FOR UPDATE', [place.city_id])
    for (const update of reorderPlaces(current.rows, placeId, visitDate, position)) {
      await client.query('UPDATE places SET visit_date=$2, position=$3, updated_at=now() WHERE id=$1',
        [update.id, update.visit_date, update.position])
    }
  })

  const places = await db.query(
    'SELECT * FROM places WHERE city_id=$1 ORDER BY visit_date NULLS FIRST, position', [place.city_id])
  return { places: places.rows }
})
```

- [ ] **Step 2: Проверить типы**

Run: `pnpm --dir apps/api typecheck`
Expected: без ошибок.

- [ ] **Step 3: Проверить вручную**

```bash
curl -s -X PATCH "http://localhost:3000/api/trips/$TRIP/places/$PLACE/move" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"visitDate":null,"position":0}' | head -c 300
```

Expected: JSON с полем `places`, в котором у перенесённой точки `visit_date: null` и `position: 0`, а позиции остальных точек прежнего дня идут подряд без дыр.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/server.ts
git commit -m "feat(api): add place move endpoint"
```

---

## Task 8: Иконка в экспорте и импорте

**Files:**
- Modify: `apps/api/src/server.ts` (экспорт около строки 398, импорт около строки 262)

- [ ] **Step 1: Добавить icon в экспорт**

В обработчике экспорта, в `places.rows.map(...)`, добавить поле в конец объекта:

```ts
places: places.rows.map((place) => ({ cityId: place.city_id, visitDate: place.visit_date ? String(place.visit_date).slice(0,10) : null, name: place.name, googleMapsUrl: place.google_maps_url, latitude: place.latitude, longitude: place.longitude, position: place.position, icon: place.icon })),
```

- [ ] **Step 2: Прочитать icon при импорте**

В цикле `for (const source of bundle.places)` перед `INSERT` добавить:

```ts
// В файлах, снятых до появления иконок, поля нет — это норма, берём базовую.
const placeIcon = normalizePlaceIcon(source.icon)
if (!placeIcon) throw httpError(400, 'Неизвестная иконка места в файле поездки')
```

И расширить сам `INSERT`:

```ts
await client.query(
  `INSERT INTO places(trip_id,city_id,visit_date,name,google_maps_url,latitude,longitude,position,icon,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
  [createdTrip.id, cityId, visitDate, text(source.name), text(source.googleMapsUrl), optionalCoordinate(source.latitude, -90, 90) ?? null, optionalCoordinate(source.longitude, -180, 180) ?? null, Number.isInteger(source.position) ? source.position : 0, placeIcon, user.id],
)
```

- [ ] **Step 3: Проверить типы**

Run: `pnpm --dir apps/api typecheck`
Expected: без ошибок.

- [ ] **Step 4: Проверить круговой сценарий**

Экспортировать поездку с точками через интерфейс, импортировать обратно, открыть город. Иконки точек должны совпадать с исходными.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/server.ts
git commit -m "feat(api): carry place icons through export and import"
```

---

## Task 9: Глифы иконок

**Files:**
- Create: `public/assets/icons/place.svg`, `restaurant.svg`, `local-cafe.svg`, `shopping-bag.svg`, `park.svg`, `directions-transit.svg`

- [ ] **Step 1: Скачать и нормализовать**

Material Symbols отдаёт SVG без заливки и с размерами без `px`, а иконки проекта используют `fill="#FFFFFF"` и `24px`. Приводим к общему виду:

```bash
cd public/assets/icons
for pair in place:place restaurant:restaurant local_cafe:local-cafe shopping_bag:shopping-bag park:park directions_transit:directions-transit; do
  src="${pair%%:*}"; out="${pair##*:}"
  curl -sf "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/$src/default/24px.svg" \
    | sed -e 's/height="24"/height="24px"/' -e 's/width="24"/width="24px"/' -e 's|<path |<path fill="#FFFFFF" |' \
    > "$out.svg"
done
```

- [ ] **Step 2: Проверить результат**

```bash
cd public/assets/icons && head -c 120 place.svg && echo && grep -c 'fill="#FFFFFF"' place.svg restaurant.svg local-cafe.svg shopping-bag.svg park.svg directions-transit.svg
```

Expected: у каждого файла `viewBox="0 -960 960 960"`, `height="24px"`, `width="24px"` и ровно одно вхождение заливки.

- [ ] **Step 3: Commit**

```bash
git add public/assets/icons
git commit -m "feat: add place category icons"
```

---

## Task 10: Каталог иконок на клиенте

**Files:**
- Create: `src/placeIcons.ts`
- Create: `src/placeIcons.test.ts`

- [ ] **Step 1: Написать падающий тест**

Создать `src/placeIcons.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { PLACE_ICON_OPTIONS, iconForGoogleTypes } from './placeIcons'

describe('PLACE_ICON_OPTIONS', () => {
  it('описывает восемь вариантов с подписями и файлами', () => {
    expect(PLACE_ICON_OPTIONS).toHaveLength(8)
    expect(PLACE_ICON_OPTIONS[0]).toEqual({ key: 'default', label: 'Базовая', file: 'place' })
    expect(PLACE_ICON_OPTIONS.every((option) => option.label && option.file)).toBe(true)
  })
})

describe('iconForGoogleTypes', () => {
  it('узнаёт заведения', () => {
    expect(iconForGoogleTypes(['restaurant'])).toBe('food')
    expect(iconForGoogleTypes(['cafe'])).toBe('cafe')
    expect(iconForGoogleTypes(['lodging'])).toBe('hotel')
    expect(iconForGoogleTypes(['shopping_mall'])).toBe('shopping')
    expect(iconForGoogleTypes(['park'])).toBe('nature')
    expect(iconForGoogleTypes(['subway_station'])).toBe('transport')
    expect(iconForGoogleTypes(['museum'])).toBe('sightseeing')
  })

  it('берёт первый распознанный тип из списка', () => {
    expect(iconForGoogleTypes(['point_of_interest', 'establishment', 'cafe'])).toBe('cafe')
  })

  it('падает в базовую иконку для незнакомого набора', () => {
    expect(iconForGoogleTypes(['establishment'])).toBe('default')
    expect(iconForGoogleTypes([])).toBe('default')
    expect(iconForGoogleTypes(undefined)).toBe('default')
  })
})
```

- [ ] **Step 2: Запустить и убедиться, что падает**

Run: `pnpm test`
Expected: FAIL, не найден модуль `./placeIcons`.

- [ ] **Step 3: Реализовать**

Создать `src/placeIcons.ts`:

```ts
export type PlaceIconKey = 'default' | 'sightseeing' | 'food' | 'cafe' | 'hotel' | 'shopping' | 'nature' | 'transport'

export type PlaceIconOption = { key: PlaceIconKey; label: string; file: string }

// Порядок задаёт порядок кнопок в тултипе, поэтому базовая идёт первой.
export const PLACE_ICON_OPTIONS: PlaceIconOption[] = [
  { key: 'default', label: 'Базовая', file: 'place' },
  { key: 'sightseeing', label: 'Посмотреть', file: 'attractions' },
  { key: 'food', label: 'Поесть', file: 'restaurant' },
  { key: 'cafe', label: 'Кофе', file: 'local-cafe' },
  { key: 'hotel', label: 'Отель', file: 'hotel' },
  { key: 'shopping', label: 'Шопинг', file: 'shopping-bag' },
  { key: 'nature', label: 'Природа', file: 'park' },
  { key: 'transport', label: 'Транспорт', file: 'directions-transit' },
]

const iconFiles = new Map(PLACE_ICON_OPTIONS.map((option) => [option.key, option.file]))

export const placeIconFile = (key: PlaceIconKey) => iconFiles.get(key) ?? 'place'

export const placeIconUrl = (key: PlaceIconKey) => `${import.meta.env.BASE_URL}assets/icons/${placeIconFile(key)}.svg`

const googleTypeIcons: Record<string, PlaceIconKey> = {
  restaurant: 'food', meal_takeaway: 'food', meal_delivery: 'food', bakery: 'food',
  cafe: 'cafe', coffee_shop: 'cafe', bar: 'cafe',
  lodging: 'hotel', hotel: 'hotel', guest_house: 'hotel',
  store: 'shopping', shopping_mall: 'shopping', department_store: 'shopping', supermarket: 'shopping',
  park: 'nature', natural_feature: 'nature', campground: 'nature', beach: 'nature',
  train_station: 'transport', subway_station: 'transport', bus_station: 'transport',
  airport: 'transport', transit_station: 'transport', light_rail_station: 'transport',
  tourist_attraction: 'sightseeing', museum: 'sightseeing', art_gallery: 'sightseeing',
  church: 'sightseeing', place_of_worship: 'sightseeing', zoo: 'sightseeing', aquarium: 'sightseeing',
}

// Google отдаёт типы от частного к общему, поэтому берём первое совпадение:
// у кафе список выглядит как ['cafe','food','point_of_interest','establishment'].
export function iconForGoogleTypes(types: readonly string[] | undefined): PlaceIconKey {
  for (const type of types ?? []) {
    const icon = googleTypeIcons[type]
    if (icon) return icon
  }
  return 'default'
}
```

- [ ] **Step 4: Запустить и убедиться, что проходит**

Run: `pnpm test`
Expected: PASS, 18 тестов.

- [ ] **Step 5: Commit**

```bash
git add src/placeIcons.ts src/placeIcons.test.ts
git commit -m "feat: add place icon catalog"
```

---

## Task 11: Клиентский API

**Files:**
- Modify: `src/api.ts`

- [ ] **Step 1: Расширить тип точки**

В начало `src/api.ts` добавить импорт и расширить `ApiPlace`:

```ts
import type { PlaceIconKey } from './placeIcons'
```

```ts
export type ApiPlace = {
  id: string
  city_id: string
  visit_date: string | null
  name: string
  google_maps_url: string
  latitude: number | null
  longitude: number | null
  position: number
  icon: PlaceIconKey
}
```

- [ ] **Step 2: Обновить методы**

Заменить `createPlace` и `updatePlace` и добавить два новых метода:

```ts
createPlace: (tripId: string, cityId: string, value: { name: string; googleMapsUrl: string; visitDate?: string; latitude?: number; longitude?: number; icon?: PlaceIconKey }) => request<{ place: ApiPlace }>(`/trips/${tripId}/cities/${cityId}/places`, json('POST', value)),
updatePlace: (tripId: string, placeId: string, value: { name?: string; googleMapsUrl?: string; visitDate?: string | null; latitude?: number; longitude?: number; icon?: PlaceIconKey }) => request<{ place: ApiPlace }>(`/trips/${tripId}/places/${placeId}`, json('PATCH', value)),
deletePlace: (tripId: string, placeId: string) => request<void>(`/trips/${tripId}/places/${placeId}`, { method: 'DELETE' }),
movePlace: (tripId: string, placeId: string, value: { visitDate: string | null; position: number }) => request<{ places: ApiPlace[] }>(`/trips/${tripId}/places/${placeId}/move`, json('PATCH', value)),
```

`visitDate?: string | null` здесь принципиален: `undefined` означает «не трогать дату», `null` — «убрать дату». `JSON.stringify` выбрасывает `undefined` из тела, поэтому сервер эти случаи различит.

- [ ] **Step 3: Проверить типы**

Run: `pnpm typecheck`
Expected: ошибки только в `src/App.tsx` о том, что у литералов `Place` нет поля `icon` — их закрывает Task 16. Ошибок в самом `src/api.ts` быть не должно.

- [ ] **Step 4: Commit**

```bash
git add src/api.ts
git commit -m "feat: add place icon, delete and move to api client"
```

---

## Task 12: Портал на координате карты

**Files:**
- Create: `src/components/MapOverlay.tsx`

Отдельный компонент с одной задачей: держать произвольный React-узел в заданной точке карты. Штатный `InfoWindow` не подходит — его белый пузырь с собственным крестиком не сводится к стеклянному тёмному оформлению проекта.

- [ ] **Step 1: Создать компонент**

```tsx
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function MapOverlay({ maps, map, position, children }: {
  maps: any
  map: any
  position: { lat: number; lng: number }
  children: React.ReactNode
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const overlayRef = useRef<any>(null)

  useEffect(() => {
    if (!maps || !map) return
    const element = document.createElement('div')
    element.className = 'map-overlay'
    // OverlayView можно наследовать только после загрузки Maps, поэтому класс
    // объявлен внутри эффекта, а не на уровне модуля.
    const overlay = new maps.OverlayView()
    overlay.onAdd = () => overlay.getPanes().floatPane.appendChild(element)
    overlay.onRemove = () => element.remove()
    overlay.draw = () => {
      const point = overlay.getProjection()?.fromLatLngToDivPixel(new maps.LatLng(overlay.__position.lat, overlay.__position.lng))
      if (!point) return
      element.style.left = `${point.x}px`
      element.style.top = `${point.y}px`
    }
    overlay.__position = position
    overlay.setMap(map)
    overlayRef.current = overlay
    setContainer(element)
    return () => {
      overlay.setMap(null)
      overlayRef.current = null
      setContainer(null)
    }
  }, [maps, map])

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    overlay.__position = position
    overlay.draw()
  }, [position.lat, position.lng])

  return container ? createPortal(children, container) : null
}
```

`floatPane` выбран намеренно: это единственная панель выше маркеров, которая принимает клики, — в других тултип оказался бы под маркерами или перестал бы нажиматься.

- [ ] **Step 2: Проверить типы**

Run: `pnpm typecheck`
Expected: в этом файле ошибок нет.

- [ ] **Step 3: Commit**

```bash
git add src/components/MapOverlay.tsx
git commit -m "feat: add map overlay portal"
```

---

## Task 13: Тултип точки

**Files:**
- Create: `src/places.ts`
- Create: `src/components/PlacePopup.tsx`

- [ ] **Step 1: Завести общий модуль точек**

`App.tsx` уже объявляет `UNSCHEDULED_KEY = 'unscheduled'`, и тултип, список дней и карта нуждаются в том же значении. Второй константы быть не должно, поэтому она переезжает в общий модуль. Создать `src/places.ts`:

```ts
import type { PlaceIconKey } from './placeIcons'

// Ключ дня «Без даты». Единственное место объявления: App.tsx, тултип, список
// дней и карта обязаны сравнивать даты с одним и тем же значением.
export const UNSCHEDULED_KEY = 'unscheduled'

export type PlaceDraft = { name: string; icon: PlaceIconKey; date: string }
```

- [ ] **Step 2: Создать компонент**

```tsx
import { useState } from 'react'
import { Button, IconButton } from './Button'
import { Input, Select } from './FormControls'
import { Icon } from '../App'
import { PLACE_ICON_OPTIONS, placeIconUrl } from '../placeIcons'
import { UNSCHEDULED_KEY, type PlaceDraft } from '../places'

export function PlacePopup({ mode, draft, dates, formatDate, readOnly, mapsUrl, onEdit, onChange, onSave, onDelete, onClose }: {
  mode: 'view' | 'edit'
  draft: PlaceDraft
  dates: string[]
  formatDate: (value: string) => string
  readOnly?: boolean
  mapsUrl?: string
  onEdit: () => void
  onChange: (draft: PlaceDraft) => void
  onSave: () => void
  onDelete?: () => void
  onClose: () => void
}) {
  if (mode === 'view') {
    return (
      <div className="place-popup">
        <div className="place-popup-head">
          <img className="ui-icon" src={placeIconUrl(draft.icon)} width={24} height={24} alt="" aria-hidden="true" />
          <strong>{draft.name}</strong>
          <IconButton type="button" icon={<Icon name="close" />} onClick={onClose} aria-label="Закрыть" />
        </div>
        <p className="secondary-text">{draft.date === UNSCHEDULED_KEY ? 'Без даты' : formatDate(draft.date)}</p>
        {mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer">Открыть в Google Maps</a>}
        {!readOnly && <Button theme="secondary" onClick={onEdit}>Редактировать</Button>}
      </div>
    )
  }
  return (
    <form className="place-popup" onSubmit={(event) => { event.preventDefault(); if (draft.name.trim()) onSave() }}>
      <div className="place-popup-head">
        <strong>{onDelete ? 'Редактирование точки' : 'Новая точка'}</strong>
        <IconButton type="button" icon={<Icon name="close" />} onClick={onClose} aria-label="Закрыть" />
      </div>
      <Input icon={<Icon name="attractions" />} aria-label="Название места" value={draft.name} placeholder="Название места" autoFocus
        onChange={(event) => onChange({ ...draft, name: event.target.value })} />
      <div className="place-popup-icons" role="radiogroup" aria-label="Иконка места">
        {PLACE_ICON_OPTIONS.map((option) => (
          <button key={option.key} type="button" role="radio" aria-checked={draft.icon === option.key} title={option.label}
            className={`place-icon-choice${draft.icon === option.key ? ' is-selected' : ''}`}
            onClick={() => onChange({ ...draft, icon: option.key })}>
            <img className="ui-icon" src={placeIconUrl(option.key)} width={24} height={24} alt={option.label} />
          </button>
        ))}
      </div>
      <Select content="date" icon={<Icon name="calendar-month" />} aria-label="Дата посещения" value={draft.date}
        onChange={(event) => onChange({ ...draft, date: event.target.value })}>
        <option value={UNSCHEDULED_KEY}>Без даты</option>
        {dates.map((date) => <option key={date} value={date}>{formatDate(date)}</option>)}
      </Select>
      <div className="place-popup-actions">
        <Button disabled={!draft.name.trim()}>Сохранить</Button>
        {onDelete && <Button type="button" theme="secondary" onClick={onDelete}>Удалить</Button>}
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Сверить импорты с реальными файлами**

Открыть `src/components/Button.tsx` и `src/components/FormControls.tsx` и проверить фактические имена экспортов и названия пропсов (`theme`, `icon`, `content`). Если они отличаются — поправить импорты и пропсы под существующие, а не заводить новые варианты компонентов. Если `Icon` неудобно тянуть из `src/App.tsx` из-за циклического импорта, вынести его в `src/components/Icon.tsx` и обновить импорт в `App.tsx`.

- [ ] **Step 4: Проверить типы**

Run: `pnpm typecheck`
Expected: в `PlacePopup.tsx` ошибок нет.

- [ ] **Step 5: Commit**

```bash
git add src/places.ts src/components/PlacePopup.tsx
git commit -m "feat: add place popup"
```

---

## Task 14: Поиск мест

**Files:**
- Create: `src/components/MapSearch.tsx`

- [ ] **Step 1: Создать компонент**

```tsx
import { useEffect, useRef, useState } from 'react'
import { Icon } from '../App'

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
    if (!maps?.places || query.trim().length < 3) { setSuggestions([]); return }
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
    // Токен сеанса одноразовый: после выбора места он обязан смениться,
    // иначе следующий поиск попадёт в уже закрытый сеанс и будет тарифицирован отдельно.
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
            <li key={index}>
              <button type="button" onClick={() => void pick(suggestion)}>
                {suggestion.placePrediction.text?.text ?? ''}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Проверить типы**

Run: `pnpm typecheck`
Expected: в `MapSearch.tsx` ошибок нет.

- [ ] **Step 3: Commit**

```bash
git add src/components/MapSearch.tsx
git commit -m "feat: add place search on map"
```

---

## Task 15: Карта с маркерами и черновым пином

**Files:**
- Create: `src/components/PlacesMap.tsx`
- Delete: `src/components/GoogleMapPicker.tsx`

- [ ] **Step 1: Создать компонент**

Опорные точки реализации:

- загрузчик скрипта повторяет существующий в `GoogleMapPicker.tsx` (промис-синглтон, callback-параметр), но URL получает `&libraries=places,marker`;
- карта создаётся с `mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID` — без него `AdvancedMarkerElement` не отрисуется;
- маркер точки — `new maps.marker.AdvancedMarkerElement({ map, position, content, gmpClickable: true })`, где `content` — созданный через `document.createElement` узел `div.place-marker` с `<img>` глифа внутри;
- клик по маркеру вешается как `marker.addListener('gmp-click', handler)`;
- приглушение задаётся классом `is-dimmed` на `content`, когда активный день выбран и не совпадает с датой точки;
- клик по карте кладёт черновую координату в состояние, повторный клик её заменяет;
- `Escape` на `window` сбрасывает и черновой пин, и открытый тултип;
- фоллбэк-геокодирование точек без координат переносится из `GoogleMapPicker.tsx` вместе с кэшем `geocodeCache` и колбэком `onResolvePlace`;
- при пустом `VITE_GOOGLE_MAPS_API_KEY` компонент, как и раньше, отдаёт iframe-заглушку без интерактива.

Код загрузчика и маркеров, где сосредоточены все особенности API:

```tsx
let mapsPromise: Promise<any> | null = null

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

// mapId обязателен: без него AdvancedMarkerElement молча не отрисуется.
const map = new maps.Map(containerRef.current, {
  center, zoom, mapTypeControl: false, streetViewControl: false,
  mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string,
})

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

const marker = new maps.marker.AdvancedMarkerElement({
  map, position, content: markerContent(place.icon, dimmed),
  // Без gmpClickable маркер с собственным content не генерирует событий клика.
  gmpClickable: true,
})
marker.addListener('gmp-click', () => onFocus(place.id))
```

Интерфейс компонента:

```tsx
export type MapPlace = {
  id: string
  name: string
  url: string
  icon: PlaceIconKey
  date: string
  latitude?: number
  longitude?: number
}

export function PlacesMap({ query, places, dates, activeDate, focusedPlaceId, readOnly, formatDate, onAdd, onUpdate, onDelete, onFocus, onResolvePlace }: {
  query: string
  places: MapPlace[]
  dates: string[]
  activeDate: string | null
  focusedPlaceId: string | null
  readOnly?: boolean
  formatDate: (value: string) => string
  onAdd: (value: { name: string; icon: PlaceIconKey; date: string; position: { lat: number; lng: number } }) => void
  onUpdate: (id: string, value: { name: string; icon: PlaceIconKey; date: string }) => void
  onDelete: (id: string) => void
  onFocus: (id: string | null) => void
  onResolvePlace?: (id: string, coordinates: { lat: number; lng: number }) => void
}): JSX.Element
```

Состав дерева: контейнер карты, поверх — `<MapSearch>` при `!readOnly`, и `<MapOverlay>` с `<PlacePopup>` — когда открыт черновой пин или выбрана существующая точка.

Черновой пин рисуется тем же `AdvancedMarkerElement`, но с `add-pin.svg` в качестве глифа и классом `place-marker-draft`.

Выбор подсказки в `MapSearch` центрирует карту (`map.panTo`, `map.setZoom(16)`), ставит черновой пин в координату результата и сразу открывает тултип добавления с `name` из результата и `icon: iconForGoogleTypes(result.types)`.

Дата в новом черновике: `activeDate ?? UNSCHEDULED_KEY`.

- [ ] **Step 2: Удалить старый компонент**

```bash
git rm src/components/GoogleMapPicker.tsx
```

- [ ] **Step 3: Проверить типы**

Run: `pnpm typecheck`
Expected: ошибки только в `src/App.tsx` — он ещё импортирует удалённый `GoogleMapPicker`. Закрывается в Task 17.

- [ ] **Step 4: Commit**

```bash
git add src/components/PlacesMap.tsx
git commit -m "feat: replace map picker with places map"
```

---

## Task 16: Список дней с drag-n-drop

**Files:**
- Create: `src/components/PlaceDayList.tsx`
- Modify: `package.json`

- [ ] **Step 1: Поставить dnd-kit**

```bash
pnpm add -D -w @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Зависимости кладутся в `devDependencies` — так же, как уже лежат `react` и `react-dom`: SPA собирается Vite, и в рантайме сервера эти пакеты не нужны.

- [ ] **Step 2: Создать компонент**

Опорные точки реализации:

- корень — `<DndContext>` с `collisionDetection={closestCorners}` и сенсором `useSensor(PointerSensor, { activationConstraint: { distance: 5 } })`; порог обязателен, иначе обычный клик по точке перестанет открывать её на карте;
- каждый день — `useDroppable({ id: dayKey })`, внутри `<SortableContext items={placeIds} strategy={verticalListSortingStrategy}>`; день без точек тоже обязан быть дроп-зоной, иначе в пустой день ничего не перетащить;
- каждая точка — `useSortable({ id: placeId })`;
- день «Без даты» участвует наравне с датированными и имеет `id`, равный `UNSCHEDULED_KEY` из `src/places.ts`;
- заголовок дня — кнопка: клик делает день активным, повторный клик снимает выделение;
- при `readOnly` `DndContext` не оборачивает список, элементы рендерятся обычными кнопками.

В `onDragEnd` цель может оказаться и точкой, и контейнером дня, поэтому день цели вычисляется так:

```tsx
const dayOf = (id: string) => (id in placesByDate ? id : Object.keys(placesByDate).find((key) => placesByDate[key].some((place) => place.id === id)))

const handleDragEnd = (event: DragEndEvent) => {
  const activeId = String(event.active.id)
  const overId = event.over ? String(event.over.id) : null
  if (!overId) return
  const targetDay = dayOf(overId)
  const sourceDay = dayOf(activeId)
  if (!targetDay || !sourceDay) return
  const target = placesByDate[targetDay] ?? []
  const withoutActive = target.filter((place) => place.id !== activeId)
  const overIndex = withoutActive.findIndex((place) => place.id === overId)
  // Бросок на заголовок или пустое место дня означает «в конец»,
  // бросок на конкретную точку — «на её место».
  const position = overId === targetDay ? withoutActive.length : Math.max(0, overIndex)
  if (targetDay === sourceDay && target.findIndex((place) => place.id === activeId) === position) return
  onMove(activeId, targetDay === UNSCHEDULED_KEY ? null : targetDay, position)
}
```

Интерфейс компонента:

```tsx
export function PlaceDayList({ dates, placesByDate, activeDate, readOnly, formatDate, onActivateDate, onFocusPlace, onMove }: {
  dates: string[]
  placesByDate: Record<string, { id: string; name: string; icon: PlaceIconKey }[]>
  activeDate: string | null
  readOnly?: boolean
  formatDate: (value: string) => string
  onActivateDate: (date: string | null) => void
  onFocusPlace: (id: string) => void
  onMove: (placeId: string, date: string | null, position: number) => void
}): JSX.Element
```

- [ ] **Step 3: Проверить типы**

Run: `pnpm typecheck`
Expected: в `PlaceDayList.tsx` ошибок нет.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/PlaceDayList.tsx
git commit -m "feat: add draggable place day list"
```

---

## Task 17: Сборка в CityPanel

**Files:**
- Modify: `src/App.tsx` (тип `Place` около строки 13, `fromApiTrip` около строки 206, `CityPanel` около строк 1128–1272)

- [ ] **Step 1: Убрать дублирующую константу**

Удалить из `src/App.tsx` строку 54 `const UNSCHEDULED_KEY = 'unscheduled'` и импортировать значение из общего модуля, созданного в Task 13:

```ts
import { UNSCHEDULED_KEY } from './places'
```

Все существующие обращения к `UNSCHEDULED_KEY` в `App.tsx` продолжают работать без правок.

- [ ] **Step 2: Добавить иконку в клиентский тип точки**

Строка 13:

```ts
type Place = { id: string; name: string; url: string; icon: PlaceIconKey; latitude?: number; longitude?: number }
```

И в `fromApiTrip`, там где собирается `places`:

```ts
;(places[key] ??= []).push({ id: place.id, name: place.name, url: place.google_maps_url, icon: place.icon ?? 'default', latitude: place.latitude ?? undefined, longitude: place.longitude ?? undefined })
```

- [ ] **Step 3: Вычистить состояния удаляемой формы**

Из `CityPanel` удалить состояния `place`, `placeUrl`, `placeCoordinates`, `selectedDate`, обработчик `addPlace` и все их сбросы в двух эффектах смены города. Вместо них:

```tsx
const [activeDate, setActiveDate] = useState<string | null>(initialDate && initialDate >= city.arrival && initialDate <= city.departure ? initialDate : null)
```

В эффекте смены города `activeDate` сбрасывается в `null`, в `useLayoutEffect` — переустанавливается из `initialDate` по тому же условию. Так ссылка «Добавьте места для посещения» с дневной карточки календаря продолжает работать: раньше она предвыбирала дату в форме, теперь делает день активным.

- [ ] **Step 4: Заменить разметку правой колонки**

Блок `<div className="city-route-content">` вместе с `<GoogleMapPicker>` и `<form className="route-form">` заменить на `<PlacesMap>` с пропсами из Task 15. Левый `<div className="city-days">` заменить на `<PlaceDayList>`.

`places` для карты собираются из всех дней, включая «Без даты» — такие точки на карте видны, просто не относятся ни к одному дню:

```tsx
const mapPlaces = Object.entries(draft.places).flatMap(([date, items]) =>
  items.map((item) => ({ id: item.id, name: item.name, url: item.url, icon: item.icon, date, latitude: item.latitude, longitude: item.longitude })))
```

- [ ] **Step 5: Проставить иконку транспорта**

В `saveTransport` обе ветки создания и обновления точки прибытия получают `icon: 'transport'`:

```tsx
const place = { id: uid(), name: value.arrivalStation.trim() || 'Место приезда', url: value.arrivalStationUrl.trim(), icon: 'transport' as const }
```

и в ветке обновления существующей точки — `{ ...existing, name: ..., url: ..., icon: 'transport' as const }`.

- [ ] **Step 6: Проверить типы**

Run: `pnpm typecheck`
Expected: без ошибок.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire places map and day list into city panel"
```

---

## Task 18: Удаление и перенос на уровне приложения

**Files:**
- Modify: `src/App.tsx` (`Dashboard` около строки 1273, `App` около строк 1564–1670)

- [ ] **Step 1: Добавить обработчики рядом с существующими**

По образцу `addPlace` и `updatePlace` около строки 1564:

```tsx
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
```

Перед запросом состояние меняется оптимистично в `CityPanel`, а при ошибке `loadTrip` возвращает серверную правду — ровно тот приём, что уже используется для документов.

- [ ] **Step 2: Довезти иконку до существующего updatePlace**

Обработчик `updatePlace` около строки 1572 сейчас шлёт имя, ссылку и координаты, но не иконку — без этого правка иконки в тултипе не сохранится:

```tsx
await api.updatePlace(trip.id, place.id, { name: place.name, googleMapsUrl: place.url, icon: place.icon, latitude: place.latitude, longitude: place.longitude, ...(date === UNSCHEDULED_KEY ? {} : { visitDate: date }) })
```

Там же в `addPlace` около строки 1567 добавить `icon: place.icon`.

- [ ] **Step 3: Прокинуть пропсы**

Добавить `onDeletePlace` и `onMovePlace` в типы пропсов `Dashboard` и `CityPanel`, передать их в обоих местах вызова `Dashboard`: в обычном (около строки 1670) — реальные обработчики, в публичном просмотре (около строки 1625) — `noop`.

- [ ] **Step 4: Отключить правку в публичном просмотре**

Прокинуть `readOnly` из `Dashboard` в `CityPanel`, оттуда в `PlacesMap` и `PlaceDayList`. При `readOnly` карта не ставит черновой пин, не показывает поиск и не даёт кнопку редактирования, список не оборачивается в `DndContext`.

- [ ] **Step 5: Проверить типы и сборку**

Run: `pnpm typecheck && pnpm build && pnpm build:api`
Expected: все три без ошибок.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add place deletion and moving to app"
```

---

## Task 19: Стили

**Files:**
- Modify: `src/styles.css` (правила `.route-form` около строк 519–529 и 555–558, `.city-day` около строк 511–514)

- [ ] **Step 1: Удалить стили формы**

Удалить все правила `.route-form` — селекторы около строк 314, 332–333, 519–529, а также упоминания в медиазапросах около строк 555 и 558.

- [ ] **Step 2: Добавить новые правила**

Дописать в конец `src/styles.css`, опираясь на существующие токены (`--glass-soft`, `--border`, `--color-text-secondary`, `--color-background-secondary`, радиус 16px):

- `.place-marker` — круглая подложка с глифом по центру; `.place-marker.is-dimmed` — пониженная непрозрачность; `.place-marker-draft` — вид чернового пина;
- `.map-overlay` — `position: absolute` и сдвиг вверх от координаты, чтобы тултип не перекрывал сам маркер;
- `.place-popup` — стеклянная плашка тултипа; `.place-popup-head`, `.place-popup-icons`, `.place-icon-choice`, `.place-icon-choice.is-selected`, `.place-popup-actions`;
- `.map-search`, `.map-search-field`, `.map-search-results` — поле поверх карты и выпадающий список;
- `.city-day.is-active` — выделение активного дня; `.city-day.is-over` — подсветка дроп-зоны; `.place-row.is-dragging` — вид перетаскиваемого элемента.

Макетов пока нет, поэтому оформление собирается на существующих токенах и заменяется, когда макеты появятся.

- [ ] **Step 3: Проверить, что мёртвых селекторов не осталось**

Run: `grep -n "route-form" src/styles.css src/App.tsx`
Expected: пусто.

- [ ] **Step 4: Commit**

```bash
git add src/styles.css
git commit -m "feat: style place markers, popup and search"
```

---

## Task 20: Конфигурация Map ID

**Files:**
- Modify: `.env.example`, `Dockerfile`, `compose.yaml`

- [ ] **Step 1: Добавить переменную в шаблон**

В `.env.example` после `VITE_GOOGLE_MAPS_API_KEY=`:

```
# Идентификатор карты из Google Cloud Console. Нужен для маркеров
# AdvancedMarkerElement и облачной стилизации карты.
VITE_GOOGLE_MAPS_MAP_ID=
```

Значение остаётся пустым: `.env.example` — шаблон, реальные значения живут только в `.env`, который в `.gitignore`.

- [ ] **Step 2: Пробросить в сборку образа**

В `Dockerfile` рядом со строками 30 и 32:

```dockerfile
ARG VITE_GOOGLE_MAPS_MAP_ID
ENV VITE_GOOGLE_MAPS_MAP_ID=${VITE_GOOGLE_MAPS_MAP_ID}
```

В `compose.yaml` рядом со строкой 39:

```yaml
        VITE_GOOGLE_MAPS_MAP_ID: ${VITE_GOOGLE_MAPS_MAP_ID:-}
```

- [ ] **Step 3: Проверить сборку**

Run: `pnpm build`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add .env.example Dockerfile compose.yaml
git commit -m "chore: pass google maps map id to build"
```

---

## Task 21: Проверка в браузере

**Files:** нет, только проверка.

- [ ] **Step 1: Поднять окружение**

```bash
pnpm db:up && pnpm db:migrate && pnpm dev:all
```

Открыть `http://localhost:4173`. Порт важен: ключ Google ограничен по referer, и в белом списке есть только `http://localhost:4173`. На другом порту поиск ответит `API_KEY_HTTP_REFERRER_BLOCKED`.

- [ ] **Step 2: Пройти сценарии**

Открыть город с датами и проверить по списку:

- клик по карте ставит пин с плюсиком; повторный клик переставляет его; `Escape` убирает;
- клик по пину открывает тултип; сохранение с пустым названием недоступно;
- сохранённая точка появляется в списке и на карте со своей иконкой;
- поиск находит место, центрирует карту, открывает тултип с подставленными названием и иконкой;
- клик по существующему маркеру открывает просмотр, кнопка ведёт в редактирование, оттуда работает удаление;
- клик по названию в списке центрирует карту и открывает просмотр;
- клик по заголовку дня выделяет день, маркеры остальных дней приглушаются, повторный клик снимает выделение;
- перетаскивание точки в другой день меняет дату; порядок внутри дня меняется перетаскиванием; работает перенос в «Без даты» и обратно; пустой день принимает дроп;
- ссылка «Добавьте места для посещения» с дневной карточки календаря открывает город и делает нужный день активным;
- после перезагрузки страницы всё сохранилось.

- [ ] **Step 3: Проверить публичный просмотр**

Открыть поездку по ссылке публичного просмотра: карта и маркеры работают, тултип открывается в режиме просмотра, поиска и чернового пина нет, точки не перетаскиваются.

- [ ] **Step 4: Проверить состояния интерфейса**

По правилу из `AGENTS.md`: прокрутка длинного списка дней, обрезка тултипа у краёв карты, hover и focus на маркере, кнопках иконок и элементах списка, поведение тултипа при зуме и панорамировании карты.

- [ ] **Step 5: Прогнать полную проверку**

Run: `pnpm test && pnpm typecheck && pnpm build && pnpm build:api`
Expected: всё зелёное.

---

## Task 22: Обновление AGENTS.md

**Files:**
- Modify: `AGENTS.md` (раздел «Маршрут, города и календарь» около строки 317, «Этап 4. Google Maps» около строки 161)

- [ ] **Step 1: Зафиксировать новые правила**

В раздел «Маршрут, города и календарь» добавить:

- места добавляются кликом по карте: клик ставит пин с плюсиком, клик по пину открывает тултип добавления; отдельной формы добавления места под картой больше нет;
- у точки есть название, иконка из восьми вариантов и необязательная дата посещения внутри дат города;
- каталог иконок: базовая, посмотреть, поесть, кофе, отель, шопинг, природа, транспорт;
- в списке слева день можно сделать активным кликом по заголовку; точки активного дня на карте полноцветные, остальные приглушены; без активного дня все точки полноцветные;
- новая точка по умолчанию получает дату активного дня, а если активного дня нет — создаётся без даты;
- точки переносятся между днями и сортируются внутри дня перетаскиванием; перенос меняет дату;
- клик по маркеру открывает просмотр точки, из него отдельной кнопкой доступно редактирование, а из режима редактирования — удаление;
- на карте есть поиск мест; выбор результата ставит пин и открывает тултип с подставленными названием и иконкой;
- править, переносить и удалять точки может любой участник поездки, а не только владелец или автор точки.

В «Этап 4. Google Maps» отметить сделанным сохранение координат и показ точек на карте города и дня; построение маршрута в заданном порядке остаётся невыполненным.

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: record map places rules"
```

---

## Порядок и зависимости

Задачи 1–8 — сервер, не зависят от клиента. Задачи 9–16 — клиентские модули, каждый проверяется типами отдельно. Задачи 17–18 сшивают всё вместе, и до них `pnpm typecheck` будет ругаться на `src/App.tsx` — это ожидаемо. Задачи 19–22 — оформление, конфигурация и фиксация.

Промежуточные состояния между задачами 15 и 18 не собираются: старый `GoogleMapPicker` уже удалён, а новый ещё не подключён. Если нужна возможность остановиться в рабочем состоянии, задачи 15–18 стоит выполнять подряд одним заходом.
