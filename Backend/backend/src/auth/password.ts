import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SCHEME = 'scrypt';
const N = 2 ** 17;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const MAX_MEMORY_BYTES = 256 * 1024 * 1024;

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 200;

function derive(
  password: string,
  salt: Buffer,
  params: { n: number; r: number; p: number; keyLength: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      params.keyLength,
      { N: params.n, r: params.r, p: params.p, maxmem: MAX_MEMORY_BYTES },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

/** Returns `scrypt$N$r$p$salt$hash`; the stored parameters allow strengthening them later. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, {
    n: N,
    r: R,
    p: P,
    keyLength: KEY_LENGTH,
  });
  return [
    SCHEME,
    N,
    R,
    P,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$');
  if (scheme !== SCHEME || !n || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await derive(password, Buffer.from(salt, 'base64'), {
    n: Number(n),
    r: Number(r),
    p: Number(p),
    keyLength: expected.length,
  });
  return timingSafeEqual(actual, expected);
}
