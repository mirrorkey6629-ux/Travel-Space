import { describe, expect, it } from 'vitest'
import { PLACE_ICONS, normalizePlaceIcon, reorderPlaces } from './places.js'

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
