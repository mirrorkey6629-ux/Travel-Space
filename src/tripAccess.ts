import { createContext, useContext } from 'react'
import type { ApiRole } from './api'

export type TripAccess = {
  /** Переходы внутрь поездки: города, дни, панели отеля и транспорта. */
  canBrowse: boolean
  /** Изменение любых данных: поездок, городов, мест, отелей, билетов, документов, профиля. */
  canEdit: boolean
  /** Действия владельца поездки: правка самой поездки, приглашения, удаление. */
  canManageTrip: boolean
}

/**
 * Три разных запрета, которые раньше жили в одном флаге `readOnly` и из-за
 * этого путались между собой.
 *
 * Публичный просмотр по ссылке запрещает и правки, и переходы внутрь: гость
 * видит плоскую сводку поездки. Оффлайн запрещает только правки — иначе
 * поездку, ради которой весь кэш и затевался, невозможно было бы листать.
 */
export function tripAccess({ publicView, offline, role }: {
  publicView: boolean
  offline: boolean
  role?: ApiRole
}): TripAccess {
  return {
    canBrowse: !publicView,
    canEdit: !publicView && !offline,
    canManageTrip: !publicView && !offline && role === 'owner',
  }
}

/**
 * Значение по умолчанию намеренно запрещает правки: компонент, отрисованный без
 * провайдера, должен молча ничего не сломать, а не молча пустить изменения.
 * Просмотр при этом остаётся, иначе забытый провайдер выглядел бы как пустой
 * интерфейс.
 */
const CLOSED: TripAccess = { canBrowse: true, canEdit: false, canManageTrip: false }

export const AccessContext = createContext<TripAccess>(CLOSED)

/**
 * Глобальный выключатель правок. Любой новый экран или элемент управления,
 * который меняет данные, обязан спрашивать его, а не выводить доступ из роли,
 * `navigator.onLine` или собственных пропов.
 */
export const useAccess = () => useContext(AccessContext)
