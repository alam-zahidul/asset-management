import { Pool } from 'pg';
import { config } from './index';
import { logger } from '../utils/logger';

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  max: config.db.max,
  idleTimeoutMillis: config.db.idleTimeoutMillis,
  connectionTimeoutMillis: config.db.connectionTimeoutMillis,
});

pool.on('error', (err) => {
  logger.error('Unexpected database pool error', { error: err.message });
});

export async function query(text: string, params?: unknown[]) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  logger.debug('Executed query', { text: text.substring(0, 100), duration, rows: result.rowCount });
  return result;
}

export async function getClient() {
  const client = await pool.connect();
  return client;
}
