import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { FastifyRequest } from 'fastify'
import { db } from './db.js'

export type AuthUser = { id: string; email: string; displayName: string; hasAvatar: boolean }
export type TripRole = 'owner' | 'member'

export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex')
export const createToken = () => randomBytes(32).toString('base64url')
const scrypt = promisify(scryptCallback)

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derived = await scrypt(password, salt, 64) as Buffer
  return `scrypt:${salt}:${derived.toString('hex')}`
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, expectedHex] = encoded.split(':')
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false
  const expected = Buffer.from(expectedHex, 'hex')
  const actual = await scrypt(password, salt, expected.length) as Buffer
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export async function requireUser(request: FastifyRequest): Promise<AuthUser> {
  const header = request.headers.authorization
  if (!header?.startsWith('Bearer ')) throw Object.assign(new Error('Требуется авторизация'), { statusCode: 401 })
  const tokenHash = hashToken(header.slice(7))
  const result = await db.query<{ id: string; email: string; display_name: string; has_avatar: boolean }>(
    `SELECT u.id, u.email, u.display_name, (u.avatar_storage_key IS NOT NULL) AS has_avatar
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash],
  )
  const user = result.rows[0]
  if (!user) throw Object.assign(new Error('Сессия недействительна'), { statusCode: 401 })
  return { id: user.id, email: user.email, displayName: user.display_name, hasAvatar: user.has_avatar }
}

export async function requireTripRole(tripId: string, userId: string, ownerOnly = false): Promise<TripRole> {
  const result = await db.query<{ role: TripRole }>('SELECT role FROM trip_members WHERE trip_id = $1 AND user_id = $2', [tripId, userId])
  const role = result.rows[0]?.role
  if (!role) throw Object.assign(new Error('Нет доступа к поездке'), { statusCode: 403 })
  if (ownerOnly && role !== 'owner') throw Object.assign(new Error('Изменять маршрут может только владелец'), { statusCode: 403 })
  return role
}
