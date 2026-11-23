import pg from 'pg';
import { env } from '../config/env.js';

// pg is an older CommonJS package, so under ESM we import the default and pull Pool out of it.
const { Pool } = pg;

// A pool keeps a handful of database connections open and lends them out.
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10, // never more than 10 simultaneous connections
  idleTimeoutMillis: 30_000, // close connections nobody has used for 30s
  connectionTimeoutMillis: 5_000, // fail fast (5s) instead of hanging if the DB is down
});

// If Postgres restarts, idle pooled connections emit 'error'. Without a listener,
// Node would treat that as an uncaught error and crash the whole server.
pool.on('error', (error) => {
  console.error('Unexpected Postgres pool error:', error);
});

// Used by /health (wired in 6C): can we reach the database, and how fast?
export async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number }> {
  const started = performance.now();
  try {
    await pool.query('SELECT 1');
    return { ok: true, latencyMs: Math.round(performance.now() - started) };
  } catch {
    return { ok: false, latencyMs: Math.round(performance.now() - started) };
  }
}

// Called on graceful shutdown so the process can exit cleanly.
export async function closePool(): Promise<void> {
  await pool.end();
}
