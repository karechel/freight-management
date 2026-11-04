import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { db } from '../../src/prisma/db.js';
import { assertTestDatabase } from './test-database.js';

export const ADMIN = {
  email: 'admin@freight-demo.example',
  password: 'e2e-admin-password',
};
export const DEMO_PASSWORD = 'e2e-demo-password';

export async function createTestApp(): Promise<INestApplication<Server>> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<Server>>();
  configureApp(app);
  await app.init();
  return app;
}

/** Empties every table in the test database, and only there. */
export async function resetDatabase(): Promise<void> {
  assertTestDatabase(process.env['DATABASE_URL']!);
  await db.runtime().execute(
    db.raw.sql`
      TRUNCATE "User", "Role", "Permission", "Party", "ChargeType", "NumberSequence",
        "ReferenceFormat", "RetentionPolicy", "AuditLog"
      RESTART IDENTITY CASCADE
    `
      .affectedCount()
      .build(),
  );
}
