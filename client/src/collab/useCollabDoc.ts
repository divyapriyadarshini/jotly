import { useEffect, useState } from 'react';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

export type SyncState = 'connecting' | 'syncing' | 'synced' | 'offline';
type Connection = 'connecting' | 'connected' | 'disconnected';

// In production this comes from an environment variable (Phase 13).
const COLLAB_URL: string = import.meta.env.VITE_COLLAB_URL ?? 'ws://localhost:4000/yjs';

function toSyncState(connection: Connection, synced: boolean): SyncState {
  if (connection === 'disconnected') return 'offline';
  if (connection === 'connecting') return 'connecting';
  return synced ? 'synced' : 'syncing';
}

export function useCollabDoc(docId: string) {
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    const doc = new Y.Doc();
    // The room name is appended to the URL: ws://localhost:4000/yjs/<docId>
    const provider = new WebsocketProvider(COLLAB_URL, docId, doc);

    const handleStatus = ({ status }: { status: Connection }) => setConnection(status);
    const handleSync = (isSynced: boolean) => setSynced(isSynced);

    provider.on('status', handleStatus);
    provider.on('sync', handleSync);
    setYdoc(doc);

    // Cleanup: runs when the page closes or docId changes.
    return () => {
      provider.off('status', handleStatus);
      provider.off('sync', handleSync);
      provider.destroy();
      doc.destroy();
      setYdoc(null);
      setConnection('connecting');
      setSynced(false);
    };
  }, [docId]);

  return { ydoc, state: toSyncState(connection, synced) };
}
