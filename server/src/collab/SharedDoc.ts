import * as encoding from 'lib0/encoding';
import type { WebSocket } from 'ws';
import * as awarenessProtocol from 'y-protocols/awareness.js';
import * as syncProtocol from 'y-protocols/sync.js';
import * as Y from 'yjs';
import { MESSAGE_AWARENESS, MESSAGE_SYNC, send } from './protocol.js';

type AwarenessChanges = { added: number[]; updated: number[]; removed: number[] };

// A Y.Doc that also knows which browsers are connected to it.
export class SharedDoc extends Y.Doc {
  readonly name: string;
  // connection -> the awareness ids (cursors) that connection controls
  readonly conns = new Map<WebSocket, Set<number>>();
  readonly awareness: awarenessProtocol.Awareness;

  constructor(name: string) {
    super({ gc: true });
    this.name = name;
    this.awareness = new awarenessProtocol.Awareness(this);
    // The server itself has no cursor.
    this.awareness.setLocalState(null);
    this.awareness.on('update', this.onAwarenessUpdate);
    this.on('update', this.onDocUpdate);
  }

  // Whenever the document changes, tell every connected browser.
  private readonly onDocUpdate = (update: Uint8Array): void => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);
    this.conns.forEach((_ids, conn) => send(this, conn, message));
  };

  // Whenever presence changes, tell every connected browser.
  private readonly onAwarenessUpdate = (
    { added, updated, removed }: AwarenessChanges,
    origin: unknown,
  ): void => {
    const changedClients = added.concat(updated, removed);

    // Remember which ids belong to which connection, so we can clean up on disconnect.
    const controlledIds = origin ? this.conns.get(origin as WebSocket) : undefined;
    if (controlledIds) {
      added.forEach((id) => controlledIds.add(id));
      removed.forEach((id) => controlledIds.delete(id));
    }

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients),
    );
    const message = encoding.toUint8Array(encoder);
    this.conns.forEach((_ids, conn) => send(this, conn, message));
  };

  override destroy(): void {
    this.awareness.destroy();
    super.destroy();
  }
}
