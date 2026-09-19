import { createReadStream, createWriteStream, existsSync } from 'node:fs'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import Fastify from 'fastify'
import { createToken, hashPassword, hashToken, requireTripRole, requireUser, verifyPassword } from './auth.js'
import { apiPrefix, config } from './config.js'
import { db, transaction } from './db.js'
import { runMigrations } from './migrate.js'

type Json = Record<string, unknown>
const bodyOf = (value: unknown) => (value && typeof value === 'object' ? value as Json : {})
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const passwordText = (value: unknown) => typeof value === 'string' ? value : ''
const optionalText = (value: unknown) => typeof value === 'string' ? value.trim() : undefined
const optionalCoordinate = (value: unknown, min: number, max: number) => {
  if (value === undefined || value === null || value === '') return undefined
  const number = Number(value)
  if (!Number.isFinite(number) || number < min || number > max) throw httpError(400, 'Некорректные координаты места')
  return number
}
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const httpError = (statusCode: number, message: string) => Object.assign(new Error(message), { statusCode })

const app = Fastify({ logger: true, bodyLimit: config.maxUploadBytes })
await app.register(cors, { origin: [config.publicOrigin], credentials: true })
await app.register(multipart, { limits: { fileSize: config.maxUploadBytes, files: 1 } })

// Собранный SPA лежит в образе рядом с API. При локальной разработке его нет —
// статику отдаёт vite dev server, поэтому плагин просто не регистрируется.
const spaAvailable = existsSync(config.spaDir)

if (spaAvailable) {
  await app.register(fastifyStatic, {
    root: config.spaDir,
    prefix: `${config.basePath}/`,
    // wildcard: false оставляет несуществующие пути setNotFoundHandler'у.
    // С wildcard: true плагин сам отвечал бы 404, и вложенные клиентские
    // маршруты нельзя было бы открыть по прямой ссылке.
    wildcard: false,
  })

  app.get(config.basePath, (_request, reply) => reply.redirect(`${config.basePath}/`, 301))
}

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

app.patch(`${apiPrefix}/me`, async (request) => {
  const user = await requireUser(request)
  const body = bodyOf(request.body)
  const email = text(body.email).toLowerCase()
  const displayName = text(body.displayName)
  const password = passwordText(body.password)
  if (!/^\S+@\S+\.\S+$/.test(email)) throw httpError(400, 'Укажите корректный email')
  if (!displayName) throw httpError(400, 'Укажите имя')
  if (password && password.length < 8) throw httpError(400, 'Пароль должен содержать не менее 8 символов')
  if (password.length > 256) throw httpError(400, 'Пароль не должен быть длиннее 256 символов')
  if ((await db.query('SELECT 1 FROM users WHERE email=$1 AND id<>$2', [email, user.id])).rowCount) throw httpError(409, 'Аккаунт с таким email уже есть')
  const passwordHash = password ? await hashPassword(password) : undefined
  const updated = (await db.query<{ id: string; email: string; display_name: string }>(
    `UPDATE users
        SET email=$2, display_name=$3, password_hash=coalesce($4,password_hash), updated_at=now()
      WHERE id=$1
      RETURNING id,email,display_name`,
    [user.id, email, displayName, passwordHash],
  )).rows[0]
  return { user: { id: updated.id, email: updated.email, displayName: updated.display_name, hasAvatar: user.hasAvatar } }
})

app.get(`${apiPrefix}/me/avatar`, async (request, reply) => {
  const user = await requireUser(request)
  const avatar = (await db.query<{ avatar_storage_key: string; avatar_mime_type: string }>('SELECT avatar_storage_key,avatar_mime_type FROM users WHERE id=$1', [user.id])).rows[0]
  if (!avatar?.avatar_storage_key) throw httpError(404, 'Аватар не найден')
  reply.header('Content-Type', avatar.avatar_mime_type)
  return reply.send(createReadStream(path.join(config.uploadDir, avatar.avatar_storage_key)))
})

