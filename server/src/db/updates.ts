import { pool } from './pool.js';

// Every saved update for one document, oldest first.
export async function loadUpdates(docId: string): Promise<Uint8Array[]> {
  const { rows } = await pool.query<{ update_data: Buffer }>(
    'SELECT update_data FROM document_updates WHERE doc_id = $1 ORDER BY id',
    [docId],
  );
  // new Uint8Array(...) copies the bytes into a plain array of bytes, which is what Yjs expects.
  return rows.map((row) => new Uint8Array(row.update_data));
}

// Save one update (we merge many small ones into one before calling this).
export async function appendUpdate(docId: string, update: Uint8Array): Promise<void> {
  await pool.query('INSERT INTO document_updates (doc_id, update_data) VALUES ($1, $2)', [
    docId,
    Buffer.from(update),
  ]);
}

// How many rows does this document currently occupy?
export async function countUpdates(docId: string): Promise<number> {
  const { rows } = await pool.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM document_updates WHERE doc_id = $1',
    [docId],
  );
  return rows[0]?.count ?? 0;
}

// The id of the newest row for this document, or null if there are none.
// BIGINT can be larger than JavaScript numbers can hold exactly, so pg gives it to us
// as a string. We only ever hand it straight back to Postgres, so that is fine.
export async function getLatestUpdateId(docId: string): Promise<string | null> {
  const { rows } = await pool.query<{ max_id: string | null }>(
    'SELECT max(id) AS max_id FROM document_updates WHERE doc_id = $1',
    [docId],
  );
  return rows[0]?.max_id ?? null;
}

// Replace every row up to and including cutoffId with ONE row holding the full state.
// It is a single transaction, so a crash halfway keeps the old rows: nothing is lost.
export async function compactUpdates(
  docId: string,
  cutoffId: string,
  snapshot: Uint8Array,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM document_updates WHERE doc_id = $1 AND id <= $2', [
      docId,
      cutoffId,
    ]);
    await client.query('INSERT INTO document_updates (doc_id, update_data) VALUES ($1, $2)', [
      docId,
      Buffer.from(snapshot),
    ]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Remove everything saved for one document (used by the test script to clean up).
export async function deleteUpdates(docId: string): Promise<void> {
  await pool.query('DELETE FROM document_updates WHERE doc_id = $1', [docId]);
}
