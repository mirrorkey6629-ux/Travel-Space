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
