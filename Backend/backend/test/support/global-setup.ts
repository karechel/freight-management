import postgres from '@prisma/orm-postgres/runtime';
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { Contract } from '../../src/prisma/contract.d.ts';
import contractJson from '../../src/prisma/contract.json' with { type: 'json' };
import { databaseName, testDatabaseUrl } from './test-database.js';

/** Creates the test database if needed, then applies all migrations to it. */
export default async function setup(): Promise<void> {
  const testUrl = testDatabaseUrl();
  const name = databaseName(testUrl);

  const admin = postgres<Contract>({
    contractJson,
    url: process.env['DATABASE_URL']!,
  });
  try {
    const existing = await admin
      .runtime()
      .query(
        admin.raw
          .sql`SELECT 1 AS "found" FROM pg_database WHERE datname = ${name}`
          .returnsRow({ found: 'pg/int4@1' })
          .build(),
      );
    if (existing.length === 0) {
      // CREATE DATABASE cannot take a bound parameter. The name was checked by assertTestDatabase.
      const statement = `CREATE DATABASE "${name}"`;
      const parts = Object.assign([statement], { raw: [statement] });
      await admin
        .runtime()
        .execute(admin.raw.sql(parts).affectedCount().build());
    }
  } finally {
    await admin.close();
  }

  const cli = resolve('node_modules/prisma/dist/prisma.js');
  const result = spawnSync(
    process.execPath,
    [cli, 'db', 'migrate', '--db', testUrl],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    // The output can contain the connection string, so only the exit status is reported.
    throw new Error(`Migrating the test database failed (${result.status}).`);
  }
}
