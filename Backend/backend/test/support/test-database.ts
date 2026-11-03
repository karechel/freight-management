/**
 * The end-to-end tests never touch the development database. They use a separate database whose
 * name is the development database's plus "_test", or DATABASE_URL_TEST when that is set.
 */
export function testDatabaseUrl(): string {
  const explicit = process.env['DATABASE_URL_TEST'];
  if (explicit) return assertTestDatabase(explicit);

  const base = process.env['DATABASE_URL'];
  if (!base) throw new Error('Set DATABASE_URL in .env first.');
  const url = new URL(base);
  url.pathname = `${url.pathname}_test`;
  return assertTestDatabase(url.toString());
}

export function databaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}

/** Refuses anything not clearly a test database, so tests can never wipe real data. */
export function assertTestDatabase(url: string): string {
  const name = databaseName(url);
  if (!/^[A-Za-z0-9_-]+_test$/.test(name)) {
    throw new Error(
      'End-to-end tests only run against a database whose name ends in "_test".',
    );
  }
  return url;
}
