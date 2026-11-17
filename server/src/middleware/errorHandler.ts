import type { ErrorRequestHandler, RequestHandler } from 'express';
import { env } from '../config/env.js';

// Runs when no route matched the request.
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.originalUrl });
};

// Express recognises an error handler by its FOUR parameters (err, req, res, next).
// Even if `_next` is unused, it must be declared.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);

  const status =
    typeof err?.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;

  res.status(status).json({
    error: status === 500 ? 'Internal Server Error' : (err.message ?? 'Error'),
    // Never leak stack traces in production.
    ...(env.NODE_ENV !== 'production' && { stack: err?.stack }),
  });
};
