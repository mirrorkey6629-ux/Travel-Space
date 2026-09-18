import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import Fastify from 'fastify'
import { createToken, hashPassword, hashToken, requireTripRole, requireUser, verifyPassword } from './auth.js'
import { apiPrefix, config } from './config.js'
import { db, transaction } from './db.js'

type Json = Record<string, unknown>
const bodyOf = (value: unknown) => (value && typeof value === 'object' ? value as Json : {})
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const passwordText = (value: unknown) => typeof value === 'string' ? value : ''
const optionalText = (value: unknown) => typeof value === 'string' ? value.trim() : undefined
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const httpError = (statusCode: number, message: string) => Object.assign(new Error(message), { statusCode })

const app = Fastify({ logger: true, bodyLimit: config.maxUploadBytes })
await app.register(cors, { origin: true, credentials: true })
await app.register(multipart, { limits: { fileSize: config.maxUploadBytes, files: 1 } })

app.setErrorHandler((error, _request, reply) => {
  const statusCode = Number((error as { statusCode?: number }).statusCode) || 500
  if (statusCode >= 500) app.log.error(error)
  const message = error instanceof Error ? error.message : 'Некорректный запрос'
  reply.code(statusCode).send({ error: statusCode >= 500 ? 'Внутренняя ошибка сервера' : message })
})

app.get(`${apiPrefix}/health`, async () => {
  await db.query('SELECT 1')
  return { ok: true, service: 'travel-planner-api' }
})

async function createSession(userId: string) {
  const token = createToken()
  await db.query(`INSERT INTO sessions(user_id, token_hash, expires_at) VALUES ($1, $2, now() + ($3 || ' days')::interval)`, [userId, hashToken(token), config.sessionTtlDays])
  return token
}

app.post(`${apiPrefix}/auth/register`, async (request, reply) => {
  const body = bodyOf(request.body)
  const email = text(body.email).toLowerCase()
  const displayName = text(body.displayName)
  const password = passwordText(body.password)
  if (!/^\S+@\S+\.\S+$/.test(email)) throw httpError(400, 'Укажите корректный email')
  if (!displayName) throw httpError(400, 'Укажите имя')
  if (password.length < 8) throw httpError(400, 'Пароль должен содержать не менее 8 символов')
  if (password.length > 256) throw httpError(400, 'Пароль не должен быть длиннее 256 символов')
  if ((await db.query('SELECT 1 FROM users WHERE email=$1', [email])).rowCount) throw httpError(409, 'Аккаунт с таким email уже есть')
  const passwordHash = await hashPassword(password)
  const user = (await db.query<{ id: string; email: string; display_name: string }>('INSERT INTO users(email,display_name,password_hash) VALUES ($1,$2,$3) RETURNING id,email,display_name', [email, displayName, passwordHash])).rows[0]
  const token = await createSession(user.id)
  reply.code(201)
  return { token, user: { id: user.id, email: user.email, displayName: user.display_name } }
})

app.post(`${apiPrefix}/auth/login`, async (request) => {
  const body = bodyOf(request.body)
  const email = text(body.email).toLowerCase()
  const password = passwordText(body.password)
  if (password.length > 256) throw httpError(400, 'Пароль не должен быть длиннее 256 символов')
  const user = (await db.query<{ id: string; email: string; display_name: string; password_hash: string | null }>('SELECT id,email,display_name,password_hash FROM users WHERE email=$1', [email])).rows[0]
  if (!user?.password_hash || !await verifyPassword(password, user.password_hash)) throw httpError(401, 'Неверный email или пароль')
  const token = await createSession(user.id)
  return { token, user: { id: user.id, email: user.email, displayName: user.display_name } }
})

app.get(`${apiPrefix}/me`, async (request) => ({ user: await requireUser(request) }))

