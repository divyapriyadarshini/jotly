import type { NextFunction, Request, Response } from 'express';
import { type TokenPayload, verifyToken } from '../auth/tokens.js';

// Browsers send the token as:  Authorization: Bearer <token>
function readBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

// Handlers read who is calling with this. (Express's res.locals is a scratch space that
// lives for one request.)
export function getAuth(res: Response): TokenPayload | null {
  return (res.locals.auth as TokenPayload | undefined) ?? null;
}

// Use when being logged in is optional: sets the caller if the token is valid, else carries on.
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = readBearerToken(req);
  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      res.locals.auth = payload;
    }
  }
  next();
}

// Use when being logged in is required: answers 401 (Unauthorized) otherwise.
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = readBearerToken(req);
  const payload = token ? await verifyToken(token) : null;
  if (!payload) {
    res.status(401).json({
      error: { code: 'unauthorized', message: 'You need to sign in to do that.' },
    });
    return;
  }
  res.locals.auth = payload;
  next();
}
