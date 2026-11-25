import { randomBytes } from 'node:crypto';
import * as Y from 'yjs';
import { DocPersistence } from '../collab/persistence.js';
import { closePool } from './pool.js';
import { countUpdates, deleteUpdates, loadUpdates } from './updates.js';

let failures = 0;

function check(label: string, ok: boolean): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) {
    failures += 1;
  }
}

// Rebuild a document from nothing but its saved rows and return its text.
async function rebuildText(docId: string): Promise<string> {
  const doc = new Y.Doc();
  for (const update of await loadUpdates(docId)) {
    Y.applyUpdate(doc, update);
  }
  return doc.getText('content').toString();
}

async function main(): Promise<void> {
  const docId = `check-${randomBytes(4).toString('hex')}`;
  console.log(`Testing with temporary document "${docId}"\n`);

  try {
    // 1. A brand-new document has nothing saved.
    const docA = new Y.Doc();
    const persistenceA = new DocPersistence(docId, docA);
    await persistenceA.load();
    check('a new document starts with no saved rows', (await countUpdates(docId)) === 0);

    // 2. Ten quick edits are batched into a single row.
    for (let i = 0; i < 10; i += 1) {
      docA.getText('content').insert(0, 'x');
    }
    await persistenceA.flush();
    check('10 quick edits are batched into 1 row', (await countUpdates(docId)) === 1);

    // 3. Five edits that are each saved separately make five more rows.
    for (let i = 0; i < 5; i += 1) {
      docA.getText('content').insert(0, `edit${i} `);
      await persistenceA.flush();
    }
    check('5 separately saved edits bring the total to 6 rows', (await countUpdates(docId)) === 6);

    // 4. Replaying the rows reproduces the document exactly.
    const expected = docA.getText('content').toString();
    check('rebuilding from the rows gives the same text', (await rebuildText(docId)) === expected);

    // 5. Compaction squashes everything into one row without changing the text.
    await persistenceA.compact();
    check('compaction leaves exactly 1 row', (await countUpdates(docId)) === 1);
    check('the text is unchanged after compaction', (await rebuildText(docId)) === expected);

    // 6. A new in-memory document can load the saved state.
    const docB = new Y.Doc();
    const persistenceB = new DocPersistence(docId, docB);
    await persistenceB.load();
    check(
      'load() restores the saved text into a new document',
      docB.getText('content').toString() === expected,
    );

    // 7. close() saves the last edit and compacts.
    docB.getText('content').insert(0, 'LAST ');
    await persistenceB.close();
    check('close() leaves exactly 1 row', (await countUpdates(docId)) === 1);
    check('the last edit survived close()', (await rebuildText(docId)) === `LAST ${expected}`);
  } finally {
    await deleteUpdates(docId);
    await closePool();
  }

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error('Persistence check crashed:', error);
  process.exitCode = 1;
});
