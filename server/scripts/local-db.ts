import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from '../src/config/env.js';
const config = parseEnv(process.env);
const url = new URL(config.DATABASE_URL);
if (url.pathname !== '/meerkats_dev') throw new Error('Local development launcher requires meerkats_dev');
const directory = resolve('.data/development');
const postgres = new EmbeddedPostgres({ databaseDir: directory, user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
  port: Number(url.port), persistent: true, authMethod: 'scram-sha-256', postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
if (!existsSync(resolve(directory, 'PG_VERSION'))) await postgres.initialise();
await postgres.start();
const client = postgres.getPgClient(); await client.connect();
const found = await client.query("SELECT 1 FROM pg_database WHERE datname = 'meerkats_dev'");
if (!found.rowCount) await client.query('CREATE DATABASE meerkats_dev');
await client.end();
console.log('Development PostgreSQL ready on loopback. Data retained in server/.data/development. Ctrl+C to stop.');
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void postgres.stop(); });
