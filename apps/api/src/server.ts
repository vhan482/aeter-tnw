import 'dotenv/config';
import pg from 'pg';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig(process.env);
const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 3,
  connectionTimeoutMillis: 2500,
  idleTimeoutMillis: 30000
});

pool.on('error', () => console.error('[aeter-api] database pool disconnected'));
const server = createApp(pool, config).listen(config.PORT, config.HOST, () => {
  console.log(`[aeter-api] listening on http://${config.HOST}:${config.PORT}`);
});

async function shutdown() {
  server.close();
  await pool.end();
}
process.once('SIGINT', () => void shutdown().then(() => process.exit(0)));
process.once('SIGTERM', () => void shutdown().then(() => process.exit(0)));
