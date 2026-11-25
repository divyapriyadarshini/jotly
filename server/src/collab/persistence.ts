import * as Y from 'yjs';
import { appendUpdate, compactUpdates, getLatestUpdateId, loadUpdates } from '../db/updates.js';

// How long to collect edits before writing them (milliseconds).
const FLUSH_DELAY_MS = 200;
// If a save fails (database briefly down), wait this long before trying again.
const FLUSH_RETRY_MS = 2_000;
// Compact once a document has this many rows, so loading never gets slow.
const COMPACT_THRESHOLD = 200;

// Connects ONE in-memory Y.Doc to its saved rows in Postgres.
export class DocPersistence {
  private readonly docId: string;
  private readonly doc: Y.Doc;
  // Updates made since the last save, waiting to be merged and written.
  private pending: Uint8Array[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  // Saves and compactions run one at a time, in order (a "checkout lane").
  private queue: Promise<void> = Promise.resolve();
  // How many rows this document currently occupies in the database.
  private storedRows = 0;

  constructor(docId: string, doc: Y.Doc) {
    this.docId = docId;
    this.doc = doc;
  }

  // Read the saved rows into the document. Call this once, BEFORE the document is
  // shared with any browser. We only start listening for changes afterwards, so the
  // loading itself is not written straight back to the database.
  async load(): Promise<void> {
    const updates = await loadUpdates(this.docId);
    this.doc.transact(() => {
      for (const update of updates) {
        Y.applyUpdate(this.doc, update);
      }
    });
    this.storedRows = updates.length;
    this.doc.on('update', this.onUpdate);
  }

  // Every time the document changes, remember the change and schedule a save.
  private readonly onUpdate = (update: Uint8Array): void => {
    this.pending.push(update);
    this.scheduleFlush(FLUSH_DELAY_MS);
  };

  private scheduleFlush(delayMs: number): void {
    if (this.flushTimer) {
      return; // a save is already scheduled; it will pick this update up too
    }
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush().catch((error: unknown) => {
        console.error(`Persistence error for document "${this.docId}", will retry:`, error);
        this.scheduleFlush(FLUSH_RETRY_MS);
      });
    }, delayMs);
  }

  // Write everything waiting in memory as ONE row. Safe to call at any time.
  flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    return this.enqueue(async () => {
      if (this.pending.length === 0) {
        return;
      }
      const batch = this.pending;
      this.pending = [];
      try {
        // Many small updates become one row.
        await appendUpdate(this.docId, Y.mergeUpdates(batch));
        this.storedRows += 1;
      } catch (error) {
        // Put the batch back in front of anything newer, so the next attempt retries it.
        this.pending = batch.concat(this.pending);
        throw error;
      }
      if (this.storedRows >= COMPACT_THRESHOLD) {
        await this.doCompact();
      }
    });
  }

  // Merge all of this document's rows into one (skipped if there is nothing to merge).
  compact(): Promise<void> {
    return this.enqueue(async () => {
      if (this.storedRows > 1) {
        await this.doCompact();
      }
    });
  }

  // Final save when the document is evicted from memory or the server shuts down.
  async close(): Promise<void> {
    await this.flush();
    await this.compact();
    this.doc.off('update', this.onUpdate);
  }

  // The actual compaction. It must only run inside the queue (never call it directly
  // from outside), so it can never overlap with a save.
  private async doCompact(): Promise<void> {
    // Order matters: note the newest row FIRST, then take the snapshot. Every row up to
    // that id came from updates this document already contains, so deleting them is safe.
    const cutoffId = await getLatestUpdateId(this.docId);
    if (cutoffId === null) {
      return;
    }
    const snapshot = Y.encodeStateAsUpdate(this.doc);
    await compactUpdates(this.docId, cutoffId, snapshot);
    this.storedRows = 1;
  }

  // Run a task after all earlier tasks have finished.
  private enqueue(task: () => Promise<void>): Promise<void> {
    const run = this.queue.then(task);
    // Keep the lane moving even if this task fails; the caller still sees the error.
    this.queue = run.catch(() => undefined);
    return run;
  }
}
