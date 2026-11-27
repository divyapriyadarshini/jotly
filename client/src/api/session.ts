import { ApiError, apiFetch } from './http';

export type SessionUser = {
  id: string;
  email: string | null;
  displayName: string;
  isGuest: boolean;
};

export type Session = { token: string; user: SessionUser };

// sessionStorage = one value per browser TAB, gone when the tab closes. Phase 8 switches
// to localStorage when real login exists.
const STORAGE_KEY = 'jotly:token';

function readToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // storage blocked: we simply start a fresh guest each time
  }
}

function writeToken(token: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Not fatal: the session just will not survive a refresh.
  }
}

async function loadSession(): Promise<Session> {
  // 1. Do we already have a token? Ask the server whether it is still good.
  const stored = readToken();
  if (stored) {
    try {
      const { user } = await apiFetch<{ user: SessionUser }>('/auth/me', { token: stored });
      return { token: stored, user };
    } catch (error) {
      // 401 = expired or forged. Anything else (server down) is a real problem: pass it on.
      if (!(error instanceof ApiError) || error.status !== 401) {
        throw error;
      }
    }
  }

  // 2. No usable token: become a new guest.
  const created = await apiFetch<Session>('/auth/guest', { method: 'POST' });
  writeToken(created.token);
  return created;
}

// Remember the answer, so the whole page shares ONE session lookup (and React StrictMode's
// double effect cannot create two guests). A failure is forgotten so a retry can work.
let sessionPromise: Promise<Session> | null = null;

export function getSession(): Promise<Session> {
  sessionPromise ??= loadSession().catch((error: unknown) => {
    sessionPromise = null;
    throw error;
  });
  return sessionPromise;
}
