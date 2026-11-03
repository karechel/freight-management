import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('accepts the right password and rejects a wrong one', async () => {
    const stored = await hashPassword('correct horse battery');
    await expect(verifyPassword('correct horse battery', stored)).resolves.toBe(
      true,
    );
    await expect(verifyPassword('wrong password here', stored)).resolves.toBe(
      false,
    );
  });

  it('never stores the password and salts each hash', async () => {
    const first = await hashPassword('correct horse battery');
    const second = await hashPassword('correct horse battery');
    expect(first).not.toContain('correct horse battery');
    expect(first).not.toEqual(second);
    expect(first.startsWith('scrypt$131072$8$1$')).toBe(true);
  });

  it('rejects malformed stored values', async () => {
    await expect(verifyPassword('anything', 'not-a-hash')).resolves.toBe(false);
  });
});
