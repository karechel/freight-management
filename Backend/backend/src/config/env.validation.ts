const REQUIRED_ENV_VARS = ['DATABASE_URL', 'JWT_SECRET'] as const;
const MIN_JWT_SECRET_LENGTH = 32;
const DEFAULT_CORS_ORIGINS = ['http://localhost:3000'];

export function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]?.trim());

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. Copy .env.example to .env and fill in real values.`,
    );
  }

  if (process.env['JWT_SECRET']!.trim().length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters long.`,
    );
  }
}

/** Origins allowed by CORS: comma-separated CORS_ORIGINS, or the local frontend. */
export function corsOrigins(): string[] {
  const origins = (process.env['CORS_ORIGINS'] ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : DEFAULT_CORS_ORIGINS;
}
