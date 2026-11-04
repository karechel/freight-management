import { db } from '../src/prisma/db.js';
import { verifyPassword } from '../src/auth/password.js';
import { seedDemo } from '../src/seed/demo.js';
import { seedSetup } from '../src/seed/setup.js';
import { ADMIN, DEMO_PASSWORD, resetDatabase } from './support/app.js';

describe('Seed scripts (e2e)', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await db.close();
  });

  it('creates the setup data', async () => {
    await expect(seedSetup(db, ADMIN)).resolves.toMatchObject({
      roles: 6,
      chargeTypes: 14,
      retentionPolicies: 1,
      referenceFormats: 7,
      adminCreated: true,
    });
  });

  it('adds nothing on a second run and keeps the admin password', async () => {
    const second = await seedSetup(db, {
      email: ADMIN.email,
      password: 'a-different-password',
    });
    expect(second).toEqual({
      roles: 0,
      permissions: 0,
      grants: 0,
      chargeTypes: 0,
      retentionPolicies: 0,
      referenceFormats: 0,
      adminCreated: false,
    });
    const admin = await db.orm.public.User.where({
      email: ADMIN.email,
    }).first();
    await expect(
      verifyPassword(ADMIN.password, admin!.passwordHash!),
    ).resolves.toBe(true);
  });

  it('keeps administrators’ later changes when re-run', async () => {
    const role = await db.orm.public.Role.where({ code: 'sales' }).first();
    const before = await db.orm.public.RolePermission.where({
      roleId: role!.id,
    }).all();
    await db.orm.public.RolePermission.where({ id: before[0].id }).delete();
    await db.orm.public.ReferenceFormat.where({
      documentType: 'invoice',
    }).update({ template: 'CUSTOM-{SEQ:4}' });

    await seedSetup(db, ADMIN);

    const after = await db.orm.public.RolePermission.where({
      roleId: role!.id,
    }).all();
    expect(after).toHaveLength(before.length - 1);
    const format = await db.orm.public.ReferenceFormat.where({
      documentType: 'invoice',
    }).first();
    expect(format!.template).toBe('CUSTOM-{SEQ:4}');
  });

  it('adds fictional data once, using reserved .example emails', async () => {
    await expect(seedDemo(db, DEMO_PASSWORD)).resolves.toEqual({
      parties: 12,
      contacts: 12,
      users: 4,
    });
    await expect(seedDemo(db, DEMO_PASSWORD)).resolves.toEqual({
      parties: 0,
      contacts: 0,
      users: 0,
    });
    const parties = await db.orm.public.Party.all();
    expect(parties.every((p) => p.email?.endsWith('.example'))).toBe(true);
  });

  it('refuses to add fictional data in production', async () => {
    const original = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      await expect(seedDemo(db, DEMO_PASSWORD)).rejects.toThrow('production');
    } finally {
      process.env['NODE_ENV'] = original;
    }
  });
});
