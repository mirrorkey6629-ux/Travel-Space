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
