import { pool } from './pool.js';

export type UserRow = {
  id: string;
  email: string | null;
  passwordHash: string | null;
  displayName: string;
  isGuest: boolean;
};

// What we are willing to send to a browser (never the password hash).
export type PublicUser = {
  id: string;
  email: string | null;
  displayName: string;
  isGuest: boolean;
};

// Thrown when someone registers with an email that already has an account.
export class EmailTakenError extends Error {
  constructor() {
    super('That email is already registered');
    this.name = 'EmailTakenError';
  }
}

// Postgres error code 23505 = "unique constraint violated".
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

// Renames snake_case database columns to camelCase fields.
const COLUMNS = `id, email, password_hash AS "passwordHash", display_name AS "displayName", is_guest AS "isGuest"`;

export function toPublicUser(user: UserRow): PublicUser {
  return { id: user.id, email: user.email, displayName: user.displayName, isGuest: user.isGuest };
}

export async function createGuest(displayName: string): Promise<UserRow> {
  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (display_name, is_guest) VALUES ($1, true) RETURNING ${COLUMNS}`,
    [displayName],
  );
  return rows[0] as UserRow;
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  displayName: string;
}): Promise<UserRow> {
  try {
    const { rows } = await pool.query<UserRow>(
      `INSERT INTO users (email, password_hash, display_name, is_guest)
       VALUES ($1, $2, $3, false) RETURNING ${COLUMNS}`,
      [input.email, input.passwordHash, input.displayName],
    );
    return rows[0] as UserRow;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new EmailTakenError();
    }
    throw error;
  }
}

// Turn an existing guest into a registered user, keeping the same id (so their documents
// stay theirs). Returns null if that guest does not exist or is not a guest any more.
export async function upgradeGuest(
  userId: string,
  input: { email: string; passwordHash: string; displayName: string },
): Promise<UserRow | null> {
  try {
    const { rows } = await pool.query<UserRow>(
      `UPDATE users
       SET email = $2, password_hash = $3, display_name = $4, is_guest = false
       WHERE id = $1 AND is_guest = true
       RETURNING ${COLUMNS}`,
      [userId, input.email, input.passwordHash, input.displayName],
    );
    return rows[0] ?? null;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new EmailTakenError();
    }
    throw error;
  }
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(`SELECT ${COLUMNS} FROM users WHERE email = $1`, [
    email,
  ]);
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] ?? null;
}
