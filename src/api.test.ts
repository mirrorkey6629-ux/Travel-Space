import { describe, expect, it } from 'vitest'
import { ApiRequestError, isConflictError } from './api'

describe('API conflict recognition', () => {
  it('распознаёт как экземпляр ApiRequestError, так и обычный объект со статусом 409', () => {
    expect(isConflictError(new ApiRequestError('Конфликт', 409))).toBe(true)
    expect(isConflictError({ status: 409, message: 'Конфликт' })).toBe(true)
  })

  it('не принимает другие ошибки за конфликт', () => {
    expect(isConflictError(new ApiRequestError('Ошибка', 500))).toBe(false)
    expect(isConflictError(new Error('Сеть'))).toBe(false)
  })
})
