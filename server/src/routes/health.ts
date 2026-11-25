import { Router } from 'express';
import { getCollabStats } from '../collab/registry.js';
import { checkDatabase } from '../db/pool.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const database = await checkDatabase();

  // If the database is unreachable the app cannot save anything, so report 503
  // (Service Unavailable). Deploy platforms use this to decide whether to restart us.
  res.status(database.ok ? 200 : 503).json({
    status: database.ok ? 'ok' : 'degraded',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    database: database.ok ? 'up' : 'down',
    databaseLatencyMs: database.latencyMs,
    collab: getCollabStats(),
  });
});
