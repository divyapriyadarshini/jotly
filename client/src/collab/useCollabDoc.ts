import { useEffect, useState } from 'react';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import type { CollabUser } from './identity';

export type SyncState = 'connecting' | 'syncing' | 'synced' | 'offline';
type Connection = 'connecting' | 'connected' | 'disconnected';
type Session = { ydoc: Y.Doc; provider: WebsocketProvider };

// In production this comes from an environment variable (Phase 13).
const COLLAB_URL: string = import.meta.env.VITE_COLLAB_URL ?? 'ws://localhost:4000/yjs';

function toSyncState(connection: Connection, synced: boolean): SyncState {
  if (connection === 'disconnected') return 'offline';
  if (connection === 'connecting') return 'connecting';
  return synced ? 'synced' : 'syncing';
}

export function useCollabDoc(docId: string, user: CollabUser) {
  const [session, setSession] = useState<Session | null>(null);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    const doc = new Y.Doc();
    // The room name is appended to the URL: ws://localhost:4000/yjs/<docId>
    const provider = new WebsocketProvider(COLLAB_URL, docId, doc);

    // Announce who we are as soon as we connect, so the presence list is right
    // even before the editor exists.
    provider.awareness.setLocalStateField('user', user);

    const handleStatus = ({ status }: { status: Connection }) => setConnection(status);
    const handleSync = (isSynced: boolean) => setSynced(isSynced);

    provider.on('status', handleStatus);
    provider.on('sync', handleSync);
    setSession({ ydoc: doc, provider });

    // Cleanup: runs when the page closes or docId changes.
    return () => {
      provider.off('status', handleStatus);
      provider.off('sync', handleSync);
      provider.destroy();
      doc.destroy();
      setSession(null);
      setConnection('connecting');
      setSynced(false);
    };
  }, [docId, user]);

  return {
    ydoc: session?.ydoc ?? null,
    provider: session?.provider ?? null,
    state: toSyncState(connection, synced),
  };
}
