import { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { db } from '../src/prisma/db.js';
import { nairobiToday } from '../src/quotations/quotation-rules.js';
import { seedDemo } from '../src/seed/demo.js';
import { seedSetup } from '../src/seed/setup.js';
import {
  ADMIN,
  createTestApp,
  DEMO_PASSWORD,
  resetDatabase,
} from './support/app.js';

const OPERATIONS = 'a.wanjiru@freight-demo.example';
const SALES = 'b.otieno@freight-demo.example';
const FINANCE = 'f.mwende@freight-demo.example';
const MANAGEMENT = 'g.nduta@freight-demo.example';

/** A date `days` from today on the Nairobi calendar. */
function day(days: number): string {
  const [y, m, d] = nairobiToday().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

describe('Quotations and bookings (e2e)', () => {
  let app: INestApplication<Server>;
  const tokens: Record<string, string> = {};
  let customerId: number;
  let agentId: number;
  let carrierId: number;

  const api = (token?: string) => {
    const agent = request(app.getHttpServer());
    const withAuth = (test: request.Test) =>
      token ? test.set('Authorization', `Bearer ${token}`) : test;
    return {
      get: (path: string) => withAuth(agent.get(`/api${path}`)),
      post: (path: string, body: object = {}) =>
        withAuth(agent.post(`/api${path}`)).send(body),
      patch: (path: string, body: object) =>
        withAuth(agent.patch(`/api${path}`)).send(body),
    };
  };
  const admin = () => api(tokens.admin);
  const sales = () => api(tokens.sales);

  const fieldsIn = (body: { details: { field: string }[] }) =>
    body.details.map((problem) => problem.field);

  const idOf = async (name: string) =>
    (await db.orm.public.Party.where({ name }).first())!.id;

  const quotationBody = (extra: object = {}) => ({
    customerId,
    agentId,
    mode: 'sea',
    direction: 'import',
    origin: 'Shanghai',
    destination: 'Mombasa',
    cargoSummary: '1 × 40ft HC, household goods',
    issueDate: day(0),
    validUntil: day(30),
    lines: [
      {
        description: 'Ocean freight',
        quantity: '1',
        unitPrice: '150000',
        taxRate: '0',
      },
      {
        description: 'Clearing fee',
        quantity: '1',
        unitPrice: '25000',
        taxRate: '16',
      },
    ],
    ...extra,
  });

  const newQuotation = async (extra: object = {}) =>
    (await sales().post('/quotations', quotationBody(extra)).expect(201))
      .body as { reference: string; id: number };

  const accepted = async (extra: object = {}) => {
    const { reference } = await newQuotation(extra);
    await sales()
      .post(`/quotations/${reference}/status`, {
        status: 'sent',
        sentAt: new Date().toISOString(),
        sentTo: 'buyer@baobabcrest.example',
      })
      .expect(200);
    await sales()
      .post(`/quotations/${reference}/status`, {
        status: 'accepted',
        decidedAt: new Date().toISOString(),
      })
      .expect(200);
    return reference;
  };

  const newCustomer = async (name: string, extra: object = {}) =>
    (
      await admin()
        .post('/parties', { name, roles: ['customer'], ...extra })
        .expect(201)
    ).body as { id: number };

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase();
    await seedSetup(db, ADMIN);
    await seedDemo(db, DEMO_PASSWORD);
    const signIn = async (email: string, password: string) =>
      (
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email, password })
          .expect(200)
      ).body.accessToken as string;
    tokens.admin = await signIn(ADMIN.email, ADMIN.password);
    tokens.sales = await signIn(SALES, DEMO_PASSWORD);
    tokens.finance = await signIn(FINANCE, DEMO_PASSWORD);
    tokens.operations = await signIn(OPERATIONS, DEMO_PASSWORD);
    tokens.management = await signIn(MANAGEMENT, DEMO_PASSWORD);
    customerId = await idOf('Baobab Crest Traders Ltd');
    agentId = await idOf('Eastgate Forwarding (Shanghai)');
    carrierId = await idOf('Indigo Ocean Lines');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('access', () => {
    it('refuses callers who are not signed in', async () => {
      await api().get('/quotations').expect(401);
      await api().get('/bookings').expect(401);
      await api().get('/charge-types').expect(401);
    });

    it('lets roles with quotations.view read, and only quotations.manage write', async () => {
      for (const role of ['operations', 'finance', 'management', 'sales']) {
        await api(tokens[role]).get('/quotations').expect(200);
        await api(tokens[role]).get('/bookings').expect(200);
      }
      for (const role of ['operations', 'finance', 'management']) {
        await api(tokens[role])
          .post('/quotations', quotationBody())
          .expect(403);
        await api(tokens[role]).post('/bookings', {}).expect(403);
      }
    });

    it('lists active charge types for any signed-in user', async () => {
      const { body } = await api(tokens.operations)
        .get('/charge-types')
        .expect(200);
      expect(body.length).toBeGreaterThan(0);
      expect(body[0]).toHaveProperty('defaultTaxRate');
    });
  });

  describe('quotations', () => {
    it('creates a draft with a configured reference and totals calculated on the server', async () => {
      const { body } = await sales()
        .post('/quotations', {
          ...quotationBody(),
          lines: [
            // 2.5 × 0.01 = 0.025 → 0.03 (half away from zero); tax 16% of 0.03 = 0.0048 → 0.00
            {
              description: 'Rounding',
              quantity: '2.5',
              unitPrice: '0.01',
              taxRate: '16',
            },
            {
              description: 'Clearing fee',
              quantity: '1',
              unitPrice: '25000',
              taxRate: '16',
            },
          ],
        })
        .expect(201);
      expect(body.reference).toMatch(/^QT-\d{4}-\d{4}$/);
      expect(body.status).toBe('draft');
      expect(body.currency).toBe('KES');
      expect(body.totals).toEqual({
        subtotal: '25000.03',
        tax: '4000.00',
        total: '29000.03',
      });
      expect(body.lines[0].amounts).toEqual({
        net: '0.03',
        tax: '0.00',
        total: '0.03',
      });
      expect(body.lines[1].taxCategory).toBe('standard');
      const audit = await db.orm.public.AuditLog.where({
        entityType: 'Quotation',
        entityId: body.id,
      }).first();
      expect(audit?.action).toBe('create');
    });

    it('refuses fields the API does not accept, such as client-calculated totals', async () => {
      await sales()
        .post('/quotations', { ...quotationBody(), totals: { total: '1' } })
        .expect(400);
    });

    it('validates fields, lines and dates', async () => {
      const { body } = await sales()
        .post('/quotations', {
          ...quotationBody(),
          destination: 'shanghai',
          issueDate: day(1),
          validUntil: day(0),
          lines: [
            {
              description: '',
              quantity: '1.2345',
              unitPrice: '1,000',
              taxRate: '16',
            },
          ],
        })
        .expect(400);
      expect(fieldsIn(body)).toEqual(
        expect.arrayContaining([
          'lines.0.description',
          'lines.0.quantity',
          'lines.0.unitPrice',
        ]),
      );
      const dates = await sales()
        .post('/quotations', {
          ...quotationBody(),
          destination: 'shanghai',
          issueDate: day(1),
          validUntil: day(0),
        })
        .expect(400);
      expect(fieldsIn(dates.body)).toEqual(
        expect.arrayContaining(['destination', 'issueDate', 'validUntil']),
      );
      const zero = await sales()
        .post('/quotations', {
          ...quotationBody(),
          lines: [
            {
              description: 'Free',
              quantity: '1',
              unitPrice: '0',
              taxRate: '0',
            },
          ],
        })
        .expect(400);
      expect(fieldsIn(zero.body)).toEqual(['lines']);
    });

    it('refuses a party without the right role', async () => {
      const { body } = await sales()
        .post('/quotations', quotationBody({ customerId: agentId }))
        .expect(400);
      expect(fieldsIn(body)).toEqual(['customerId']);
      const agent = await sales()
        .post('/quotations', quotationBody({ agentId: customerId }))
        .expect(400);
      expect(fieldsIn(agent.body)).toEqual(['agentId']);
    });

    it('refuses new quotations for archived customers', async () => {
      const archived = await newCustomer('Archived Quote Customer Ltd');
      await admin().post(`/parties/${archived.id}/archive`).expect(200);
      await sales()
        .post('/quotations', quotationBody({ customerId: archived.id }))
        .expect(409);
    });

    it('edits draft and sent quotations, replacing lines', async () => {
      const { reference } = await newQuotation();
      const edited = await sales()
        .patch(`/quotations/${reference}`, {
          cargoSummary: '2 × 20ft GP',
          lines: [
            {
              description: 'Freight',
              quantity: '2',
              unitPrice: '1000.50',
              taxRate: '0',
            },
          ],
        })
        .expect(200);
      expect(edited.body.cargoSummary).toBe('2 × 20ft GP');
      expect(edited.body.lines).toHaveLength(1);
      expect(edited.body.totals.total).toBe('2001.00');

      await sales()
        .post(`/quotations/${reference}/status`, {
          status: 'sent',
          sentAt: new Date().toISOString(),
          sentTo: 'buyer@example.com',
        })
        .expect(200);
      const sent = await sales()
        .patch(`/quotations/${reference}`, { terms: 'Valid for 30 days.' })
        .expect(200);
      expect(sent.body.status).toBe('sent');
    });

    it('locks accepted quotations', async () => {
      const reference = await accepted();
      await sales()
        .patch(`/quotations/${reference}`, { terms: 'Changed' })
        .expect(409);
    });

    it('follows the status flow and checks dates', async () => {
      const { reference } = await newQuotation();
      await sales()
        .post(`/quotations/${reference}/status`, {
          status: 'accepted',
          decidedAt: new Date().toISOString(),
        })
        .expect(409);
      const missing = await sales()
        .post(`/quotations/${reference}/status`, { status: 'sent' })
        .expect(400);
      expect(fieldsIn(missing.body)).toEqual(['sentAt', 'sentTo']);
      const future = await sales()
        .post(`/quotations/${reference}/status`, {
          status: 'sent',
          sentAt: new Date(Date.now() + 86_400_000).toISOString(),
          sentTo: 'x',
        })
        .expect(400);
      expect(fieldsIn(future.body)).toEqual(['sentAt']);
    });

    it('derives expiry from the valid-until date', async () => {
      const { reference, id } = await newQuotation({
        issueDate: day(-10),
        validUntil: day(-1),
      });
      const { body } = await sales()
        .get(`/quotations/${reference}`)
        .expect(200);
      expect(body.status).toBe('expired');
      expect(body.storedStatus).toBe('draft');
      expect(body.editable).toBe(false);
      await sales()
        .patch(`/quotations/${reference}`, { terms: 'x' })
        .expect(409);
      const list = await sales().get('/quotations?status=expired').expect(200);
      expect(list.body.items.map((q: { id: number }) => q.id)).toContain(id);
    });

    it('duplicates a quotation as a new draft', async () => {
      const source = await accepted();
      const { body } = await sales()
        .post('/quotations', quotationBody({ duplicatedFrom: source }))
        .expect(201);
      expect(body.status).toBe('draft');
      expect(body.duplicatedFrom.reference).toBe(source);
      await sales()
        .post('/quotations', quotationBody({ duplicatedFrom: 'QT-0000-0000' }))
        .expect(400);
    });

    it('issues unique references under concurrency', async () => {
      const created = await Promise.all(
        Array.from({ length: 8 }, () =>
          sales().post('/quotations', quotationBody()).expect(201),
        ),
      );
      const references = created.map((r) => r.body.reference as string);
      expect(new Set(references).size).toBe(references.length);
    });

    it('returns 404 for unknown references', async () => {
      await sales().get('/quotations/QT-9999-9999').expect(404);
    });
  });

  describe('conversion to a booking', () => {
    it('converts an accepted quotation once, copying its details', async () => {
      const reference = await accepted();
      const { body } = await sales()
        .post(`/quotations/${reference}/convert`, {
          carrierId,
          carrierBookingNumber: 'IOL-778812',
        })
        .expect(201);
      expect(body.reference).toMatch(/^BKG-\d{4}-\d{4}$/);
      expect(body.status).toBe('pending');
      expect(body.quotation.reference).toBe(reference);
      expect(body.customer.id).toBe(customerId);
      expect(body.agent.id).toBe(agentId);
      expect(body.carrier.id).toBe(carrierId);
      expect(body.origin).toBe('Shanghai');

      await sales().post(`/quotations/${reference}/convert`).expect(409);
      const quotation = await sales()
        .get(`/quotations/${reference}`)
        .expect(200);
      expect(quotation.body.booking.reference).toBe(body.reference);
      await sales()
        .post(`/quotations/${reference}/status`, {
          status: 'declined',
          decidedAt: new Date().toISOString(),
        })
        .expect(409);
    });

    it('creates exactly one booking when converted twice at once', async () => {
      const reference = await accepted();
      const results = await Promise.all([
        sales().post(`/quotations/${reference}/convert`),
        sales().post(`/quotations/${reference}/convert`),
      ]);
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        201, 409,
      ]);
      const quotation = await db.orm.public.Quotation.where({
        reference,
      }).first();
      const bookings = await db.orm.public.Booking.where({
        quotationId: quotation!.id,
      }).all();
      expect(bookings).toHaveLength(1);
    });

    it('refuses quotations that are not accepted', async () => {
      const { reference } = await newQuotation();
      await sales().post(`/quotations/${reference}/convert`).expect(409);
    });

    it('refuses conversion for a customer archived after acceptance', async () => {
      const customer = await newCustomer('Archived Later Ltd');
      const reference = await accepted({ customerId: customer.id });
      await admin().post(`/parties/${customer.id}/archive`).expect(200);
      await sales().post(`/quotations/${reference}/convert`).expect(409);
    });
  });

  describe('credit-limit check at booking', () => {
    // The quotation total is 150000 + 25000 × 1.16 = 179000.00.
    let limited: number;

    beforeAll(async () => {
      limited = (
        await newCustomer('Credit Limited Ltd', { creditLimit: '100000' })
      ).id;
    });

    it('warns with the figures and creates nothing when no decision is sent', async () => {
      const reference = await accepted({ customerId: limited });
      const { body } = await sales()
        .post(`/quotations/${reference}/convert`)
        .expect(409);
      expect(body.details[0]).toMatchObject({
        field: 'creditDecision',
        exposure: '0.00',
        creditLimit: '100000.00',
        attemptedAmount: '179000.00',
        canOverride: false,
      });
      expect(
        await db.orm.public.CreditCheck.where({ customerId: limited }).first(),
      ).toBeNull();
    });

    it('lets sales stop, recording the decision, but never proceed', async () => {
      const reference = await accepted({ customerId: limited });
      await sales()
        .post(`/quotations/${reference}/convert`, {
          creditDecision: { decision: 'proceed', reason: 'Good customer' },
        })
        .expect(403);
      const stopped = await sales()
        .post(`/quotations/${reference}/convert`, {
          creditDecision: { decision: 'blocked', reason: 'Over limit' },
        })
        .expect(409);
      expect(stopped.body.details[0].decision).toBe('blocked');
      const check = await db.orm.public.CreditCheck.where({
        customerId: limited,
        decision: 'blocked',
      }).first();
      expect(check?.reason).toBe('Over limit');
      expect(check?.bookingId).toBeNull();
      const quotation = await sales()
        .get(`/quotations/${reference}`)
        .expect(200);
      expect(quotation.body.booking).toBeNull();
    });

    it('lets credit.override holders proceed, recording who, when and why', async () => {
      const reference = await accepted({ customerId: limited });
      const { body } = await admin()
        .post(`/quotations/${reference}/convert`, {
          creditDecision: {
            decision: 'proceed',
            reason: 'Approved by finance',
          },
        })
        .expect(201);
      const check = await db.orm.public.CreditCheck.where({
        bookingId: body.id,
      }).first();
      expect(check).toMatchObject({
        decision: 'proceed',
        reason: 'Approved by finance',
        attemptedAmount: '179000.00',
      });
      expect(body.creditChecks).toHaveLength(1);
      const audit = await db.orm.public.AuditLog.where({
        entityType: 'CreditCheck',
        entityId: check!.id,
      }).first();
      expect(audit?.action).toBe('credit_override');
    });

    it('needs a reason with every decision', async () => {
      const reference = await accepted({ customerId: limited });
      const { body } = await admin()
        .post(`/quotations/${reference}/convert`, {
          creditDecision: { decision: 'proceed', reason: ' ' },
        })
        .expect(400);
      expect(fieldsIn(body)).toEqual(['creditDecision.reason']);
    });

    it('does not check customers without a limit, or within it', async () => {
      const reference = await accepted();
      await sales().post(`/quotations/${reference}/convert`).expect(201);
      const roomy = await newCustomer('Roomy Limit Ltd', {
        creditLimit: '500000',
      });
      const within = await accepted({ customerId: roomy.id });
      await sales().post(`/quotations/${within}/convert`).expect(201);
      expect(
        await db.orm.public.CreditCheck.where({ customerId: roomy.id }).first(),
      ).toBeNull();
    });

    it('asks for an estimated value on standalone bookings for customers with a limit', async () => {
      const standalone = {
        customerId: limited,
        mode: 'air',
        direction: 'export',
        origin: 'Nairobi',
        destination: 'Amsterdam',
        cargoSummary: 'Cut flowers, 40 cartons',
      };
      const missing = await sales().post('/bookings', standalone).expect(400);
      expect(fieldsIn(missing.body)).toEqual(['estimatedValue']);
      await sales()
        .post('/bookings', { ...standalone, estimatedValue: '200000' })
        .expect(409);
      const within = await sales()
        .post('/bookings', { ...standalone, estimatedValue: '50000' })
        .expect(201);
      expect(within.body.quotation).toBeNull();
    });
  });

  describe('bookings', () => {
    const standalone = () => ({
      customerId,
      mode: 'road',
      direction: 'transit',
      origin: 'Mombasa',
      destination: 'Kampala',
      cargoSummary: 'Transit cargo, 1 truck',
    });

    it('creates standalone bookings and refuses archived customers', async () => {
      const { body } = await sales()
        .post('/bookings', standalone())
        .expect(201);
      expect(body.reference).toMatch(/^BKG-/);
      const archived = await newCustomer('Archived Booking Customer Ltd');
      await admin().post(`/parties/${archived.id}/archive`).expect(200);
      await sales()
        .post('/bookings', { ...standalone(), customerId: archived.id })
        .expect(409);
    });

    it('checks the carrier role and planned dates', async () => {
      const carrier = await sales()
        .post('/bookings', { ...standalone(), carrierId: agentId })
        .expect(400);
      expect(fieldsIn(carrier.body)).toEqual(['carrierId']);
      const dates = await sales()
        .post('/bookings', {
          ...standalone(),
          plannedEtd: '2026-12-10T08:00:00+03:00',
          plannedEta: '2026-12-09T08:00:00+03:00',
        })
        .expect(400);
      expect(fieldsIn(dates.body)).toEqual(['plannedEta']);
    });

    it('confirms pending bookings and cancels with a reason', async () => {
      const { body } = await sales()
        .post('/bookings', standalone())
        .expect(201);
      const confirmed = await sales()
        .post(`/bookings/${body.reference}/confirm`)
        .expect(200);
      expect(confirmed.body.status).toBe('confirmed');
      expect(confirmed.body.confirmedAt).not.toBeNull();
      await sales().post(`/bookings/${body.reference}/confirm`).expect(409);

      await sales().post(`/bookings/${body.reference}/cancel`, {}).expect(400);
      const cancelled = await sales()
        .post(`/bookings/${body.reference}/cancel`, {
          reason: 'Customer withdrew',
        })
        .expect(200);
      expect(cancelled.body.status).toBe('cancelled');
      expect(cancelled.body.cancellationReason).toBe('Customer withdrew');
      await sales()
        .post(`/bookings/${body.reference}/cancel`, { reason: 'Again' })
        .expect(409);
    });

    it('hides credit decisions from roles without billing access', async () => {
      const { body } = await sales()
        .post('/bookings', standalone())
        .expect(201);
      const ops = await api(tokens.operations)
        .get(`/bookings/${body.reference}`)
        .expect(200);
      expect(ops.body).not.toHaveProperty('creditChecks');
      const finance = await api(tokens.finance)
        .get(`/bookings/${body.reference}`)
        .expect(200);
      expect(finance.body.creditChecks).toEqual([]);
    });

    it('lists and filters bookings', async () => {
      const { body } = await sales()
        .get(`/bookings?status=cancelled&customerId=${customerId}`)
        .expect(200);
      expect(body.total).toBeGreaterThan(0);
      expect(
        body.items.every((b: { status: string }) => b.status === 'cancelled'),
      ).toBe(true);
    });
  });
});
