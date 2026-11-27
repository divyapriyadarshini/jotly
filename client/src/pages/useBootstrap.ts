import { useEffect, useState } from 'react';
import { createDocument, type DocumentInfo, fetchDocument } from '../api/documents';
import { ApiError } from '../api/http';
import { getSession } from '../api/session';

const DOC_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

type Failed = { status: 'error'; heading: string; message: string };
type Ready = { status: 'ready'; token: string; document: DocumentInfo };
type Loaded = Ready | Failed;
export type Bootstrap = { status: 'loading' } | Loaded;

function describeError(error: unknown): Failed {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return {
        status: 'error',
        heading: "You don't have access to this document",
        message: 'Ask the owner to share it with you, or start a new document of your own.',
      };
    }
    if (error.status === 404) {
      return {
        status: 'error',
        heading: 'Document not found',
        message: 'This link may be wrong, or the document no longer exists.',
      };
    }
    if (error.status === 0) {
      return { status: 'error', heading: "Can't reach the server", message: error.message };
    }
    return { status: 'error', heading: 'Something went wrong', message: error.message };
  }
  return {
    status: 'error',
    heading: 'Something went wrong',
    message: 'An unexpected error happened. Try reloading the page.',
  };
}

// Sign in as a guest, then either open the document named in ?doc=... or create a new one.
async function load(): Promise<Loaded> {
  try {
    const session = await getSession();
    const requested = new URLSearchParams(window.location.search).get('doc');

    if (requested === null) {
      const document = await createDocument(session.token);
      // Put the new id in the address bar WITHOUT reloading, so the page can be shared.
      const url = new URL(window.location.href);
      url.searchParams.set('doc', document.id);
      window.history.replaceState(null, '', url);
      return { status: 'ready', token: session.token, document };
    }

    if (!DOC_ID_PATTERN.test(requested)) {
      return {
        status: 'error',
        heading: 'That link is not valid',
        message: 'Check the address, or start a new document.',
      };
    }

    const document = await fetchDocument(session.token, requested);
    return { status: 'ready', token: session.token, document };
  } catch (error) {
    return describeError(error);
  }
}

// Run once per page load, however many times React runs the effect (StrictMode runs it twice
// in development, which would otherwise create two documents).
let pending: Promise<Loaded> | null = null;

function loadOnce(): Promise<Loaded> {
  pending ??= load();
  return pending;
}

export function useBootstrap(): Bootstrap {
  const [state, setState] = useState<Bootstrap>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loadOnce().then((result) => {
      if (!cancelled) {
        setState(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
