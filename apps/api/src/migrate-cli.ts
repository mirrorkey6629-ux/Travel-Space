import { db } from './db.js'
import { runMigrations } from './migrate.js'

// Отдельная точка входа для локальной разработки: `pnpm db:migrate`.
// Сервер вызывает runMigrations сам и пул не закрывает.
await runMigrations()
await db.end()
