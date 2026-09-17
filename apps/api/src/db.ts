import pg from 'pg'
import { config } from './config.js'

const { Pool } = pg

// PostgreSQL DATE is a calendar value, not a moment in time. Returning it as a
// string prevents the Node driver from shifting dates across time zones.
pg.types.setTypeParser(1082, (value) => value)

export const db = new Pool({ connectionString: config.databaseUrl })

export async function transaction<T>(run: (client: pg.PoolClient) => Promise<T>) {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const result = await run(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
