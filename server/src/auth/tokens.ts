import { jwtVerify, SignJWT } from 'jose';
import { env } from '../config/env.js';

// jose wants the secret as raw bytes, not a string.
const secret = new TextEncoder().encode(env.JWT_SECRET);
const ISSUER = 'jotly';
const TOKEN_LIFETIME = '7d';

export type TokenPayload = { userId: string; isGuest: boolean };

// Make a signed token ("wristband") for this user.
export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ guest: payload.isGuest })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(TOKEN_LIFETIME)
    .sign(secret);
}

// Check a token. Returns who it belongs to, or null if it is forged, expired or garbage.
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      // Only accept the algorithm we use. Never trust the token to pick its own.
      algorithms: ['HS256'],
    });
    if (typeof payload.sub !== 'string') {
      return null;
    }
    return { userId: payload.sub, isGuest: payload.guest === true };
  } catch {
    return null;
  }
}
