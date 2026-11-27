import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { type RawData, WebSocket } from 'ws';
import * as syncProtocol from 'y-protocols/sync.js';
import * as Y from 'yjs';
import { env } from '../config/env.js';
import { closePool, pool } from '../db/pool.js';
import { CLOSE_FORBIDDEN, CLOSE_NOT_FOUND, CLOSE_UNAUTHORIZED } from './closeCodes.js';
import { MESSAGE_SYNC } from './protocol.js';

const HTTP_BASE = `http://localhost:${env.PORT}`;
const WS_BASE = `ws://localhost:${env.PORT}/yjs`;

let failures = 0;

function check(label: string, ok: boolean): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) {
    failures += 1;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toBytes(data: RawData): Uint8Array {
  if (Array.isArray(data)) {
    return new Uint8Array(Buffer.concat(data));
  }
  return new Uint8Array(data);
}

// ---- helpers that talk to the REST API ----

type Session = { token: string; userId: string };

async function newGuest(): Promise<Session> {
  const response = await fetch(`${HTTP_BASE}/auth/guest`, { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Guest request failed (${response.status}). Is the server running?`);
  }
  const body = (await response.json()) as { token: string; user: { id: string } };
  return { token: body.token, userId: body.user.id };
}

function authHeaders(session: Session): Record<string, string> {
  return { authorization: `Bearer ${session.token}`, 'content-type': 'application/json' };
}

async function createDocument(owner: Session): Promise<string> {
  const response = await fetch(`${HTTP_BASE}/documents`, {
    method: 'POST',
    headers: authHeaders(owner),
    body: '{}',
  });
  if (!response.ok) {
    throw new Error(`Create document failed (${response.status})`);
  }
  const body = (await response.json()) as { document: { id: string } };
  return body.document.id;
}

async function setLinkAccess(owner: Session, docId: string, linkAccess: string): Promise<void> {
  const response = await fetch(`${HTTP_BASE}/documents/${docId}`, {
    method: 'PATCH',
    headers: authHeaders(owner),
    body: JSON.stringify({ linkAccess }),
  });
  if (!response.ok) {
    throw new Error(`Set link access failed (${response.status})`);
  }
}

// ---- a tiny stand-in for the browser's Yjs client ----

type Client = {
  ws: WebSocket;
  closed: Promise<number>;
  text: () => string;
  insert: (value: string) => void;
};

function connect(docId: string, token: string | null): Client {
  const query = token === null ? '' : `?token=${encodeURIComponent(token)}`;
  const ws = new WebSocket(`${WS_BASE}/${docId}${query}`);
  const doc = new Y.Doc();

  const closed = new Promise<number>((resolve) => {
    ws.on('close', (code: number) => resolve(code));
  });
  // The close handler above reports the outcome, so errors need no extra handling here.
  ws.on('error', () => undefined);

  // Like a real client, start the handshake by asking the server what it has.
  ws.on('open', () => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, doc);
    ws.send(encoding.toUint8Array(encoder));
  });

  // Apply what the server sends; answer its questions.
  ws.on('message', (data: RawData) => {
    const decoder = decoding.createDecoder(toBytes(data));
    if (decoding.readVarUint(decoder) !== MESSAGE_SYNC) {
      return; // presence messages: not needed here
    }
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.readSyncMessage(decoder, encoder, doc, 'server');
    if (encoding.length(encoder) > 1) {
      ws.send(encoding.toUint8Array(encoder));
    }
  });

  // Send our own edits to the server (but never echo back what the server told us).
  doc.on('update', (update: Uint8Array, origin: unknown) => {
    if (origin === 'server' || ws.readyState !== WebSocket.OPEN) {
      return;
    }
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    ws.send(encoding.toUint8Array(encoder));
  });

  return {
    ws,
    closed,
    text: () => doc.getText('content').toString(),
    insert: (value) => doc.getText('content').insert(0, value),
  };
}

async function expectCloseCode(label: string, client: Client, expected: number): Promise<void> {
  const code = await Promise.race([client.closed, sleep(3000).then(() => -1)]);
  check(`${label} -> close code ${expected}`, code === expected);
}

async function main(): Promise<void> {
  const createdUserIds: string[] = [];
  const clients: Client[] = [];
  const open = (docId: string, token: string | null): Client => {
    const client = connect(docId, token);
    clients.push(client);
    return client;
  };

  try {
    const alice = await newGuest();
    const bob = await newGuest();
    const carol = await newGuest();
    createdUserIds.push(alice.userId, bob.userId, carol.userId);
    const docId = await createDocument(alice);

    // Part 1: who is let in?
    await expectCloseCode('no token', open(docId, null), CLOSE_UNAUTHORIZED);
    await expectCloseCode('a forged token', open(docId, `${alice.token}x`), CLOSE_UNAUTHORIZED);
    await expectCloseCode(
      'an unknown document',
      open('doesnotexist1', alice.token),
      CLOSE_NOT_FOUND,
    );
    await expectCloseCode(
      'a stranger on a private document',
      open(docId, bob.token),
      CLOSE_FORBIDDEN,
    );

    const owner = open(docId, alice.token);
    await sleep(500);
    check('the owner stays connected', owner.ws.readyState === WebSocket.OPEN);
    owner.insert('hello');
    await sleep(500);

    // Part 2: read-only viewers.
    await setLinkAccess(alice, docId, 'view');
    const viewer = open(docId, bob.token);
    await sleep(500);
    check('a viewer receives the existing text', viewer.text() === 'hello');

    viewer.insert('HACK'); // this goes over the wire; the server must refuse it
    await sleep(500);
    check('a viewer edit does not reach the owner', owner.text() === 'hello');

    const reloaded = open(docId, alice.token);
    await sleep(500);
    check('a viewer edit was never applied on the server', reloaded.text() === 'hello');

    // Part 3: editors can write.
    await setLinkAccess(alice, docId, 'edit');
    const editor = open(docId, carol.token);
    await sleep(500);
    editor.insert('!');
    await sleep(500);
    check('an editor can change the document', owner.text().includes('!'));
  } finally {
    for (const client of clients) {
      client.ws.close();
    }
    // Deleting the users also deletes their documents and memberships (ON DELETE CASCADE).
    if (createdUserIds.length > 0) {
      await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [createdUserIds]);
    }
    await closePool();
  }

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error('WebSocket access check crashed:', error);
  process.exitCode = 1;
});
