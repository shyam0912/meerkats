import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
export function connect(url: string) {
  const pool = new pg.Pool({ connectionString: url, max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000,
    statement_timeout: 10000 });
  return { pool, db: drizzle(pool) };
}
export type Database = ReturnType<typeof connect>['db'];
