import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

// We create the HTTP server ourselves (instead of app.listen) because in Phase 4
// the Yjs WebSocket server must attach to this SAME server and port.
const server = createServer(app);

server.listen(env.PORT, () => {
  console.log(`Jotly server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// Graceful shutdown: when the process is told to stop (Ctrl+C, or a deploy replacing
// this version), stop accepting new connections and exit cleanly.
function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down...`);
  server.close(() => process.exit(0));
  // Safety net: force exit if connections hang for too long.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
