import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateEnv } from './env.validation.js';

describe('validateEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws a clear error when DATABASE_URL is missing', () => {
    vi.stubEnv('DATABASE_URL', '');
    expect(() => validateEnv()).toThrow(/DATABASE_URL/);
  });

  it('does not throw when DATABASE_URL is set', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db');
    expect(() => validateEnv()).not.toThrow();
  });
});
