import { db } from '../src/prisma/db.js';
import { verifyPassword } from '../src/auth/password.js';
import { seedDemo } from '../src/seed/demo.js';
import { seedDemoQuotations } from '../src/seed/demo-quotations.js';
import { seedDemoShipments } from '../src/seed/demo-shipments.js';
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

  it('adds fictional quotations and bookings once, with counters after them', async () => {
    await expect(seedDemoQuotations(db)).resolves.toEqual({
      quotations: 8,
      bookings: 2,
    });
    await expect(seedDemoQuotations(db)).resolves.toEqual({
      quotations: 0,
      bookings: 0,
    });

    const booked = await db.orm.public.Quotation.where({
      reference: 'QT-2610-0051',
    }).first();
    expect(booked?.status).toBe('accepted');
    const booking = await db.orm.public.Booking.where({
      quotationId: booked!.id,
    }).first();
    expect(booking).toMatchObject({
      reference: 'BKG-2610-0001',
      status: 'confirmed',
    });
    const lines = await db.orm.public.QuotationLine.where({
      quotationId: booked!.id,
    }).all();
    expect(lines.map((l) => l.unitPrice)).toEqual(['968000.00']);

    const counter = (prefix: string) =>
      db.orm.public.NumberSequence.where({ prefix, year: 0 }).first();
    expect((await counter('quotation'))?.nextValue).toBe(58);
    expect((await counter('booking'))?.nextValue).toBe(3);
  });

  it('adds fictional shipments once, linked to the seeded bookings', async () => {
    await expect(seedDemoShipments(db)).resolves.toEqual({ shipments: 11 });
    await expect(seedDemoShipments(db)).resolves.toEqual({ shipments: 0 });
    const booked = await db.orm.public.Shipment.where({
      reference: 'FMS-SEA-2610-0022',
    }).first();
    const booking = await db.orm.public.Booking.where({
      reference: 'BKG-2610-0001',
    }).first();
    expect(booked?.bookingId).toBe(booking!.id);
    const delayed = await db.orm.public.Shipment.where({
      reference: 'FMS-ROAD-2610-0033',
    }).first();
    const delays = await db.orm.public.ShipmentIssue.where({
      shipmentId: delayed!.id,
      type: 'delay',
    }).all();
    expect(delays).toHaveLength(1);
    const counter = await db.orm.public.NumberSequence.where({
      prefix: 'shipment',
      year: 0,
    }).first();
    expect(counter?.nextValue).toBe(42);
  });

  it('never moves a counter back when re-run', async () => {
    await db.orm.public.NumberSequence.where({
      prefix: 'quotation',
      year: 0,
    }).update({ nextValue: 120 });
    await seedDemoQuotations(db);
    const counter = await db.orm.public.NumberSequence.where({
      prefix: 'quotation',
      year: 0,
    }).first();
    expect(counter?.nextValue).toBe(120);
  });

  it('refuses to add fictional data in production', async () => {
    const original = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      await expect(seedDemo(db, DEMO_PASSWORD)).rejects.toThrow('production');
      await expect(seedDemoQuotations(db)).rejects.toThrow('production');
      await expect(seedDemoShipments(db)).rejects.toThrow('production');
    } finally {
      process.env['NODE_ENV'] = original;
    }
  });
});
