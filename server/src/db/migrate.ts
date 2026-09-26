import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { connect } from './connection.js';
import { parseEnv } from '../config/env.js';
export async function applyMigrations(url: string) {
  const { pool, db } = connect(url);
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(739821)');
    await migrate(db, { migrationsFolder: resolve('drizzle') });
  } finally {
    await client.query('SELECT pg_advisory_unlock(739821)');
    client.release(); await pool.end();
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await applyMigrations(parseEnv(process.env).DATABASE_URL);
  console.log('Migrations applied');
}
