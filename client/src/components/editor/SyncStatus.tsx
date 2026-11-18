import type { SyncState } from '../../collab/useCollabDoc';
import { Stamp } from '../ui/Stamp';

const LABELS: Record<SyncState, string> = {
  connecting: 'Connecting',
  syncing: 'Syncing',
  synced: 'Synced',
  offline: 'Offline',
};

type SyncStatusProps = { state: SyncState };

export function SyncStatus({ state }: SyncStatusProps) {
  return (
    // role="status" makes screen readers announce changes politely.
    <div role="status">
      <Stamp tone={state === 'synced' ? 'default' : 'alert'}>● {LABELS[state]}</Stamp>
    </div>
  );
}