app.get(`${apiPrefix}/trips`, async (request) => {
  const user = await requireUser(request)
  const result = await db.query(
    `SELECT t.id, t.name, t.start_date, t.end_date, tm.role, t.updated_at
       FROM trip_members tm JOIN trips t ON t.id = tm.trip_id
      WHERE tm.user_id = $1 ORDER BY t.start_date DESC`,
    [user.id],
  )
  return { trips: result.rows }
})

app.post(`${apiPrefix}/trips`, async (request, reply) => {
  const user = await requireUser(request)
  const body = bodyOf(request.body)
  const name = text(body.name)
  const startDate = text(body.startDate)
  const endDate = text(body.endDate)
  if (!name || !datePattern.test(startDate) || !datePattern.test(endDate) || endDate < startDate) throw httpError(400, 'Проверьте название и даты поездки')
  const trip = await transaction(async (client) => {
    const result = await client.query(
      'INSERT INTO trips(owner_id, name, start_date, end_date) VALUES ($1, $2, $3, $4) RETURNING *',
      [user.id, name, startDate, endDate],
    )
    await client.query("INSERT INTO trip_members(trip_id, user_id, role) VALUES ($1, $2, 'owner')", [result.rows[0].id, user.id])
    return result.rows[0]
  })
  reply.code(201)
  return { trip }
})

