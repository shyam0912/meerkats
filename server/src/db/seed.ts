import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, type Database } from './connection.js';
import { parseEnv, type Config } from '../config/env.js';
import { schools, users, memberships } from './schema.js';
export async function seedIdentity(db: Database, config: Config) {
  await db.transaction(async tx => {
    await tx.insert(schools).values({ id: config.DEV_SCHOOL_ID, name: 'Local development school' }).onConflictDoNothing();
    await tx.insert(users).values({ id: config.DEV_USER_ID, issuer: 'meerkats:development', subject: config.DEV_USER_ID }).onConflictDoNothing();
    await tx.insert(memberships).values({ schoolId: config.DEV_SCHOOL_ID, userId: config.DEV_USER_ID, role: 'teacher' }).onConflictDoNothing();
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = parseEnv(process.env); const { db, pool } = connect(config.DATABASE_URL);
  try { await seedIdentity(db, config); } finally { await pool.end(); }
  console.log('Development membership seeded');
}
