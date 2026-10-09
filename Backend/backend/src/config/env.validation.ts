const REQUIRED_ENV_VARS = ['DATABASE_URL'] as const;

export function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]?.trim());

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. Copy .env.example to .env and fill in real values.`,
    );
  }
}
