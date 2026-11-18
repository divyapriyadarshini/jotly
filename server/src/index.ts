import { createServer } from 'node:http';
import { createApp } from './app.js';
import { attachCollabServer } from './collab/attach.js';
import { env } from './config/env.js';

const app = createApp();

// One HTTP server handles both normal requests (Express) and WebSocket upgrades (collab).
const server = createServer(app);
const collab = attachCollabServer(server);

server.listen(env.PORT, () => {
  console.log(`Jotly server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// Graceful shutdown: when the process is told to stop (Ctrl+C, or a deploy replacing
// this version), close WebSockets, stop accepting new connections and exit cleanly.
function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down...`);
  // server.close() waits for open connections, and WebSockets stay open until closed.
  collab.clients.forEach((client) => client.close(1001, 'Server shutting down'));
  server.close(() => process.exit(0));
  // Safety net: force exit if connections hang for too long.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
