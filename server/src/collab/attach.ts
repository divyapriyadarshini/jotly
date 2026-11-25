import type { Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer } from 'ws';
import { env } from '../config/env.js';
import { setupConnection } from './connection.js';
import { getDoc, releaseIfIdle } from './registry.js';

const COLLAB_PATH_PREFIX = '/yjs/';
const DOC_NAME_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function rejectUpgrade(socket: Duplex, status: number, reason: string): void {
  socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

export function attachCollabServer(server: Server): WebSocketServer {
  // noServer: we don't let this open its own port; we hand it upgrade requests ourselves.
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url ?? '/', 'http://localhost');

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

    // Phase 7: check the user's login and document permissions here, before upgrading.

    // We now wait for the database, so a network error could arrive before the WebSocket
    // library takes over the socket. Without a listener, Node would crash on that error.
    socket.on('error', () => socket.destroy());

    getDoc(docName)
      .then((doc) => {
        if (socket.destroyed) {
          // The browser gave up while we were loading. Start the idle countdown.
          releaseIfIdle(doc);
          return;
        }
        wss.handleUpgrade(request, socket, head, (ws) => {
          setupConnection(ws, doc);
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
