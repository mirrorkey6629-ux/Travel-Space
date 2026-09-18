import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, transaction } from './db.js'

const directory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations')

// Произвольный, но постоянный ключ advisory-блокировки. База выделена под это
// приложение, поэтому столкнуться с чужим ключом здесь не с чем.
const LOCK_KEY = 20260918

// Миграции применяются при старте каждого экземпляра API. Блокировка на уровне
// сессии PostgreSQL гарантирует, что при одновременном старте нескольких
// экземпляров файлы накатит ровно один, а остальные дождутся его и увидят уже
// заполненную schema_migrations.
export async function runMigrations(log: (message: string) => void = console.log) {
  const client = await db.connect()
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY])
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    )
    const applied = new Set(
      (await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((row) => row.name),
    )
    const files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()
    let count = 0

    for (const name of files) {
      if (applied.has(name)) continue
      const sql = await readFile(path.join(directory, name), 'utf8')
      await transaction(async (migration) => {
        await migration.query(sql)
        await migration.query('INSERT INTO schema_migrations(name) VALUES ($1)', [name])
      })
      log(`Applied ${name}`)
      count += 1
    }

    if (count === 0) log('Schema is up to date')
    return count
  } finally {
    // Снимать блокировку нужно тем же соединением, которое её взяло.
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => undefined)
    client.release()
  }
}