app.post(`${apiPrefix}/me/avatar`, async (request) => {
  const user = await requireUser(request)
  const upload = await request.file()
  if (!upload) throw httpError(400, 'Файл не выбран')
  if (!upload.mimetype.startsWith('image/')) throw httpError(400, 'Аватар должен быть изображением')
  await mkdir(config.uploadDir, { recursive: true })
  const extension = path.extname(upload.filename).slice(0, 16)
  const storageKey = `${crypto.randomUUID()}${extension}`
  const target = path.join(config.uploadDir, storageKey)
  await pipeline(upload.file, createWriteStream(target, { flags: 'wx' }))
  try {
    const previous = (await db.query<{ avatar_storage_key: string | null }>('SELECT avatar_storage_key FROM users WHERE id=$1', [user.id])).rows[0]
    await db.query(
      `UPDATE users SET avatar_storage_key=$2,avatar_original_name=$3,avatar_mime_type=$4,updated_at=now()
        WHERE id=$1`,
      [user.id, storageKey, upload.filename, upload.mimetype],
    )
    if (previous?.avatar_storage_key && previous.avatar_storage_key !== storageKey) await unlink(path.join(config.uploadDir, previous.avatar_storage_key)).catch(() => undefined)
    return { ok: true }
  } catch (error) {
    await unlink(target).catch(() => undefined)
    throw error
  }
})

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
  const backgroundRemoved = body.backgroundRemoved === true
  if (!name || !datePattern.test(startDate) || !datePattern.test(endDate) || endDate < startDate) throw httpError(400, 'Проверьте название и даты поездки')
  const trip = await transaction(async (client) => {
    const result = await client.query(
      'INSERT INTO trips(owner_id, name, start_date, end_date, background_removed) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [user.id, name, startDate, endDate, backgroundRemoved],
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
        'INSERT INTO trips(owner_id,name,start_date,end_date,background_removed) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [user.id, tripName, startDate, endDate, bundle.trip.backgroundRemoved === true],
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
          `INSERT INTO cities(trip_id,name,position,arrival_date,departure_date,arrival_period,departure_period,hotel,hotel_url,hotel_check_in_time,hotel_check_out_time,train_in,train_out,created_by,
             transport_in_type,transport_out_type,transport_in_departure_time,transport_in_arrival_time,transport_out_departure_time,transport_out_arrival_time,transport_in_departure_station,transport_in_departure_station_url,transport_in_arrival_station,transport_in_arrival_station_url,transport_out_departure_station,transport_out_departure_station_url,transport_out_arrival_station,transport_out_arrival_station_url,hotel_notes,transport_in_notes,transport_out_notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31) RETURNING id`,
          [createdTrip.id, name, index, arrivalDate, departureDate, arrivalPeriod, departurePeriod, text(source.hotel), text(source.hotelUrl), text(source.hotelCheckInTime), text(source.hotelCheckOutTime), text(source.trainIn), text(source.trainOut), user.id,
            optionalText(source.transportInType) || null, optionalText(source.transportOutType) || null, text(source.transportInDepartureTime), text(source.transportInArrivalTime), text(source.transportOutDepartureTime), text(source.transportOutArrivalTime), text(source.transportInDepartureStation), text(source.transportInDepartureStationUrl), text(source.transportInArrivalStation ?? source.transportInStation), text(source.transportInArrivalStationUrl ?? source.transportInStationUrl), text(source.transportOutDepartureStation ?? source.transportOutStation), text(source.transportOutDepartureStationUrl ?? source.transportOutStationUrl), text(source.transportOutArrivalStation), text(source.transportOutArrivalStationUrl), text(source.hotelNotes), text(source.transportInNotes), text(source.transportOutNotes)],
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
          `INSERT INTO places(trip_id,city_id,visit_date,name,google_maps_url,latitude,longitude,position,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [createdTrip.id, cityId, visitDate, text(source.name), text(source.googleMapsUrl), optionalCoordinate(source.latitude, -90, 90) ?? null, optionalCoordinate(source.longitude, -180, 180) ?? null, Number.isInteger(source.position) ? source.position : 0, user.id],
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
      for (const source of Array.isArray(bundle.dayNotes) ? bundle.dayNotes : []) {
        const date = text(source.date)
        const description = text(source.description)
        if (!datePattern.test(date) || date < startDate || date > endDate) throw httpError(400, 'Некорректное описание дня в файле')
        if (!description) continue
        await client.query(
          'INSERT INTO trip_day_notes(trip_id,day_date,description,updated_by) VALUES ($1,$2,$3,$4)',
          [createdTrip.id, date, description, user.id],
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
  const [tripResult, cities, places, tasks, dayNotes, documents, members] = await Promise.all([
    db.query('SELECT id, name, start_date, end_date, owner_id, background_removed, created_at, updated_at FROM trips WHERE id = $1', [tripId]),
    db.query('SELECT * FROM cities WHERE trip_id = $1 ORDER BY position', [tripId]),
    db.query('SELECT * FROM places WHERE trip_id = $1 ORDER BY city_id, visit_date NULLS FIRST, position', [tripId]),
    db.query('SELECT * FROM tasks WHERE trip_id = $1 ORDER BY created_at', [tripId]),
    db.query('SELECT trip_id,day_date,description FROM trip_day_notes WHERE trip_id = $1 ORDER BY day_date', [tripId]),
    db.query('SELECT d.id, d.trip_id, d.city_id, d.category, d.original_name, d.mime_type, d.size_bytes, d.created_by, d.created_at, u.display_name AS created_by_name FROM documents d JOIN users u ON u.id = d.created_by WHERE d.trip_id = $1 ORDER BY d.created_at', [tripId]),
    db.query(`SELECT u.id, u.email, u.display_name, (u.avatar_storage_key IS NOT NULL) AS has_avatar, tm.role, tm.joined_at FROM trip_members tm JOIN users u ON u.id = tm.user_id WHERE tm.trip_id = $1`, [tripId]),
  ])
  const trip = tripResult.rows[0]
  if (!trip) throw httpError(404, 'Поездка не найдена')
  return { trip: { ...trip, role, cities: cities.rows, places: places.rows, tasks: tasks.rows, day_notes: dayNotes.rows, documents: documents.rows, members: members.rows } }
})

app.put(`${apiPrefix}/trips/:tripId/days/:date`, async (request) => {
  const user = await requireUser(request)
  const { tripId, date } = request.params as { tripId: string; date: string }
  await requireTripRole(tripId, user.id)
  if (!datePattern.test(date)) throw httpError(400, 'Некорректная дата')
  const trip = (await db.query<{ start_date: string; end_date: string }>('SELECT start_date::text,end_date::text FROM trips WHERE id=$1', [tripId])).rows[0]
  if (!trip) throw httpError(404, 'Поездка не найдена')
  if (date < trip.start_date || date > trip.end_date) throw httpError(400, 'Дата находится за пределами поездки')
  const description = text(bodyOf(request.body).description)
  if (!description) {
    await db.query('DELETE FROM trip_day_notes WHERE trip_id=$1 AND day_date=$2', [tripId, date])
    return { note: null }
  }
  const note = (await db.query(
    `INSERT INTO trip_day_notes(trip_id,day_date,description,updated_by) VALUES ($1,$2,$3,$4)
     ON CONFLICT (trip_id,day_date) DO UPDATE SET description=excluded.description,updated_by=excluded.updated_by,updated_at=now()
     RETURNING trip_id,day_date,description`,
    [tripId, date, description, user.id],
  )).rows[0]
  return { note }
})

app.get(`${apiPrefix}/trips/:tripId/members/:memberId/avatar`, async (request, reply) => {
  const user = await requireUser(request)
  const { tripId, memberId } = request.params as { tripId: string; memberId: string }
  await requireTripRole(tripId, user.id)
  const avatar = (await db.query<{ avatar_storage_key: string; avatar_mime_type: string }>(
    `SELECT u.avatar_storage_key,u.avatar_mime_type
       FROM trip_members tm JOIN users u ON u.id=tm.user_id
      WHERE tm.trip_id=$1 AND u.id=$2`,
    [tripId, memberId],
  )).rows[0]
  if (!avatar?.avatar_storage_key) throw httpError(404, 'Аватар не найден')
  reply.header('Content-Type', avatar.avatar_mime_type)
  return reply.send(createReadStream(path.join(config.uploadDir, avatar.avatar_storage_key)))
})

app.get(`${apiPrefix}/trips/:tripId/export`, async (request, reply) => {
  const user = await requireUser(request)
  const { tripId } = request.params as { tripId: string }
  await requireTripRole(tripId, user.id, true)
  const [tripResult, cities, places, tasks, dayNotes, documents] = await Promise.all([
    db.query('SELECT name,start_date::text,end_date::text,background_removed FROM trips WHERE id=$1', [tripId]),
    db.query('SELECT * FROM cities WHERE trip_id=$1 ORDER BY position', [tripId]),
    db.query('SELECT * FROM places WHERE trip_id=$1 ORDER BY city_id,visit_date NULLS FIRST,position', [tripId]),
    db.query('SELECT * FROM tasks WHERE trip_id=$1 ORDER BY created_at', [tripId]),
    db.query('SELECT day_date,description FROM trip_day_notes WHERE trip_id=$1 ORDER BY day_date', [tripId]),
    db.query('SELECT * FROM documents WHERE trip_id=$1 ORDER BY created_at', [tripId]),
  ])
  const trip = tripResult.rows[0]
  if (!trip) throw httpError(404, 'Поездка не найдена')
  const bundle = {
    format: 'travel-space', version: 1, exportedAt: new Date().toISOString(),
    trip: { name: trip.name, startDate: trip.start_date, endDate: trip.end_date, backgroundRemoved: trip.background_removed },
    cities: cities.rows.map((city) => ({ id: city.id, name: city.name, arrivalDate: String(city.arrival_date).slice(0,10), departureDate: String(city.departure_date).slice(0,10), arrivalPeriod: city.arrival_period, departurePeriod: city.departure_period, hotel: city.hotel, hotelUrl: city.hotel_url, hotelCheckInTime: city.hotel_check_in_time, hotelCheckOutTime: city.hotel_check_out_time, hotelNotes: city.hotel_notes, trainIn: city.train_in, trainOut: city.train_out,
      transportInType: city.transport_in_type, transportOutType: city.transport_out_type, transportInDepartureTime: city.transport_in_departure_time, transportInArrivalTime: city.transport_in_arrival_time, transportOutDepartureTime: city.transport_out_departure_time, transportOutArrivalTime: city.transport_out_arrival_time, transportInDepartureStation: city.transport_in_departure_station, transportInDepartureStationUrl: city.transport_in_departure_station_url, transportInArrivalStation: city.transport_in_arrival_station, transportInArrivalStationUrl: city.transport_in_arrival_station_url, transportOutDepartureStation: city.transport_out_departure_station, transportOutDepartureStationUrl: city.transport_out_departure_station_url, transportOutArrivalStation: city.transport_out_arrival_station, transportOutArrivalStationUrl: city.transport_out_arrival_station_url, transportInNotes: city.transport_in_notes, transportOutNotes: city.transport_out_notes })),
    places: places.rows.map((place) => ({ cityId: place.city_id, visitDate: place.visit_date ? String(place.visit_date).slice(0,10) : null, name: place.name, googleMapsUrl: place.google_maps_url, latitude: place.latitude, longitude: place.longitude, position: place.position })),
    tasks: tasks.rows.map((task) => ({ cityId: task.city_id, dueDate: task.due_date ? String(task.due_date).slice(0,10) : null, title: task.title, done: task.done })),
    dayNotes: dayNotes.rows.map((note) => ({ date: String(note.day_date).slice(0,10), description: note.description })),
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
  const current = (await db.query<{ name: string; start_date: string; end_date: string; background_removed: boolean }>('SELECT name, start_date::text, end_date::text, background_removed FROM trips WHERE id = $1', [tripId])).rows[0]
  if (!current) throw httpError(404, 'Поездка не найдена')
  const name = optionalText(body.name) ?? current.name
  const startDate = optionalText(body.startDate) ?? current.start_date
  const endDate = optionalText(body.endDate) ?? current.end_date
  const backgroundRemoved = typeof body.backgroundRemoved === 'boolean' ? body.backgroundRemoved : current.background_removed
  if (!name || !datePattern.test(startDate) || !datePattern.test(endDate) || endDate < startDate) throw httpError(400, 'Некорректные даты поездки')
  const outside = await db.query('SELECT 1 FROM cities WHERE trip_id = $1 AND (arrival_date < $2 OR departure_date > $3) LIMIT 1', [tripId, startDate, endDate])
  if (outside.rowCount) throw httpError(409, 'Сначала перенесите даты городов внутрь нового диапазона')
  const result = await db.query('UPDATE trips SET name = $2, start_date = $3, end_date = $4, background_removed = $5, updated_at = now() WHERE id = $1 RETURNING *', [tripId, name, startDate, endDate, backgroundRemoved])
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
    `INSERT INTO cities(trip_id, name, position, arrival_date, departure_date, arrival_period, departure_period, hotel, hotel_url, hotel_check_in_time, hotel_check_out_time, hotel_notes, transport_in_notes, transport_out_notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [tripId, input.name, nextPosition, input.arrivalDate, input.departureDate, input.arrivalPeriod, input.departurePeriod, text(bodyOf(request.body).hotel), text(bodyOf(request.body).hotelUrl), text(bodyOf(request.body).hotelCheckInTime), text(bodyOf(request.body).hotelCheckOutTime), text(bodyOf(request.body).hotelNotes), text(bodyOf(request.body).transportInNotes), text(bodyOf(request.body).transportOutNotes), user.id],
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
  const transportTypes = [body.transportInType, body.transportOutType].filter((value) => value !== undefined)
  if (transportTypes.some((value) => typeof value !== 'string' || !['train', 'plane', 'bus', 'ship'].includes(value))) throw httpError(400, 'Некорректный тип транспорта')
  const input = await validatedCityInput(tripId, {
    name: optionalText(body.name) ?? current.name,
    arrivalDate: optionalText(body.arrivalDate) ?? String(current.arrival_date).slice(0, 10),
    departureDate: optionalText(body.departureDate) ?? String(current.departure_date).slice(0, 10),
    arrivalPeriod: optionalText(body.arrivalPeriod) ?? current.arrival_period,
    departurePeriod: optionalText(body.departurePeriod) ?? current.departure_period,
  })
  const result = await db.query(
    `UPDATE cities SET name=$3, arrival_date=$4, departure_date=$5, arrival_period=$6, departure_period=$7,
       hotel=coalesce($8,hotel), train_in=coalesce($9,train_in), train_out=coalesce($10,train_out),
       transport_in_type=coalesce($11,transport_in_type), transport_out_type=coalesce($12,transport_out_type),
       transport_in_departure_time=coalesce($13,transport_in_departure_time), transport_in_arrival_time=coalesce($14,transport_in_arrival_time),
       transport_out_departure_time=coalesce($15,transport_out_departure_time), transport_out_arrival_time=coalesce($16,transport_out_arrival_time),
       transport_in_departure_station=coalesce($17,transport_in_departure_station), transport_in_departure_station_url=coalesce($18,transport_in_departure_station_url),
       transport_in_arrival_station=coalesce($19,transport_in_arrival_station), transport_in_arrival_station_url=coalesce($20,transport_in_arrival_station_url),
       transport_out_departure_station=coalesce($21,transport_out_departure_station), transport_out_departure_station_url=coalesce($22,transport_out_departure_station_url),
       transport_out_arrival_station=coalesce($23,transport_out_arrival_station), transport_out_arrival_station_url=coalesce($24,transport_out_arrival_station_url),
       hotel_url=coalesce($25,hotel_url), hotel_check_in_time=coalesce($26,hotel_check_in_time), hotel_check_out_time=coalesce($27,hotel_check_out_time),
       hotel_notes=coalesce($28,hotel_notes), transport_in_notes=coalesce($29,transport_in_notes), transport_out_notes=coalesce($30,transport_out_notes), updated_at=now()
     WHERE id=$1 AND trip_id=$2 RETURNING *`,
    [cityId, tripId, input.name, input.arrivalDate, input.departureDate, input.arrivalPeriod, input.departurePeriod, optionalText(body.hotel), optionalText(body.trainIn), optionalText(body.trainOut),
      optionalText(body.transportInType), optionalText(body.transportOutType), optionalText(body.transportInDepartureTime), optionalText(body.transportInArrivalTime),
      optionalText(body.transportOutDepartureTime), optionalText(body.transportOutArrivalTime), optionalText(body.transportInDepartureStation), optionalText(body.transportInDepartureStationUrl),
      optionalText(body.transportInArrivalStation), optionalText(body.transportInArrivalStationUrl), optionalText(body.transportOutDepartureStation), optionalText(body.transportOutDepartureStationUrl),
      optionalText(body.transportOutArrivalStation), optionalText(body.transportOutArrivalStationUrl), optionalText(body.hotelUrl), optionalText(body.hotelCheckInTime), optionalText(body.hotelCheckOutTime),
      optionalText(body.hotelNotes), optionalText(body.transportInNotes), optionalText(body.transportOutNotes)],
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
  const latitude = optionalCoordinate(body.latitude, -90, 90)
  const longitude = optionalCoordinate(body.longitude, -180, 180)
  if ((latitude === undefined) !== (longitude === undefined)) throw httpError(400, 'Широта и долгота должны быть указаны вместе')
  if (!name) throw httpError(400, 'Название места обязательно')
  const city = (await db.query<{ arrival_date: string; departure_date: string }>('SELECT arrival_date::text, departure_date::text FROM cities WHERE id=$1 AND trip_id=$2', [cityId, tripId])).rows[0]
  if (!city) throw httpError(404, 'Город не найден')
  if (visitDate && (!datePattern.test(visitDate) || visitDate < city.arrival_date || visitDate > city.departure_date)) throw httpError(400, 'Дата места должна быть внутри дат города')
  const position = Number((await db.query('SELECT coalesce(max(position), -1) + 1 AS value FROM places WHERE city_id=$1 AND visit_date IS NOT DISTINCT FROM $2', [cityId, visitDate])).rows[0].value)
  const result = await db.query(
    `INSERT INTO places(trip_id,city_id,visit_date,name,google_maps_url,latitude,longitude,position,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [tripId, cityId, visitDate, name, text(body.googleMapsUrl), latitude ?? null, longitude ?? null, position, user.id],
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
  const latitude = optionalCoordinate(body.latitude, -90, 90)
  const longitude = optionalCoordinate(body.longitude, -180, 180)
  if ((latitude === undefined) !== (longitude === undefined)) throw httpError(400, 'Широта и долгота должны быть указаны вместе')
  const result = await db.query(
    `UPDATE places SET name=coalesce($3,name), google_maps_url=coalesce($4,google_maps_url), visit_date=coalesce($5,visit_date), position=coalesce($6,position), latitude=coalesce($7,latitude), longitude=coalesce($8,longitude), updated_at=now()
     WHERE id=$1 AND trip_id=$2 RETURNING *`,
    [placeId, tripId, optionalText(body.name), optionalText(body.googleMapsUrl), optionalText(body.visitDate), Number.isInteger(body.position) ? body.position : null, latitude ?? null, longitude ?? null],
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
  if (category === 'city-image' && !text(query.cityId)) throw httpError(400, 'Для фото города нужен cityId')
  await requireTripRole(tripId, user.id, category === 'trip-background' || category === 'city-image')
  const upload = await request.file()
  if (!upload) throw httpError(400, 'Файл не выбран')
  if ((category === 'trip-background' || category === 'city-image') && !upload.mimetype.startsWith('image/')) throw httpError(400, 'Фото должно быть изображением')
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
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,trip_id,city_id,category,original_name,mime_type,size_bytes,created_by,created_at`,
      [id, tripId, text(query.cityId) || null, category, upload.filename, storageKey, upload.mimetype, size, user.id],
    )
    if (category === 'trip-background') {
      const previous = await db.query<{ storage_key: string }>("DELETE FROM documents WHERE trip_id=$1 AND category='trip-background' AND id<>$2 RETURNING storage_key", [tripId, id])
      await db.query('UPDATE trips SET background_removed=false,updated_at=now() WHERE id=$1', [tripId])
      await Promise.all(previous.rows.map((item) => unlink(path.join(config.uploadDir, item.storage_key)).catch(() => undefined)))
    }
    if (category === 'city-image') {
      const cityId = text(query.cityId)
      const previous = await db.query<{ storage_key: string }>("DELETE FROM documents WHERE trip_id=$1 AND city_id=$2 AND category='city-image' AND id<>$3 RETURNING storage_key", [tripId, cityId, id])
      await Promise.all(previous.rows.map((item) => unlink(path.join(config.uploadDir, item.storage_key)).catch(() => undefined)))
    }
    reply.code(201)
    return { document: { ...result.rows[0], created_by_name: user.displayName } }
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

app.delete(`${apiPrefix}/documents/:documentId`, async (request, reply) => {
  const user = await requireUser(request)
  const { documentId } = request.params as { documentId: string }
  const document = (await db.query('SELECT * FROM documents WHERE id=$1', [documentId])).rows[0]
  if (!document) throw httpError(404, 'Файл не найден')
  const role = await requireTripRole(document.trip_id, user.id)
  if (role !== 'owner' && document.created_by !== user.id) throw httpError(403, 'Удалить файл может его автор или владелец поездки')
  const routeSuffix = /^train-(?:in|out):(.+)$/.exec(document.category)?.[1]
  const deleted = routeSuffix
    ? await db.query<{ storage_key: string }>("DELETE FROM documents WHERE trip_id=$1 AND category IN ($2,$3) RETURNING storage_key", [document.trip_id, `train-in:${routeSuffix}`, `train-out:${routeSuffix}`])
    : await db.query<{ storage_key: string }>('DELETE FROM documents WHERE id=$1 RETURNING storage_key', [documentId])
  await Promise.all(deleted.rows.map((item) => unlink(path.join(config.uploadDir, item.storage_key)).catch(() => undefined)))
  reply.code(204).send()
})


// Клиентские маршруты вроде /travel/join/<token> существуют только в браузере:
// сервер отдаёт на них index.html, а разбирает путь уже само приложение.
app.setNotFoundHandler((request, reply) => {
  const pathname = request.url.split('?')[0]
  const isApi = pathname === apiPrefix || pathname.startsWith(`${apiPrefix}/`)
  const isSpaRoute = pathname === config.basePath || pathname.startsWith(`${config.basePath}/`)
  if (spaAvailable && request.method === 'GET' && isSpaRoute && !isApi) return reply.sendFile('index.html')
  return reply.code(404).send({ error: 'Не найдено' })
})

const close = async () => {
  await app.close()
  await db.end()
}
process.on('SIGINT', close)
process.on('SIGTERM', close)

// Схема приводится в актуальное состояние до того, как откроется порт, поэтому
// работающий контейнер никогда не обслуживает запросы на устаревшей базе.
if (config.skipMigrations) {
  app.log.warn('TRAVEL_SKIP_MIGRATIONS=true — миграции пропущены')
} else {
  await runMigrations((message) => app.log.info(message))
}

await app.listen({ host: config.host, port: config.port })
