import { corsOrigins, validateEnv } from './env.validation.js';

describe('validateEnv', () => {
  const original = { ...process.env };
  const validSecret = 'x'.repeat(32);
  const url = 'postgresql://user:pass@localhost:5432/db';

  afterEach(() => {
    process.env = { ...original };
  });

  it('passes when the required variables are set', () => {
    process.env['DATABASE_URL'] = url;
    process.env['JWT_SECRET'] = validSecret;
    expect(() => validateEnv()).not.toThrow();
  });

  it('throws when DATABASE_URL is missing', () => {
    delete process.env['DATABASE_URL'];
    process.env['JWT_SECRET'] = validSecret;
    expect(() => validateEnv()).toThrow('DATABASE_URL');
  });

  it('throws when DATABASE_URL is blank', () => {
    process.env['DATABASE_URL'] = '   ';
    process.env['JWT_SECRET'] = validSecret;
    expect(() => validateEnv()).toThrow('DATABASE_URL');
  });

  it('throws when JWT_SECRET is missing', () => {
    process.env['DATABASE_URL'] = url;
    delete process.env['JWT_SECRET'];
    expect(() => validateEnv()).toThrow('JWT_SECRET');
  });

  it('throws when JWT_SECRET is too short', () => {
    process.env['DATABASE_URL'] = url;
    process.env['JWT_SECRET'] = 'short';
    expect(() => validateEnv()).toThrow('at least 32');
  });
});

describe('corsOrigins', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('defaults to the local frontend', () => {
    delete process.env['CORS_ORIGINS'];
    expect(corsOrigins()).toEqual(['http://localhost:3000']);
  });

  it('reads a comma-separated list', () => {
    process.env['CORS_ORIGINS'] = 'https://a.example, https://b.example';
    expect(corsOrigins()).toEqual(['https://a.example', 'https://b.example']);
  });
});
