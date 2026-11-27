import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import type { RawData, WebSocket } from 'ws';
import * as awarenessProtocol from 'y-protocols/awareness.js';
import * as syncProtocol from 'y-protocols/sync.js';
import { canWrite, type Role } from '../access/roles.js';
import { closeConnection, MESSAGE_AWARENESS, MESSAGE_SYNC, send } from './protocol.js';
import type { SharedDoc } from './SharedDoc.js';

const PING_INTERVAL_MS = 30_000;

function toUint8Array(data: RawData): Uint8Array {
  if (Array.isArray(data)) {
    return new Uint8Array(Buffer.concat(data));
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  return new Uint8Array(data);
}

function handleMessage(
  conn: WebSocket,
  doc: SharedDoc,
  message: Uint8Array,
  writable: boolean,
): void {
  try {
    const encoder = encoding.createEncoder();
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case MESSAGE_SYNC: {
        if (!writable) {
          // Sync messages come in three kinds: step 1 ("what do you have?") is a read;
          // step 2 and update both CARRY CHANGES. A read-only viewer may only send step 1.
          // We peek with a second decoder so the real one is not disturbed.
          const peek = decoding.createDecoder(message);
          decoding.readVarUint(peek); // skip the outer message type
          if (decoding.readVarUint(peek) !== syncProtocol.messageYjsSyncStep1) {
            return; // dropped, silently: even a hacked client cannot change the document
          }
        }

        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        // Applies incoming updates to the doc, and writes a reply if one is needed.
        syncProtocol.readSyncMessage(decoder, encoder, doc, conn);
        // A length of 1 means the encoder holds only the type byte: nothing to reply.
        if (encoding.length(encoder) > 1) {
          send(doc, conn, encoding.toUint8Array(encoder));
        }
        break;
      }
      case MESSAGE_AWARENESS: {
        // Presence (names, carets) is allowed for everyone, viewers included.
        awarenessProtocol.applyAwarenessUpdate(
          doc.awareness,
          decoding.readVarUint8Array(decoder),
          conn,
        );
        break;
      }
    }
  } catch (error) {
    console.error('Failed to handle collab message:', error);
  }
}

export function setupConnection(conn: WebSocket, doc: SharedDoc, role: Role): void {
  // Decided once, when the connection opens. (If the owner later removes this person's
  // access, they stay connected until they leave: a known limitation.)
  const writable = canWrite(role);

  doc.conns.set(conn, new Set());

  conn.on('message', (data: RawData) => handleMessage(conn, doc, toUint8Array(data), writable));

  // Heartbeat: ping regularly; if no pong came back since the last ping, drop the connection.
  let pongReceived = true;
  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      closeConnection(doc, conn);
      clearInterval(pingInterval);
      return;
    }
    pongReceived = false;
    try {
      conn.ping();
    } catch {
      closeConnection(doc, conn);
      clearInterval(pingInterval);
    }
  }, PING_INTERVAL_MS);

  conn.on('pong', () => {
    pongReceived = true;
  });

  conn.on('close', () => {
    closeConnection(doc, conn);
    clearInterval(pingInterval);
  });

  // Start the handshake: send our "sync step 1" (what we know), so the browser
  // replies with whatever we're missing.
  const syncEncoder = encoding.createEncoder();
  encoding.writeVarUint(syncEncoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(syncEncoder, doc);
  send(doc, conn, encoding.toUint8Array(syncEncoder));

  // Tell the newcomer who else is currently present.
  const states = doc.awareness.getStates();
  if (states.size > 0) {
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      awarenessEncoder,
      awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(states.keys())),
    );
    send(doc, conn, encoding.toUint8Array(awarenessEncoder));
  }
}
