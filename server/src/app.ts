import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';

export function createApp() {
  const app = express();

  // CORS: allow the browser app (Vite dev server) to call this API.
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));

  // Parse JSON request bodies into req.body.
  app.use(express.json());

  // Routes
  app.use('/health', healthRouter);

  // Must come AFTER all routes.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
