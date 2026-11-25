import { createServer } from 'node:http';
import { createApp } from './app.js';
import { attachCollabServer } from './collab/attach.js';
import { shutdownDocs } from './collab/registry.js';
import { env } from './config/env.js';
import { runMigrations } from './db/migrate.js';
import { closePool } from './db/pool.js';

async function main(): Promise<void> {
  // Create any missing database tables BEFORE accepting traffic.
  const applied = await runMigrations();
  if (applied.length > 0) {
    console.log(`Applied ${applied.length} database migration(s): ${applied.join(', ')}`);
  }

  const app = createApp();

  // One HTTP server handles both normal requests (Express) and WebSocket upgrades (collab).
  const server = createServer(app);
  const collab = attachCollabServer(server);

  server.listen(env.PORT, () => {
    console.log(`Jotly server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  // Graceful shutdown: when the process is told to stop (Ctrl+C, or a deploy replacing
  // this version), save every open document, then close everything and exit cleanly.
  let shuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) {
      return; // a second Ctrl+C while we are already saving
    }
    shuttingDown = true;
    console.log(`\n${signal} received, saving documents and shutting down...`);

    // Safety net: force exit if saving hangs for too long.
    setTimeout(() => process.exit(1), 10_000).unref();

    // Tell browsers to disconnect (they will reconnect to the next server), stop
    // accepting new connections, then save everything that is still in memory.
    collab.clients.forEach((client) => client.close(1001, 'Server shutting down'));
    server.close();

    try {
      await shutdownDocs();
      await closePool();
      console.log('All documents saved. Bye.');
      process.exit(0);
    } catch (error) {
      console.error('Shutdown error:', error);
      process.exit(1);
    }
  }

  process.on('SIGINT', () => {
    shutdown('SIGINT').catch(() => process.exit(1));
  });
  process.on('SIGTERM', () => {
    shutdown('SIGTERM').catch(() => process.exit(1));
  });
}

main().catch((error: unknown) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});
