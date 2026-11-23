import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

// server/src/db -> server/src -> server -> server/migrations
// (the same relative path works for server/dist/db when compiled).
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(currentDir, '../../migrations');

// Applies every .sql file in server/migrations that hasn't run yet, in filename order.
// Returns the names of the files it applied this time.
export async function runMigrations(): Promise<string[]> {
  // The bookkeeping table: which migrations have already been applied?
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
  const { rows } = await pool.query<{ name: string }>('SELECT name FROM schema_migrations');
  const alreadyApplied = new Set(rows.map((row) => row.name));

  const appliedNow: string[] = [];

  for (const file of files) {
    if (alreadyApplied.has(file)) {
      continue;
    }

    const sql = await readFile(path.join(migrationsDir, file), 'utf8');

    // A transaction = all-or-nothing. If the SQL fails halfway, ROLLBACK undoes it,
    // so we never end up with a half-built table.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      appliedNow.push(file);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release(); // always hand the connection back to the pool
    }
  }

  return appliedNow;
}
