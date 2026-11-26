import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// scrypt settings. Higher COST = slower for attackers (and for us: about 0.2 seconds).
const COST = 2 ** 16;
const BLOCK_SIZE = 8;
const PARALLELISM = 2;
const KEY_LENGTH = 64;

function deriveKey(
  password: string,
  salt: Buffer,
  cost: number,
  blockSize: number,
  parallelism: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      // scrypt refuses to use much memory unless we allow it; 2x the amount it needs.
      { N: cost, r: blockSize, p: parallelism, maxmem: 256 * cost * blockSize },
      (error, key) => {
        if (error) {
          reject(error);
        } else {
          resolve(key);
        }
      },
    );
  });
}

// Result looks like:  scrypt$65536$8$2$<salt>$<hash>
// The settings travel with the hash, so we can raise them later and old accounts still work.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, COST, BLOCK_SIZE, PARALLELISM);
  return [
    'scrypt',
    COST,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, costText, blockText, parallelText, saltText, hashText] = stored.split('$');
  if (scheme !== 'scrypt' || !costText || !blockText || !parallelText || !saltText || !hashText) {
    return false;
  }

  const expected = Buffer.from(hashText, 'base64');
  const actual = await deriveKey(
    password,
    Buffer.from(saltText, 'base64'),
    Number(costText),
    Number(blockText),
    Number(parallelText),
  );

  // Compare in constant time, so the time taken doesn't leak how many bytes matched.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// A real hash of a throwaway password. When someone logs in with an email we don't know,
// we still do the same slow work against this, so the response time doesn't reveal
// whether the email exists.
const dummyHash = hashPassword('this-is-not-a-real-password');

export async function verifyAgainstDummy(password: string): Promise<void> {
  await verifyPassword(password, await dummyHash);
}
