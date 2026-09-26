import { parseEnv } from './config/env.js';
import { connect } from './db/connection.js';
import { buildApp } from './app.js';
const config = parseEnv(process.env);
const { db, pool } = connect(config.DATABASE_URL);
const app = buildApp(db, config, true);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
  void app.close().then(() => pool.end());
});
await app.listen({ host: config.HOST, port: config.PORT });
