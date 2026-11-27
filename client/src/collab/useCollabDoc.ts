import { useEffect, useState } from 'react';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import type { CollabUser } from './identity';

export type SyncState = 'connecting' | 'syncing' | 'synced' | 'offline';
// Why the server refused to let us in (see server/src/collab/closeCodes.ts).
export type Refusal = 'unauthorized' | 'forbidden' | 'not-found';
type Connection = 'connecting' | 'connected' | 'disconnected';
type Session = { ydoc: Y.Doc; provider: WebsocketProvider };

// In production this comes from an environment variable (Phase 13).
const COLLAB_URL: string = import.meta.env.VITE_COLLAB_URL ?? 'ws://localhost:4000/yjs';

// The server accepts the connection and then closes it with one of these codes.
const REFUSALS: Record<number, Refusal> = {
  4401: 'unauthorized',
  4403: 'forbidden',
  4404: 'not-found',
};

function toSyncState(connection: Connection, synced: boolean): SyncState {
  if (connection === 'disconnected') return 'offline';
  if (connection === 'connecting') return 'connecting';
  return synced ? 'synced' : 'syncing';
}

export function useCollabDoc(docId: string, user: CollabUser, token: string) {
  const [session, setSession] = useState<Session | null>(null);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [synced, setSynced] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);

  useEffect(() => {
    const doc = new Y.Doc();
    // The room name is appended to the URL: ws://localhost:4000/yjs/<docId>?token=...
    // (Browsers cannot set headers on a WebSocket, so the token travels as a URL parameter.)
    const provider = new WebsocketProvider(COLLAB_URL, docId, doc, { params: { token } });

    // Announce who we are as soon as we connect, so the presence list is right
    // even before the editor exists.
    provider.awareness.setLocalStateField('user', user);

    const handleStatus = ({ status }: { status: Connection }) => setConnection(status);
    const handleSync = (isSynced: boolean) => setSynced(isSynced);

    // If the server closes us with one of its refusal codes, say why and STOP retrying.
    const handleClose = (event: CloseEvent | null) => {
      const refused = event ? REFUSALS[event.code] : undefined;
      if (refused) {
        provider.disconnect();
        setRefusal(refused);
      }
    };

    provider.on('status', handleStatus);
    provider.on('sync', handleSync);
    provider.on('connection-close', handleClose);
    setSession({ ydoc: doc, provider });

    // Cleanup: runs when the page closes or docId changes.
    return () => {
      provider.off('status', handleStatus);
      provider.off('sync', handleSync);
      provider.off('connection-close', handleClose);
      provider.destroy();
      doc.destroy();
      setSession(null);
      setConnection('connecting');
      setSynced(false);
      setRefusal(null);
    };
  }, [docId, user, token]);

  return {
    ydoc: session?.ydoc ?? null,
    provider: session?.provider ?? null,
    state: toSyncState(connection, synced),
    refusal,
  };
}
