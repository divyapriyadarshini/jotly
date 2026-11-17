import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  // Phase 6: add a database check here, e.g. run `SELECT 1` and report
  // `database: 'up' | 'down'`. If the database is down, respond with status 503.
  res.status(200).json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});
