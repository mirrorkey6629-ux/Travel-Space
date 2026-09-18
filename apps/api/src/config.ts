import path from 'node:path'
import { fileURLToPath } from 'node:url'

try {
  const fromApiDirectory = process.cwd().endsWith(path.join('apps', 'api'))
  process.loadEnvFile(path.resolve(process.cwd(), fromApiDirectory ? '../../.env' : '.env'))
} catch {
  // Все параметры имеют безопасные локальные значения по умолчанию.
}

const integer = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const flag = (value: string | undefined) => value === 'true'

// Каталог этого модуля — apps/api/src под tsx и apps/api/dist после сборки.
// В обоих случаях собранный SPA лежит тремя уровнями выше, в корне репозитория.
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))

export const config = {
  host: process.env.API_HOST ?? '0.0.0.0',
  port: integer(process.env.API_PORT, 3000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://travel:travel@127.0.0.1:5432/travel',
  publicOrigin: process.env.PUBLIC_ORIGIN ?? 'http://127.0.0.1:4173',
  // Без завершающего слэша: он мешал бы склейке путей вроде `${basePath}/api`.
  basePath: (process.env.BASE_PATH ?? '/travel').replace(/\/+$/, ''),
  spaDir: path.resolve(process.env.SPA_DIST_DIR ?? path.join(moduleDirectory, '../../../dist')),
  uploadDir: path.resolve(process.env.UPLOAD_DIR ?? './data/uploads'),
  maxUploadBytes: integer(process.env.MAX_UPLOAD_BYTES, 15 * 1024 * 1024),
  maxImportBytes: integer(process.env.MAX_IMPORT_BYTES, 200 * 1024 * 1024),
  sessionTtlDays: integer(process.env.SESSION_TTL_DAYS, 30),
  // Аварийный выключатель: поднять контейнер, не трогая схему базы.
  skipMigrations: flag(process.env.TRAVEL_SKIP_MIGRATIONS),
  nodeEnv: process.env.NODE_ENV ?? 'development',
}

export const apiPrefix = `${config.basePath}/api`
