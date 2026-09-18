import path from 'node:path'

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

export const config = {
  host: process.env.API_HOST ?? '0.0.0.0',
  port: integer(process.env.API_PORT, 3000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://travel:travel@127.0.0.1:5432/travel',
  publicOrigin: process.env.PUBLIC_ORIGIN ?? 'http://127.0.0.1:4173',
  basePath: process.env.BASE_PATH ?? '/travel',
  uploadDir: path.resolve(process.env.UPLOAD_DIR ?? './data/uploads'),
  maxUploadBytes: integer(process.env.MAX_UPLOAD_BYTES, 15 * 1024 * 1024),
  maxImportBytes: integer(process.env.MAX_IMPORT_BYTES, 200 * 1024 * 1024),
  sessionTtlDays: integer(process.env.SESSION_TTL_DAYS, 30),
  nodeEnv: process.env.NODE_ENV ?? 'development',
}

export const apiPrefix = `${config.basePath.replace(/\/$/, '')}/api`