app.post(`${apiPrefix}/trips/import`, async (request, reply) => {
  const user = await requireUser(request)
  const upload = await request.file({ limits: { fileSize: config.maxImportBytes, files: 1 } })
  if (!upload) throw httpError(400, 'Файл импорта не выбран')
  let bundle: any
  try { bundle = JSON.parse((await upload.toBuffer()).toString('utf8')) } catch { throw httpError(400, 'Файл поездки повреждён или имеет неверный формат') }
  if (bundle?.format !== 'travel-space' || bundle?.version !== 1 || !bundle.trip || !Array.isArray(bundle.cities) || !Array.isArray(bundle.places) || !Array.isArray(bundle.tasks) || !Array.isArray(bundle.documents)) throw httpError(400, 'Неподдерживаемый формат файла поездки')
  const tripName = text(bundle.trip.name)
  const startDate = text(bundle.trip.startDate)
  const endDate = text(bundle.trip.endDate)
  if (!tripName || !datePattern.test(startDate) || !datePattern.test(endDate) || endDate < startDate) throw httpError(400, 'В файле указаны некорректные данные поездки')
  const totalDocumentBytes = bundle.documents.reduce((sum: number, document: any) => sum + Buffer.byteLength(String(document.contentBase64 || ''), 'base64'), 0)
  if (totalDocumentBytes > config.maxImportBytes) throw httpError(413, 'Документы в архиве превышают допустимый размер')
  const writtenFiles: string[] = []
  await mkdir(config.uploadDir, { recursive: true })
  try {
    const trip = await transaction(async (client) => {
      const createdTrip = (await client.query(
        'INSERT INTO trips(owner_id,name,start_date,end_date) VALUES ($1,$2,$3,$4) RETURNING *',
        [user.id, tripName, startDate, endDate],
      )).rows[0]
      await client.query("INSERT INTO trip_members(trip_id,user_id,role) VALUES ($1,$2,'owner')", [createdTrip.id, user.id])
      const cityIds = new Map<string, string>()
      const cityDates = new Map<string, { arrivalDate: string; departureDate: string }>()
      for (const [index, source] of bundle.cities.entries()) {
        const oldId = text(source.id)
        const name = text(source.name)
        const arrivalDate = text(source.arrivalDate)
        const departureDate = text(source.departureDate)
        const arrivalPeriod = text(source.arrivalPeriod) || 'morning'
        const departurePeriod = text(source.departurePeriod) || 'evening'
        if (!oldId || !name || !datePattern.test(arrivalDate) || !datePattern.test(departureDate) || arrivalDate < startDate || departureDate > endDate || departureDate < arrivalDate || !['morning','day','evening'].includes(arrivalPeriod) || !['morning','day','evening'].includes(departurePeriod)) throw httpError(400, 'Некорректные данные города в файле')
        const city = (await client.query(
          `INSERT INTO cities(trip_id,name,position,arrival_date,departure_date,arrival_period,departure_period,hotel,train_in,train_out,created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
          [createdTrip.id, name, index, arrivalDate, departureDate, arrivalPeriod, departurePeriod, text(source.hotel), text(source.trainIn), text(source.trainOut), user.id],
        )).rows[0]
        cityIds.set(oldId, city.id)
        cityDates.set(oldId, { arrivalDate, departureDate })
      }
      for (const source of bundle.places) {
        const oldCityId = text(source.cityId)
        const cityId = cityIds.get(oldCityId)
        const visitDate = optionalText(source.visitDate) || null
        const cityRange = cityDates.get(oldCityId)
        if (!cityId || !text(source.name)) throw httpError(400, 'Некорректное место в файле')
        if (visitDate && (!datePattern.test(visitDate) || !cityRange || visitDate < cityRange.arrivalDate || visitDate > cityRange.departureDate)) throw httpError(400, 'Дата места находится за пределами дат города')
        await client.query(
          `INSERT INTO places(trip_id,city_id,visit_date,name,google_maps_url,position,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [createdTrip.id, cityId, visitDate, text(source.name), text(source.googleMapsUrl), Number.isInteger(source.position) ? source.position : 0, user.id],
        )
      }
      for (const source of bundle.tasks) {
        const cityId = source.cityId ? cityIds.get(text(source.cityId)) : null
        const dueDate = optionalText(source.dueDate) || null
        if ((source.cityId && !cityId) || !text(source.title)) throw httpError(400, 'Некорректная задача в файле')
        if (dueDate && (!datePattern.test(dueDate) || dueDate < startDate || dueDate > endDate)) throw httpError(400, 'Дата задачи находится за пределами поездки')
        await client.query(
          'INSERT INTO tasks(trip_id,city_id,due_date,title,done,created_by) VALUES ($1,$2,$3,$4,$5,$6)',
          [createdTrip.id, cityId, dueDate, text(source.title), Boolean(source.done), user.id],
        )
      }
      for (const source of bundle.documents) {
        const cityId = source.cityId ? cityIds.get(text(source.cityId)) : null
        const originalName = text(source.originalName)
        const category = text(source.category)
        const encodedContent = String(source.contentBase64 || '')
        if ((source.cityId && !cityId) || !originalName || !category || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encodedContent)) throw httpError(400, 'Некорректный документ в файле')
        const content = Buffer.from(encodedContent, 'base64')
        if (content.length > config.maxUploadBytes) throw httpError(413, `Файл «${text(source.originalName)}» превышает допустимый размер`)
        const id = crypto.randomUUID()
        const extension = path.extname(originalName).slice(0, 16)
        const storageKey = `${id}${extension}`
        const target = path.join(config.uploadDir, storageKey)
        await writeFile(target, content, { flag: 'wx' })
        writtenFiles.push(target)
        await client.query(
          `INSERT INTO documents(id,trip_id,city_id,category,original_name,storage_key,mime_type,size_bytes,created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [id, createdTrip.id, cityId, category, originalName, storageKey, text(source.mimeType) || 'application/octet-stream', content.length, user.id],
        )
      }
      return createdTrip
    })
    reply.code(201)
    return { trip }
  } catch (error) {
    await Promise.all(writtenFiles.map((file) => unlink(file).catch(() => undefined)))
    throw error
  }
})

app.get(`${apiPrefix}/trips/:tripId`, async (request) => {
  const user = await requireUser(request)
  const { tripId } = request.params as { tripId: string }
  const role = await requireTripRole(tripId, user.id)
  const [tripResult, cities, places, tasks, documents, members] = await Promise.all([
    db.query('SELECT id, name, start_date, end_date, owner_id, created_at, updated_at FROM trips WHERE id = $1', [tripId]),
    db.query('SELECT * FROM cities WHERE trip_id = $1 ORDER BY position', [tripId]),
    db.query('SELECT * FROM places WHERE trip_id = $1 ORDER BY city_id, visit_date NULLS FIRST, position', [tripId]),
    db.query('SELECT * FROM tasks WHERE trip_id = $1 ORDER BY created_at', [tripId]),
    db.query('SELECT id, trip_id, city_id, category, original_name, mime_type, size_bytes, created_by, created_at FROM documents WHERE trip_id = $1 ORDER BY created_at', [tripId]),
    db.query(`SELECT u.id, u.email, u.display_name, tm.role, tm.joined_at FROM trip_members tm JOIN users u ON u.id = tm.user_id WHERE tm.trip_id = $1`, [tripId]),
  ])
  const trip = tripResult.rows[0]
  if (!trip) throw httpError(404, 'Поездка не найдена')
  return { trip: { ...trip, role, cities: cities.rows, places: places.rows, tasks: tasks.rows, documents: documents.rows, members: members.rows } }
})

app.get(`${apiPrefix}/trips/:tripId/export`, async (request, reply) => {
  const user = await requireUser(request)
  const { tripId } = request.params as { tripId: string }
  await requireTripRole(tripId, user.id, true)
  const [tripResult, cities, places, tasks, documents] = await Promise.all([
    db.query('SELECT name,start_date::text,end_date::text FROM trips WHERE id=$1', [tripId]),
    db.query('SELECT * FROM cities WHERE trip_id=$1 ORDER BY position', [tripId]),
    db.query('SELECT * FROM places WHERE trip_id=$1 ORDER BY city_id,visit_date NULLS FIRST,position', [tripId]),
    db.query('SELECT * FROM tasks WHERE trip_id=$1 ORDER BY created_at', [tripId]),
    db.query('SELECT * FROM documents WHERE trip_id=$1 ORDER BY created_at', [tripId]),
  ])
  const trip = tripResult.rows[0]
  if (!trip) throw httpError(404, 'Поездка не найдена')
  const bundle = {
    format: 'travel-space', version: 1, exportedAt: new Date().toISOString(),
    trip: { name: trip.name, startDate: trip.start_date, endDate: trip.end_date },
    cities: cities.rows.map((city) => ({ id: city.id, name: city.name, arrivalDate: String(city.arrival_date).slice(0,10), departureDate: String(city.departure_date).slice(0,10), arrivalPeriod: city.arrival_period, departurePeriod: city.departure_period, hotel: city.hotel, trainIn: city.train_in, trainOut: city.train_out })),
    places: places.rows.map((place) => ({ cityId: place.city_id, visitDate: place.visit_date ? String(place.visit_date).slice(0,10) : null, name: place.name, googleMapsUrl: place.google_maps_url, position: place.position })),
    tasks: tasks.rows.map((task) => ({ cityId: task.city_id, dueDate: task.due_date ? String(task.due_date).slice(0,10) : null, title: task.title, done: task.done })),
    documents: await Promise.all(documents.rows.map(async (document) => ({ cityId: document.city_id, category: document.category, originalName: document.original_name, mimeType: document.mime_type, contentBase64: (await readFile(path.join(config.uploadDir, document.storage_key))).toString('base64') }))),
  }
  const safeName = String(trip.name).replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-|-$/g, '') || 'trip'
  reply.header('Content-Type', 'application/vnd.travel-space+json; charset=utf-8')
  reply.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`${safeName}.travelspace`)}`)
  return JSON.stringify(bundle)
})

app.patch(`${apiPrefix}/trips/:tripId`, async (request) => {
  const user = await requireUser(request)
  const { tripId } = request.params as { tripId: string }
  await requireTripRole(tripId, user.id, true)
  const body = bodyOf(request.body)
  const current = (await db.query<{ name: string; start_date: string; end_date: string }>('SELECT name, start_date::text, end_date::text FROM trips WHERE id = $1', [tripId])).rows[0]
  if (!current) throw httpError(404, 'Поездка не найдена')
  const name = optionalText(body.name) ?? current.name
  const startDate = optionalText(body.startDate) ?? current.start_date
  const endDate = optionalText(body.endDate) ?? current.end_date
  if (!name || !datePattern.test(startDate) || !datePattern.test(endDate) || endDate < startDate) throw httpError(400, 'Некорректные даты поездки')
  const outside = await db.query('SELECT 1 FROM cities WHERE trip_id = $1 AND (arrival_date < $2 OR departure_date > $3) LIMIT 1', [tripId, startDate, endDate])
  if (outside.rowCount) throw httpError(409, 'Сначала перенесите даты городов внутрь нового диапазона')
  const result = await db.query('UPDATE trips SET name = $2, start_date = $3, end_date = $4, updated_at = now() WHERE id = $1 RETURNING *', [tripId, name, startDate, endDate])
  return { trip: result.rows[0] }
})

app.delete(`${apiPrefix}/trips/:tripId`, async (request, reply) => {
  const user = await requireUser(request)
  const { tripId } = request.params as { tripId: string }
  await requireTripRole(tripId, user.id, true)
  const body = bodyOf(request.body)
  const confirmation = text(body.confirmation)
  const trip = (await db.query<{ name: string }>('SELECT name FROM trips WHERE id = $1', [tripId])).rows[0]
  if (!trip) throw httpError(404, 'Поездка не найдена')
  if (confirmation !== trip.name) throw httpError(400, 'Введите название поездки без изменений')
  const documents = await db.query<{ storage_key: string }>('SELECT storage_key FROM documents WHERE trip_id = $1', [tripId])
  await db.query('DELETE FROM trips WHERE id = $1', [tripId])
  await Promise.all(documents.rows.map((document) => unlink(path.join(config.uploadDir, document.storage_key)).catch(() => undefined)))
  reply.code(204).send()
})

app.post(`${apiPrefix}/trips/:tripId/invitations`, async (request, reply) => {
  const user = await requireUser(request)
  const { tripId } = request.params as { tripId: string }
  await requireTripRole(tripId, user.id, true)
  const requestedHours = Number(bodyOf(request.body).expiresInHours)
  const expiresInHours = Number.isFinite(requestedHours) ? Math.min(168, Math.max(1, Math.round(requestedHours))) : 72
  const token = createToken()
  const result = await transaction(async (client) => {
    await client.query('UPDATE invitations SET revoked_at = now() WHERE trip_id = $1 AND revoked_at IS NULL', [tripId])
    return client.query(
      `INSERT INTO invitations(trip_id, token_hash, created_by, expires_at)
       VALUES ($1, $2, $3, now() + ($4 || ' hours')::interval) RETURNING id, expires_at`,
      [tripId, hashToken(token), user.id, expiresInHours],
    )
  })
  const requestOrigin = typeof request.headers.origin === 'string' && /^https?:\/\//.test(request.headers.origin) ? request.headers.origin : config.publicOrigin
  reply.code(201)
  return { invitation: { id: result.rows[0].id, expiresAt: result.rows[0].expires_at, url: `${requestOrigin}${config.basePath}/join/${token}` } }
})

app.delete(`${apiPrefix}/trips/:tripId/members/:memberId`, async (request, reply) => {
  const user = await requireUser(request)
  const { tripId, memberId } = request.params as { tripId: string; memberId: string }
  await requireTripRole(tripId, user.id, true)
  const trip = (await db.query<{ owner_id: string }>('SELECT owner_id FROM trips WHERE id = $1', [tripId])).rows[0]
  if (!trip) throw httpError(404, 'Поездка не найдена')
  if (memberId === trip.owner_id) throw httpError(400, 'Владельца нельзя удалить из поездки')
  const result = await db.query("DELETE FROM trip_members WHERE trip_id = $1 AND user_id = $2 AND role = 'member'", [tripId, memberId])
  if (!result.rowCount) throw httpError(404, 'Участник не найден')
  reply.code(204).send()
})

app.post(`${apiPrefix}/invitations/:token/accept`, async (request) => {
  const user = await requireUser(request)
  const { token } = request.params as { token: string }
  const invitation = (await db.query<{ id: string; trip_id: string }>(
    'SELECT id, trip_id FROM invitations WHERE token_hash = $1 AND expires_at > now() AND revoked_at IS NULL',
    [hashToken(token)],
  )).rows[0]
  if (!invitation) throw httpError(404, 'Приглашение недействительно или истекло')
  await transaction(async (client) => {
    await client.query("INSERT INTO trip_members(trip_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING", [invitation.trip_id, user.id])
  })
  return { tripId: invitation.trip_id }
})

async function validatedCityInput(tripId: string, body: Json) {
  const name = text(body.name)
  const arrivalDate = text(body.arrivalDate)
  const departureDate = text(body.departureDate)
  const arrivalPeriod = text(body.arrivalPeriod) || 'morning'
  const departurePeriod = text(body.departurePeriod) || 'evening'
  const trip = (await db.query<{ start_date: string; end_date: string }>('SELECT start_date::text, end_date::text FROM trips WHERE id = $1', [tripId])).rows[0]
  if (!trip) throw httpError(404, 'Поездка не найдена')
  if (!name || !datePattern.test(arrivalDate) || !datePattern.test(departureDate) || departureDate < arrivalDate) throw httpError(400, 'Проверьте город и даты')
  if (arrivalDate < trip.start_date || departureDate > trip.end_date) throw httpError(400, 'Даты города должны находиться внутри поездки')
  if (!['morning', 'day', 'evening'].includes(arrivalPeriod) || !['morning', 'day', 'evening'].includes(departurePeriod)) throw httpError(400, 'Некорректное время суток')
  return { name, arrivalDate, departureDate, arrivalPeriod, departurePeriod }
}

app.post(`${apiPrefix}/trips/:tripId/cities`, async (request, reply) => {
  const user = await requireUser(request)
  const { tripId } = request.params as { tripId: string }
  await requireTripRole(tripId, user.id, true)
  const input = await validatedCityInput(tripId, bodyOf(request.body))
  const position = Number(bodyOf(request.body).position)
  const nextPosition = Number.isInteger(position) ? position : Number((await db.query('SELECT coalesce(max(position), -1) + 1 AS value FROM cities WHERE trip_id = $1', [tripId])).rows[0].value)
  const result = await db.query(
    `INSERT INTO cities(trip_id, name, position, arrival_date, departure_date, arrival_period, departure_period, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [tripId, input.name, nextPosition, input.arrivalDate, input.departureDate, input.arrivalPeriod, input.departurePeriod, user.id],
  )
  reply.code(201)
  return { city: result.rows[0] }
})

app.patch(`${apiPrefix}/trips/:tripId/cities/:cityId`, async (request) => {
  const user = await requireUser(request)
  const { tripId, cityId } = request.params as { tripId: string; cityId: string }
  await requireTripRole(tripId, user.id, true)
  const current = (await db.query('SELECT * FROM cities WHERE id = $1 AND trip_id = $2', [cityId, tripId])).rows[0]
  if (!current) throw httpError(404, 'Город не найден')
  const body = bodyOf(request.body)
  const input = await validatedCityInput(tripId, {
    name: optionalText(body.name) ?? current.name,
    arrivalDate: optionalText(body.arrivalDate) ?? String(current.arrival_date).slice(0, 10),
    departureDate: optionalText(body.departureDate) ?? String(current.departure_date).slice(0, 10),
    arrivalPeriod: optionalText(body.arrivalPeriod) ?? current.arrival_period,
    departurePeriod: optionalText(body.departurePeriod) ?? current.departure_period,
  })
  const result = await db.query(
    `UPDATE cities SET name=$3, arrival_date=$4, departure_date=$5, arrival_period=$6, departure_period=$7,
       hotel=coalesce($8,hotel), train_in=coalesce($9,train_in), train_out=coalesce($10,train_out), updated_at=now()
     WHERE id=$1 AND trip_id=$2 RETURNING *`,
    [cityId, tripId, input.name, input.arrivalDate, input.departureDate, input.arrivalPeriod, input.departurePeriod, optionalText(body.hotel), optionalText(body.trainIn), optionalText(body.trainOut)],
  )
  return { city: result.rows[0] }
})

app.delete(`${apiPrefix}/trips/:tripId/cities/:cityId`, async (request, reply) => {
  const user = await requireUser(request)
  const { tripId, cityId } = request.params as { tripId: string; cityId: string }
  await requireTripRole(tripId, user.id, true)
  const related = await db.query('SELECT (SELECT count(*) FROM places WHERE city_id=$1) + (SELECT count(*) FROM documents WHERE city_id=$1) AS count', [cityId])
  if (Number(related.rows[0]?.count) > 0) throw httpError(409, 'В городе есть места или документы. Сначала удалите либо перенесите их')
  const result = await db.query('DELETE FROM cities WHERE id=$1 AND trip_id=$2', [cityId, tripId])
  if (!result.rowCount) throw httpError(404, 'Город не найден')
  reply.code(204).send()
})

app.post(`${apiPrefix}/trips/:tripId/cities/:cityId/places`, async (request, reply) => {
  const user = await requireUser(request)
  const { tripId, cityId } = request.params as { tripId: string; cityId: string }
  await requireTripRole(tripId, user.id)
  const body = bodyOf(request.body)
  const name = text(body.name)
  const visitDate = optionalText(body.visitDate) || null
  if (!name) throw httpError(400, 'Название места обязательно')
  const city = (await db.query<{ arrival_date: string; departure_date: string }>('SELECT arrival_date::text, departure_date::text FROM cities WHERE id=$1 AND trip_id=$2', [cityId, tripId])).rows[0]
  if (!city) throw httpError(404, 'Город не найден')
  if (visitDate && (!datePattern.test(visitDate) || visitDate < city.arrival_date || visitDate > city.departure_date)) throw httpError(400, 'Дата места должна быть внутри дат города')
  const position = Number((await db.query('SELECT coalesce(max(position), -1) + 1 AS value FROM places WHERE city_id=$1 AND visit_date IS NOT DISTINCT FROM $2', [cityId, visitDate])).rows[0].value)
  const result = await db.query(
    `INSERT INTO places(trip_id,city_id,visit_date,name,google_maps_url,position,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [tripId, cityId, visitDate, name, text(body.googleMapsUrl), position, user.id],
  )
  reply.code(201)
  return { place: result.rows[0] }
})

app.patch(`${apiPrefix}/trips/:tripId/places/:placeId`, async (request) => {
  const user = await requireUser(request)
  const { tripId, placeId } = request.params as { tripId: string; placeId: string }
  const role = await requireTripRole(tripId, user.id)
  const place = (await db.query('SELECT * FROM places WHERE id=$1 AND trip_id=$2', [placeId, tripId])).rows[0]
  if (!place) throw httpError(404, 'Место не найдено')
  if (role !== 'owner' && place.created_by !== user.id) throw httpError(403, 'Можно редактировать только добавленные вами места')
  const body = bodyOf(request.body)
  const result = await db.query(
    `UPDATE places SET name=coalesce($3,name), google_maps_url=coalesce($4,google_maps_url), visit_date=coalesce($5,visit_date), position=coalesce($6,position), updated_at=now()
     WHERE id=$1 AND trip_id=$2 RETURNING *`,
    [placeId, tripId, optionalText(body.name), optionalText(body.googleMapsUrl), optionalText(body.visitDate), Number.isInteger(body.position) ? body.position : null],
  )
  return { place: result.rows[0] }
})

app.post(`${apiPrefix}/trips/:tripId/tasks`, async (request, reply) => {
  const user = await requireUser(request)
  const { tripId } = request.params as { tripId: string }
  await requireTripRole(tripId, user.id)
  const body = bodyOf(request.body)
  const title = text(body.title)
  if (!title) throw httpError(400, 'Название задачи обязательно')
  const result = await db.query(
    'INSERT INTO tasks(trip_id,city_id,due_date,title,created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [tripId, optionalText(body.cityId) || null, optionalText(body.dueDate) || null, title, user.id],
  )
  reply.code(201)
  return { task: result.rows[0] }
})

app.patch(`${apiPrefix}/trips/:tripId/tasks/:taskId`, async (request) => {
  const user = await requireUser(request)
  const { tripId, taskId } = request.params as { tripId: string; taskId: string }
  const role = await requireTripRole(tripId, user.id)
  const task = (await db.query('SELECT * FROM tasks WHERE id=$1 AND trip_id=$2', [taskId, tripId])).rows[0]
  if (!task) throw httpError(404, 'Задача не найдена')
  if (role !== 'owner' && task.created_by !== user.id) throw httpError(403, 'Можно редактировать только добавленные вами задачи')
  const body = bodyOf(request.body)
  const result = await db.query('UPDATE tasks SET title=coalesce($3,title), done=coalesce($4,done), updated_at=now() WHERE id=$1 AND trip_id=$2 RETURNING *', [taskId, tripId, optionalText(body.title), typeof body.done === 'boolean' ? body.done : null])
  return { task: result.rows[0] }
})

app.post(`${apiPrefix}/documents`, async (request, reply) => {
  const user = await requireUser(request)
  const query = request.query as { tripId?: string; cityId?: string; category?: string }
  const tripId = text(query.tripId)
  const category = text(query.category)
  if (!tripId || !category) throw httpError(400, 'Нужны tripId и category')
  await requireTripRole(tripId, user.id)
  const upload = await request.file()
  if (!upload) throw httpError(400, 'Файл не выбран')
  await mkdir(config.uploadDir, { recursive: true })
  const id = crypto.randomUUID()
  const extension = path.extname(upload.filename).slice(0, 16)
  const storageKey = `${id}${extension}`
  const target = path.join(config.uploadDir, storageKey)
  let size = 0
  upload.file.on('data', (chunk: Buffer) => { size += chunk.length })
  await pipeline(upload.file, createWriteStream(target, { flags: 'wx' }))
  try {
    const result = await db.query(
      `INSERT INTO documents(id,trip_id,city_id,category,original_name,storage_key,mime_type,size_bytes,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,trip_id,city_id,category,original_name,mime_type,size_bytes,created_at`,
      [id, tripId, text(query.cityId) || null, category, upload.filename, storageKey, upload.mimetype, size, user.id],
    )
    reply.code(201)
    return { document: result.rows[0] }
  } catch (error) {
    await unlink(target).catch(() => undefined)
    throw error
  }
})

app.get(`${apiPrefix}/documents/:documentId/download`, async (request, reply) => {
  const user = await requireUser(request)
  const { documentId } = request.params as { documentId: string }
  const document = (await db.query('SELECT * FROM documents WHERE id=$1', [documentId])).rows[0]
  if (!document) throw httpError(404, 'Файл не найден')
  await requireTripRole(document.trip_id, user.id)
  reply.header('Content-Type', document.mime_type)
  reply.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(document.original_name)}`)
  return reply.send(createReadStream(path.join(config.uploadDir, document.storage_key)))
})

const close = async () => {
  await app.close()
  await db.end()
}
process.on('SIGINT', close)
process.on('SIGTERM', close)

await app.listen({ host: config.host, port: config.port })
