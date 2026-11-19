import { useEffect, useState } from 'react';
import type { WebsocketProvider } from 'y-websocket';
import { type CollabUser, sanitizeUser } from './identity';

export type Person = CollabUser & { clientId: number; isSelf: boolean };

function readPeople(provider: WebsocketProvider): Person[] {
  const { awareness } = provider;
  const people: Person[] = [];

  // getStates() maps each connected browser's numeric id to its state object.
  awareness.getStates().forEach((state, clientId) => {
    const user = sanitizeUser(state.user);
    if (user) {
      people.push({ ...user, clientId, isSelf: clientId === awareness.clientID });
    }
  });

  // You first, then everyone else in a stable order.
  return people.sort((a, b) => Number(b.isSelf) - Number(a.isSelf) || a.clientId - b.clientId);
}

export function usePresence(provider: WebsocketProvider | null): Person[] {
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    if (!provider) {
      setPeople([]);
      return;
    }

    const refresh = () => setPeople(readPeople(provider));
    refresh();
    provider.awareness.on('change', refresh);

    return () => {
      provider.awareness.off('change', refresh);
    };
  }, [provider]);

  return people;
}
