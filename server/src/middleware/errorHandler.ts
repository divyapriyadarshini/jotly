import type { ErrorRequestHandler, RequestHandler } from 'express';
import { env } from '../config/env.js';
import { HttpError } from '../errors.js';

// Every error in the app now has the same shape:
//   { "error": { "code": "...", "message": "..." } }

// Runs when no route matched the request.
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: 'not_found', message: `No route for ${req.method} ${req.originalUrl}` },
  });
};

// Express recognises an error handler by its FOUR parameters (err, req, res, next).
// Even if `_next` is unused, it must be declared.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status =
    typeof err?.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;

  // Only real server faults are worth a stack trace in the log; a 403 is normal traffic.
  if (status >= 500) {
    console.error(err);
  }

  let code = 'bad_request';
  if (err instanceof HttpError) {
    code = err.code;
  } else if (status >= 500) {
    code = 'internal_error';
  }

  res.status(status).json({
    error: {
      code,
      message: status >= 500 ? 'Internal Server Error' : (err.message ?? 'Error'),
      // Never leak stack traces in production.
      ...(env.NODE_ENV !== 'production' && { stack: err?.stack }),
    },
  });
};
