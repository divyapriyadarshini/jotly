import { randomInt } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../auth/password.js';
import { signToken } from '../auth/tokens.js';
import {
  createGuest,
  createUser,
  EmailTakenError,
  findUserByEmail,
  findUserById,
  toPublicUser,
  upgradeGuest,
} from '../db/users.js';
import { getAuth, optionalAuth, requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

const emailSchema = z.string().trim().toLowerCase().email().max(254);

const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Use at least 8 characters').max(128),
  displayName: z.string().trim().min(1, 'Enter a name').max(40),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

// POST /auth/guest: start an anonymous session. Called when someone first opens Jotly.
authRouter.post('/guest', async (_req, res) => {
  const user = await createGuest(`Guest ${randomInt(1000, 10000)}`);
  const token = await signToken({ userId: user.id, isGuest: true });
  res.status(201).json({ token, user: toPublicUser(user) });
});

// POST /auth/register: create an account. If the caller is a signed-in guest, that guest
// is upgraded in place so their documents come along.
authRouter.post('/register', optionalAuth, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'invalid_input',
        message: 'Please check the highlighted fields.',
        fields: z.flattenError(parsed.error).fieldErrors,
      },
    });
    return;
  }
  const { email, password, displayName } = parsed.data;
  const passwordHash = await hashPassword(password);
  const auth = getAuth(res);

  try {
    let user = auth?.isGuest
      ? await upgradeGuest(auth.userId, { email, passwordHash, displayName })
      : null;
    user ??= await createUser({ email, passwordHash, displayName });

    const token = await signToken({ userId: user.id, isGuest: false });
    res.status(201).json({ token, user: toPublicUser(user) });
  } catch (error) {
    if (error instanceof EmailTakenError) {
      res.status(409).json({
        error: { code: 'email_taken', message: 'That email is already registered.' },
      });
      return;
    }
    throw error;
  }
});

// POST /auth/login
authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'invalid_input', message: 'Enter your email and password.' },
    });
    return;
  }
  const { email, password } = parsed.data;

  const user = await findUserByEmail(email);
  let passwordOk = false;
  if (user?.passwordHash) {
    passwordOk = await verifyPassword(password, user.passwordHash);
  } else {
    // Unknown email: do the same slow work anyway, so timing doesn't give it away.
    await verifyAgainstDummy(password);
  }

  if (!user || !passwordOk) {
    // Same message for "no such email" and "wrong password", on purpose.
    res.status(401).json({
      error: { code: 'invalid_credentials', message: 'Incorrect email or password.' },
    });
    return;
  }

  const token = await signToken({ userId: user.id, isGuest: false });
  res.json({ token, user: toPublicUser(user) });
});

// GET /auth/me: who am I? (The browser uses this on load to check its saved token.)
authRouter.get('/me', requireAuth, async (_req, res) => {
  const auth = getAuth(res);
  const user = auth ? await findUserById(auth.userId) : null;
  if (!user) {
    // The token was valid but the user no longer exists.
    res.status(401).json({
      error: { code: 'unauthorized', message: 'You need to sign in to do that.' },
    });
    return;
  }
  res.json({ user: toPublicUser(user) });
});
