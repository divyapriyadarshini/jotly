import { DocPersistence } from './persistence.js';
import { SharedDoc } from './SharedDoc.js';

// How long an empty document stays in memory before it is saved and removed.
// A short grace period means a page refresh does not cost a database round trip.
const IDLE_EVICTION_MS = 30_000;

type Entry = { doc: SharedDoc; persistence: DocPersistence };

// name -> a document that is loading, or already loaded (we store the promise so that two
// people opening the same new document share ONE load).
const entries = new Map<string, Promise<Entry>>();
// name -> documents that have finished loading (used for stats and shutdown).
const ready = new Map<string, Entry>();
// name -> a final save that is in progress. New connections wait for it to finish.
const closings = new Map<string, Promise<void>>();
// name -> the countdown to evict an empty document.
const idleTimers = new Map<string, ReturnType<typeof setTimeout>>();

function cancelEviction(name: string): void {
  const timer = idleTimers.get(name);
  if (timer) {
    clearTimeout(timer);
    idleTimers.delete(name);
  }
}

function scheduleEviction(name: string): void {
  cancelEviction(name);
  const timer = setTimeout(() => {
    idleTimers.delete(name);
    evict(name).catch((error: unknown) => {
      console.error(`Eviction of document "${name}" failed:`, error);
    });
  }, IDLE_EVICTION_MS);
  idleTimers.set(name, timer);
}

// Create the in-memory document and fill it from the database.
async function loadEntry(name: string): Promise<Entry> {
  const doc = new SharedDoc(name);
  const persistence = new DocPersistence(name, doc);
  try {
    await persistence.load();
  } catch (error) {
    doc.destroy();
    entries.delete(name); // forget the failed attempt so the next visitor can retry
    throw error;
  }
  doc.onEmpty = () => scheduleEviction(name);
  const entry = { doc, persistence };
  ready.set(name, entry);
  console.log(`Loaded document "${name}"`);
  return entry;
}

// Save an empty document one last time, then remove it from memory.
async function evict(name: string): Promise<void> {
  const entry = ready.get(name);
  if (!entry || entry.doc.conns.size > 0) {
    return; // someone came back, or it is already gone
  }

  // From this moment, getDoc() waits for the final save instead of loading old data.
  entries.delete(name);
  ready.delete(name);

  const closing = (async () => {
    try {
      await entry.persistence.close();
      entry.doc.destroy();
      console.log(`Evicted document "${name}"`);
    } catch (error) {
      // Could not save (database down?). Keep the document in memory and try again later,
      // because throwing it away now would lose edits.
      console.error(`Could not save document "${name}", keeping it in memory:`, error);
      entries.set(name, Promise.resolve(entry));
      ready.set(name, entry);
      scheduleEviction(name);
    }
  })();

  closings.set(name, closing);
  await closing;
  if (closings.get(name) === closing) {
    closings.delete(name);
  }
}

// Return the document for this room name, loading it from Postgres the first time.
export async function getDoc(name: string): Promise<SharedDoc> {
  cancelEviction(name); // someone wants it, so do not evict it

  const closing = closings.get(name);
  if (closing) {
    await closing; // wait until the previous save has finished
  }

  let entry = entries.get(name);
  if (!entry) {
    entry = loadEntry(name);
    entries.set(name, entry);
  }
  return (await entry).doc;
}

// If a document was loaded for someone who then disappeared, start its countdown anyway.
export function releaseIfIdle(doc: SharedDoc): void {
  if (doc.conns.size === 0) {
    scheduleEviction(doc.name);
  }
}

// Save every open document. Called once, when the server is shutting down.
export async function shutdownDocs(): Promise<void> {
  idleTimers.forEach((timer) => clearTimeout(timer));
  idleTimers.clear();

  // Let loads and evictions that are already in progress finish first.
  await Promise.allSettled([...entries.values(), ...closings.values()]);

  await Promise.all(
    [...ready.entries()].map(async ([name, entry]) => {
      try {
        await entry.persistence.close();
      } catch (error) {
        console.error(`Could not save document "${name}" during shutdown:`, error);
      }
    }),
  );
}

export function getCollabStats(): { documents: number; connections: number } {
  let connections = 0;
  ready.forEach((entry) => {
    connections += entry.doc.conns.size;
  });
  return { documents: ready.size, connections };
}
