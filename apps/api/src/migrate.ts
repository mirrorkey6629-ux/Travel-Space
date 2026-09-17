import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, transaction } from './db.js'

const directory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations')

await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`)
const applied = new Set((await db.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((row) => row.name))
const files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()

for (const name of files) {
  if (applied.has(name)) continue
  const sql = await readFile(path.join(directory, name), 'utf8')
  await transaction(async (client) => {
    await client.query(sql)
    await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [name])
  })
  console.log(`Applied ${name}`)
}

await db.end()

