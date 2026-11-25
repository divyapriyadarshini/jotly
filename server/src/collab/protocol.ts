import type { WebSocket } from 'ws';
import * as awarenessProtocol from 'y-protocols/awareness.js';
import type { SharedDoc } from './SharedDoc.js';

// Every message starts with one number saying what kind of message it is.
// These two values are part of the y-websocket protocol, so the browser's
// provider and this server agree on them.
export const MESSAGE_SYNC = 0;
export const MESSAGE_AWARENESS = 1;

export function closeConnection(doc: SharedDoc, conn: WebSocket): void {
  const controlledIds = doc.conns.get(conn);
  if (controlledIds) {
    doc.conns.delete(conn);
    // Remove this browser's cursors/presence so ghosts don't linger.
    awarenessProtocol.removeAwarenessStates(doc.awareness, Array.from(controlledIds), null);
    // NEW in Phase 6C: if that was the last browser, tell the registry so it can
    // start the countdown to evict this document from memory.
    if (doc.conns.size === 0) {
      doc.onEmpty?.();
    }
  }
  conn.close();
}

export function send(doc: SharedDoc, conn: WebSocket, message: Uint8Array): void {
  if (conn.readyState !== conn.OPEN) {
    closeConnection(doc, conn);
    return;
  }
  conn.send(message, (error) => {
    if (error) {
      closeConnection(doc, conn);
    }
  });
}
