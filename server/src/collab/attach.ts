import type { Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer } from 'ws';
import type { Role } from '../access/roles.js';
import { verifyToken } from '../auth/tokens.js';
import { env } from '../config/env.js';
import { getDocumentWithRole } from '../db/documents.js';
import { CLOSE_FORBIDDEN, CLOSE_NOT_FOUND, CLOSE_UNAUTHORIZED } from './closeCodes.js';
import { setupConnection } from './connection.js';
import { getDoc, releaseIfIdle } from './registry.js';

const COLLAB_PATH_PREFIX = '/yjs/';
const DOC_NAME_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function rejectUpgrade(socket: Duplex, status: number, reason: string): void {
  socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

type Access = { allowed: true; role: Role } | { allowed: false; closeCode: number; reason: string };

// Who is this, and what may they do with this document? Same rules as the REST API.
async function checkAccess(docName: string, token: string | null): Promise<Access> {
  const auth = token ? await verifyToken(token) : null;
  if (!auth) {
    return { allowed: false, closeCode: CLOSE_UNAUTHORIZED, reason: 'Sign in required' };
  }

  const found = await getDocumentWithRole(docName, auth.userId);
  if (!found) {
    return { allowed: false, closeCode: CLOSE_NOT_FOUND, reason: 'Document not found' };
  }
  if (!found.role) {
    return { allowed: false, closeCode: CLOSE_FORBIDDEN, reason: 'No access to this document' };
  }
  return { allowed: true, role: found.role };
}

export function attachCollabServer(server: Server): WebSocketServer {
  // noServer: we don't let this open its own port; we hand it upgrade requests ourselves.
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const { pathname } = url;

    if (!pathname.startsWith(COLLAB_PATH_PREFIX)) {
      rejectUpgrade(socket, 404, 'Not Found');
      return;
    }

    // WebSockets are NOT covered by CORS, so we check the Origin header ourselves.
    // Browsers always send it; command-line tools may not, so a missing Origin is allowed.
    const origin = request.headers.origin;
    if (origin && origin !== env.CLIENT_ORIGIN) {
      rejectUpgrade(socket, 403, 'Forbidden');
      return;
    }

    const docName = decodeURIComponent(pathname.slice(COLLAB_PATH_PREFIX.length));
    if (!DOC_NAME_PATTERN.test(docName)) {
      rejectUpgrade(socket, 400, 'Bad Request');
      return;
    }

    // The login token travels in the URL (browsers cannot set headers on a WebSocket).
    // Never log request URLs: they contain the token.
    const token = url.searchParams.get('token');

    // We now wait for the database, so a network error could arrive before the WebSocket
    // library takes over the socket. Without a listener, Node would crash on that error.
    socket.on('error', () => socket.destroy());

    checkAccess(docName, token)
      .then(async (access) => {
        if (socket.destroyed) {
          return; // the browser gave up while we were checking
        }

        if (!access.allowed) {
          // Finish the handshake, then close with a code the browser can read.
          wss.handleUpgrade(request, socket, head, (ws) => {
            ws.close(access.closeCode, access.reason);
          });
          return;
        }

        // Only now, for someone allowed in, is the document loaded into memory.
        const doc = await getDoc(docName);
        if (socket.destroyed) {
          releaseIfIdle(doc);
          return;
        }
        wss.handleUpgrade(request, socket, head, (ws) => {
          setupConnection(ws, doc, access.role);
        });
      })
      .catch((error: unknown) => {
        console.error(`Could not open document "${docName}":`, error);
        if (!socket.destroyed) {
          rejectUpgrade(socket, 503, 'Service Unavailable');
        }
      });
  });

  return wss;
}
