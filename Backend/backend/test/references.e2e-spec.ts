import { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { toErrorBody } from '../src/common/all-exceptions.filter.js';
import { db } from '../src/prisma/db.js';
import { ReferencesService } from '../src/references/references.service.js';
import { seedDemo } from '../src/seed/demo.js';
import { seedSetup } from '../src/seed/setup.js';
import {
  ADMIN,
  createTestApp,
  DEMO_PASSWORD,
  resetDatabase,
} from './support/app.js';

describe('Reference numbers (e2e)', () => {
  let app: INestApplication<Server>;
  let references: ReferencesService;
  let adminToken: string;
  let operationsToken: string;

  const signIn = async (email: string, password: string) =>
    (
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200)
    ).body.accessToken as string;

  const generate = (
    ...args: Parameters<ReferencesService['generate']> extends [
      unknown,
      ...infer Rest,
    ]
      ? Rest
      : never
  ) => db.transaction((tx) => references.generate(tx, ...args));

  const patchFormat = (
    documentType: string,
    body: object,
    token = adminToken,
  ) =>
    request(app.getHttpServer())
      .patch(`/api/reference-formats/${documentType}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const preview = (body: object, token = adminToken) =>
    request(app.getHttpServer())
      .post('/api/reference-formats/preview')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const createQuotation = async (reference: string) => {
    const customer = await db.orm.public.Party.where({
      name: 'Baobab Crest Traders Ltd',
    }).first();
    return db.orm.public.Quotation.create({
      reference,
      customerId: customer!.id,
      mode: 'sea',
      direction: 'import',
      origin: 'Shanghai',
      destination: 'Mombasa',
      cargoSummary: 'Fictional test cargo',
      issueDate: '2026-11-01',
      validUntil: '2026-11-30',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  beforeAll(async () => {
    app = await createTestApp();
    references = app.get(ReferencesService);
    await resetDatabase();
    await seedSetup(db, ADMIN);
    await seedDemo(db, DEMO_PASSWORD);
    adminToken = await signIn(ADMIN.email, ADMIN.password);
    operationsToken = await signIn(
      'a.wanjiru@freight-demo.example',
      DEMO_PASSWORD,
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('administration', () => {
    it('lists the seeded formats, using the frontend formats as defaults', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/reference-formats')
        .set('Authorization', `Bearer ${operationsToken}`)
        .expect(200);
      const templates = Object.fromEntries(
        response.body.map((f: { documentType: string; template: string }) => [
          f.documentType,
          f.template,
        ]),
      );
      expect(response.body).toHaveLength(7);
      expect(templates.shipment).toBe('FMS-{MODE}-{YYMM}-{SEQ:4}');
      expect(templates.quotation).toBe('QT-{YYMM}-{SEQ:4}');
      expect(templates.invoice).toBe('INV-{YYMM}-{SEQ:4}');
    });

    it('requires signing in to read formats', async () => {
      await request(app.getHttpServer())
        .get('/api/reference-formats')
        .expect(401);
    });

    it('refuses changes from users without the permission', async () => {
      const body = { template: 'X-{SEQ:4}', resetPolicy: 'never' };
      await patchFormat('invoice', body, operationsToken).expect(403);
      await preview(
        { ...body, documentType: 'invoice' },
        operationsToken,
      ).expect(403);
    });

    it('rejects invalid formats with field details', async () => {
      const response = await patchFormat('invoice', {
        template: 'inv/{SEQ:4}',
        resetPolicy: 'never',
      });
      expect(response.status).toBe(400);
      expect(response.body.details[0].field).toBe('template');
    });

    it('rejects unknown document types and policies', async () => {
      await patchFormat('widget', {
        template: 'X-{SEQ:4}',
        resetPolicy: 'never',
      }).expect(400);
      await patchFormat('invoice', {
        template: 'X-{SEQ:4}',
        resetPolicy: 'sometimes',
      }).expect(400);
    });

    it('records who changed a format in the audit log', async () => {
      const format = { template: 'CRN-{YY}-{SEQ:5}', resetPolicy: 'yearly' };
      const response = await patchFormat('credit_note', format);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        documentType: 'credit_note',
        ...format,
      });
      const entries = await db.orm.public.AuditLog.where({
        entityType: 'ReferenceFormat',
        entityId: response.body.id,
      }).all();
      expect(entries).toHaveLength(1);
      expect(entries[0].actorUserId).toBe(response.body.updatedById);
      expect(entries[0].changes).toMatchObject({
        before: { template: 'CN-{YYMM}-{SEQ:4}' },
        after: format,
      });
    });

    it('previews the next reference without using a number', async () => {
      const body = {
        documentType: 'customs_entry',
        template: 'ENTRY-{SEQ:3}',
        resetPolicy: 'never',
      };
      const first = await preview(body);
      expect(first.status).toBe(200);
      expect(first.body.reference).toBe('ENTRY-001');
      await preview(body).expect(200);
      const counter = await db.orm.public.NumberSequence.where({
        prefix: 'customs_entry',
      }).first();
      expect(counter).toBeNull();
    });
  });

  describe('generation', () => {
    const november = new Date('2026-11-15T09:00:00+03:00');

    it('renders the existing shipment format, with one running number across modes', async () => {
      await expect(
        generate('shipment', { mode: 'sea', at: november }),
      ).resolves.toBe('FMS-SEA-2611-0001');
      await expect(
        generate('shipment', { mode: 'air', at: november }),
      ).resolves.toBe('FMS-AIR-2611-0002');
    });

    it('gives the number back when the transaction fails', async () => {
      const failing = db.transaction(async (tx) => {
        await references.generate(tx, 'booking', { at: november });
        throw new Error('saving the record failed');
      });
      await expect(failing).rejects.toThrow('saving the record failed');
      await expect(generate('booking', { at: november })).resolves.toBe(
        'BKG-2611-0001',
      );
    });

    it('never issues duplicates under concurrent requests', async () => {
      const issued = await Promise.all(
        Array.from({ length: 25 }, () => generate('payment', { at: november })),
      );
      expect(new Set(issued).size).toBe(25);
      expect([...issued].sort()[24]).toBe('RCT-2611-0025');
    });

    it('leaves issued references unchanged when a format changes', async () => {
      const issued = await generate('quotation', { at: november });
      expect(issued).toBe('QT-2611-0001');
      const quotation = await createQuotation(issued);

      await patchFormat('quotation', {
        template: 'QUOTE-{YYYY}-{SEQ:6}',
        resetPolicy: 'never',
      }).expect(200);

      const stored = await db.orm.public.Quotation.where({
        id: quotation.id,
      }).first();
      expect(stored!.reference).toBe('QT-2611-0001');
      await expect(generate('quotation', { at: november })).resolves.toBe(
        'QUOTE-2026-000002',
      );
    });

    it('skips numbers already used when a restart would repeat them', async () => {
      await patchFormat('quotation', {
        template: 'Q-{YYMM}-{SEQ:4}',
        resetPolicy: 'monthly',
      }).expect(200);
      await createQuotation('Q-2612-0001');
      await createQuotation('Q-2612-0002');

      const isTaken = async (candidate: string) =>
        (await db.orm.public.Quotation.where({
          reference: candidate,
        }).first()) !== null;
      await expect(
        generate('quotation', {
          at: new Date('2026-12-05T09:00:00+03:00'),
          isTaken,
        }),
      ).resolves.toBe('Q-2612-0003');
    });

    it('restarts monthly counters each month', async () => {
      await expect(
        generate('quotation', { at: new Date('2027-01-05T09:00:00+03:00') }),
      ).resolves.toBe('Q-2701-0001');
    });

    it('the database refuses duplicate references, reported as a conflict', async () => {
      await createQuotation('DUPLICATE-1');
      const error: unknown = await createQuotation('DUPLICATE-1').catch(
        (caught: unknown) => caught,
      );
      expect(toErrorBody(error).statusCode).toBe(409);
    });

    it('reports a missing linked record as 422', async () => {
      const error: unknown = await db.orm.public.Contact.create({
        partyId: 999_999,
        name: 'Nobody',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).catch((caught: unknown) => caught);
      expect(toErrorBody(error).statusCode).toBe(422);
    });
  });
});
