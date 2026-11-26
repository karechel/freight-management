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

    it('refuses moving the issue date of a sent quotation after the day it was sent', async () => {
      const { reference } = await newQuotation({
        issueDate: day(-5),
        validUntil: day(30),
      });
      await sales()
        .post(`/quotations/${reference}/status`, {
          status: 'sent',
          // Three days ago, at noon Nairobi time.
          sentAt: `${day(-3)}T12:00:00+03:00`,
          sentTo: 'buyer@example.com',
        })
        .expect(200);

      const later = await sales()
        .patch(`/quotations/${reference}`, { issueDate: day(-2) })
        .expect(400);
      expect(fieldsIn(later.body)).toEqual(['issueDate']);

      // The day it was sent, or earlier, is still allowed.
      const sameDay = await sales()
        .patch(`/quotations/${reference}`, { issueDate: day(-3) })
        .expect(200);
      expect(sameDay.body.issueDate).toBe(day(-3));

      // Drafts were never sent, so only the usual date rules apply.
      const draft = await newQuotation({
        issueDate: day(-5),
        validUntil: day(30),
      });
      await sales()
        .patch(`/quotations/${draft.reference}`, { issueDate: day(0) })
        .expect(200);
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
      // Since 2026-11-27 an accepted, unbooked quotation blocks archiving (§17 question 18), so the
      // archive is set directly, as for a customer archived before that rule.
      await db.orm.public.Party.where({ id: customer.id }).update({
        archivedAt: new Date(),
      });
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

  describe('credit approval: sales books, finance or management approve', () => {
    // Added 2026-11-20 (LOG-20261120-1514-credit-approval). The total is 179000.00 (see above).
    let customer: number;
    const finance = () => api(tokens.finance);
    const management = () => api(tokens.management);
    const operations = () => api(tokens.operations);

    const requested = async () => {
      const reference = await accepted({ customerId: customer });
      const { body } = await sales()
        .post(`/quotations/${reference}/convert`, {
          creditDecision: {
            decision: 'request_approval',
            reason: 'Customer expects payment next week',
          },
        })
        .expect(201);
      return {
        quotation: reference,
        booking: body as { id: number; reference: string },
      };
    };

    beforeAll(async () => {
      customer = (
        await newCustomer('Approval Limited Ltd', { creditLimit: '100000' })
      ).id;
    });

    it('lets sales create a booking over the limit as pending, awaiting approval', async () => {
      const { booking } = await requested();
      const { body } = await sales()
        .get(`/bookings/${booking.reference}`)
        .expect(200);
      expect(body.status).toBe('pending');
      expect(body.creditApproval).toMatchObject({
        state: 'awaiting',
        reason: 'Customer expects payment next week',
        exposure: '0.00',
        creditLimit: '100000.00',
        attemptedAmount: '179000.00',
      });
      expect(body.creditApproval.requestedBy.name).toBe('B. Otieno');
      // No decision yet: CreditCheck rows are decisions, and the approver has not decided.
      expect(
        await db.orm.public.CreditCheck.where({
          bookingId: booking.id,
        }).first(),
      ).toBeNull();
      const request = await db.orm.public.AuditLog.where({
        entityType: 'Booking',
        entityId: booking.id,
        action: 'credit_approval_requested',
      }).first();
      expect(request).not.toBeNull();
    });

    it('refuses confirmation until approved, and approval by staff without credit.override', async () => {
      const { booking } = await requested();
      const confirm = await sales()
        .post(`/bookings/${booking.reference}/confirm`)
        .expect(409);
      expect(confirm.body.message).toMatch(/awaiting credit approval/);
      const decision = { decision: 'approve', reason: 'Fine' };
      await sales()
        .post(`/bookings/${booking.reference}/credit-approval`, decision)
        .expect(403);
      await operations()
        .post(`/bookings/${booking.reference}/credit-approval`, decision)
        .expect(403);
      await api()
        .post(`/bookings/${booking.reference}/credit-approval`, decision)
        .expect(401);
    });

    it('lets finance approve, recording who, when and why; sales can then confirm', async () => {
      const { booking } = await requested();
      const { body } = await finance()
        .post(`/bookings/${booking.reference}/credit-approval`, {
          decision: 'approve',
          reason: 'Approved: payment plan agreed',
        })
        .expect(200);
      expect(body.status).toBe('pending');
      expect(body.creditApproval.state).toBe('approved');
      const check = await db.orm.public.CreditCheck.where({
        bookingId: booking.id,
      }).first();
      const financeUser = await db.orm.public.User.where({
        email: FINANCE,
      }).first();
      expect(check).toMatchObject({
        decision: 'proceed',
        reason: 'Approved: payment plan agreed',
        attemptedAmount: '179000.00',
        decidedById: financeUser!.id,
      });
      const audit = await db.orm.public.AuditLog.where({
        entityType: 'Booking',
        entityId: booking.id,
        action: 'credit_approved',
      }).first();
      expect(audit?.actorUserId).toBe(financeUser!.id);

      const confirmed = await sales()
        .post(`/bookings/${booking.reference}/confirm`)
        .expect(200);
      expect(confirmed.body.status).toBe('confirmed');
      // A decision is final.
      await finance()
        .post(`/bookings/${booking.reference}/credit-approval`, {
          decision: 'reject',
          reason: 'Changed my mind',
        })
        .expect(409);
    });

    it('lets management reject, which cancels the booking', async () => {
      const { quotation, booking } = await requested();
      const { body } = await management()
        .post(`/bookings/${booking.reference}/credit-approval`, {
          decision: 'reject',
          reason: 'Balance too high',
        })
        .expect(200);
      expect(body.status).toBe('cancelled');
      expect(body.cancellationReason).toBe(
        'Credit approval rejected: Balance too high',
      );
      expect(body.creditApproval.state).toBe('rejected');
      const managementUser = await db.orm.public.User.where({
        email: MANAGEMENT,
      }).first();
      const check = await db.orm.public.CreditCheck.where({
        bookingId: booking.id,
      }).first();
      expect(check).toMatchObject({
        decision: 'blocked',
        decidedById: managementUser!.id,
      });
      const q = await sales().get(`/quotations/${quotation}`).expect(200);
      expect(q.body.booking.status).toBe('cancelled');
      await sales().post(`/bookings/${booking.reference}/confirm`).expect(409);
    });

    it('needs a reason, and refuses bookings that never asked for approval', async () => {
      const { booking } = await requested();
      const missing = await finance()
        .post(`/bookings/${booking.reference}/credit-approval`, {
          decision: 'approve',
          reason: ' ',
        })
        .expect(400);
      expect(fieldsIn(missing.body)).toEqual(['reason']);
      const plain = await sales()
        .post('/bookings', {
          customerId,
          mode: 'road',
          direction: 'transit',
          origin: 'Mombasa',
          destination: 'Kigali',
          cargoSummary: 'No approval needed',
        })
        .expect(201);
      expect(plain.body.creditApproval).toBeNull();
      await finance()
        .post(`/bookings/${plain.body.reference}/credit-approval`, {
          decision: 'approve',
          reason: 'Nothing to approve',
        })
        .expect(409);
      await finance()
        .post('/bookings/BKG-0000-0000/credit-approval', {
          decision: 'approve',
          reason: 'Unknown',
        })
        .expect(404);
    });

    it('works for standalone bookings, lists those awaiting approval, and hides figures from roles without billing access', async () => {
      const { body } = await sales()
        .post('/bookings', {
          customerId: customer,
          mode: 'air',
          direction: 'export',
          origin: 'Nairobi',
          destination: 'Dubai',
          cargoSummary: 'Electronics, 3 pallets',
          estimatedValue: '250000',
          creditDecision: {
            decision: 'request_approval',
            reason: 'Urgent shipment',
          },
        })
        .expect(201);
      expect(body.creditApproval).toMatchObject({
        state: 'awaiting',
        attemptedAmount: '250000.00',
      });

      const awaiting = await finance()
        .get(`/bookings?creditApproval=awaiting&customerId=${customer}`)
        .expect(200);
      const listed = awaiting.body.items.map(
        (b: { reference: string }) => b.reference,
      );
      expect(listed).toContain(body.reference);
      expect(
        awaiting.body.items.every(
          (b: { creditApproval: { state: string } | null }) =>
            b.creditApproval?.state === 'awaiting',
        ),
      ).toBe(true);

      const ops = await operations()
        .get(`/bookings/${body.reference}`)
        .expect(200);
      expect(ops.body.creditApproval.state).toBe('awaiting');
      expect(ops.body.creditApproval).not.toHaveProperty('attemptedAmount');
    });

    it('still lets credit.override holders proceed directly, without an approval step', async () => {
      const reference = await accepted({ customerId: customer });
      const { body } = await admin()
        .post(`/quotations/${reference}/convert`, {
          creditDecision: { decision: 'proceed', reason: 'Admin decision' },
        })
        .expect(201);
      expect(body.creditApproval).toBeNull();
      await admin().post(`/bookings/${body.reference}/confirm`).expect(200);
    });
  });

  describe('remaining coverage (Phase 2 audit, LOG-20261120-1436-phase2-audit)', () => {
    it('refuses moving a quotation to an archived customer, and can clear its agent', async () => {
      const { reference } = await newQuotation();
      const archived = await newCustomer('Archived Move Target Ltd');
      await admin().post(`/parties/${archived.id}/archive`).expect(200);
      await sales()
        .patch(`/quotations/${reference}`, { customerId: archived.id })
        .expect(409);
      const cleared = await sales()
        .patch(`/quotations/${reference}`, { agentId: null })
        .expect(200);
      expect(cleared.body.agent).toBeNull();
    });

    it("refuses an inactive charge type and uses an active one's tax category", async () => {
      const [first, second] = await db.orm.public.ChargeType.orderBy((c) =>
        c.id.asc(),
      ).all();
      await db.orm.public.ChargeType.where({ id: first.id }).update({
        isActive: false,
      });
      try {
        const line = {
          description: 'Charge',
          quantity: '1',
          unitPrice: '100',
          taxRate: '0',
        };
        const refused = await sales()
          .post(
            '/quotations',
            quotationBody({ lines: [{ ...line, chargeTypeId: first.id }] }),
          )
          .expect(400);
        expect(fieldsIn(refused.body)).toEqual(['lines.0.chargeTypeId']);
        const { body } = await sales()
          .post(
            '/quotations',
            quotationBody({ lines: [{ ...line, chargeTypeId: second.id }] }),
          )
          .expect(201);
        expect(body.lines[0].taxCategory).toBe(second.defaultTaxCategory);
      } finally {
        await db.orm.public.ChargeType.where({ id: first.id }).update({
          isActive: true,
        });
      }
    });

    it('searches quotations and filters them by agent', async () => {
      const otherAgent = await idOf('Gulf Bridge Logistics');
      const mine = await newQuotation({ agentId: otherAgent });
      const byReference = await sales()
        .get(`/quotations?q=${mine.reference}`)
        .expect(200);
      expect(
        byReference.body.items.map((q: { reference: string }) => q.reference),
      ).toEqual([mine.reference]);
      const byAgent = await sales()
        .get(`/quotations?agentId=${otherAgent}`)
        .expect(200);
      expect(byAgent.body.total).toBeGreaterThan(0);
      expect(
        byAgent.body.items.every(
          (q: { agent: { id: number } | null }) => q.agent?.id === otherAgent,
        ),
      ).toBe(true);
    });

    it('refuses a standalone booking whose agent does not hold the agent role', async () => {
      const { body } = await sales()
        .post('/bookings', {
          customerId,
          agentId: carrierId,
          mode: 'sea',
          direction: 'import',
          origin: 'Jeddah',
          destination: 'Mombasa',
          cargoSummary: 'Agent role check',
        })
        .expect(400);
      expect(fieldsIn(body)).toEqual(['agentId']);
    });

    it('returns 404 for an unknown booking', async () => {
      await sales().get('/bookings/BKG-0000-0000').expect(404);
    });

    it('records exactly one decision when two approvers decide at once', async () => {
      const limited = (
        await newCustomer('Concurrent Approval Ltd', { creditLimit: '100000' })
      ).id;
      const reference = await accepted({ customerId: limited });
      const { body: booking } = await sales()
        .post(`/quotations/${reference}/convert`, {
          creditDecision: { decision: 'request_approval', reason: 'Please' },
        })
        .expect(201);
      const results = await Promise.all([
        api(tokens.finance).post(
          `/bookings/${booking.reference}/credit-approval`,
          { decision: 'approve', reason: 'Finance says yes' },
        ),
        api(tokens.management).post(
          `/bookings/${booking.reference}/credit-approval`,
          { decision: 'reject', reason: 'Management says no' },
        ),
      ]);
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        200, 409,
      ]);
      const checks = await db.orm.public.CreditCheck.where({
        bookingId: booking.id,
      }).all();
      expect(checks).toHaveLength(1);
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
  describe('repository-owner decisions (2026-11-26)', () => {
    const setStatus = (id: number, accountStatus: string) =>
      admin().patch(`/parties/${id}`, { accountStatus }).expect(200);
    const standaloneFor = (id: number) => ({
      customerId: id,
      mode: 'road',
      direction: 'transit',
      origin: 'Mombasa',
      destination: 'Kampala',
      cargoSummary: 'Transit cargo, 1 truck',
    });

    it.each([
      ['on_hold', 'on hold'],
      ['closed', 'closed'],
    ])(
      'blocks new quotations and bookings for %s customers, keeping existing records',
      async (status, words) => {
        const customer = await newCustomer(`Status ${status} Ltd`);
        const existing = await accepted({ customerId: customer.id });
        const draft = await newQuotation({ customerId: customer.id });
        await setStatus(customer.id, status);

        const quote = await sales()
          .post('/quotations', quotationBody({ customerId: customer.id }))
          .expect(409);
        expect(quote.body.message).toContain(words);
        expect(quote.body.message).toContain(
          'new quotations and bookings are blocked',
        );
        expect(fieldsIn(quote.body)).toEqual(['customerId']);
        // Duplicating creates a new quotation for the same customer.
        await sales()
          .post('/quotations', {
            ...quotationBody({ customerId: customer.id }),
            duplicatedFrom: existing,
          })
          .expect(409);
        // Moving another quotation to this customer is new work for them.
        const other = await newQuotation();
        await sales()
          .patch(`/quotations/${other.reference}`, { customerId: customer.id })
          .expect(409);
        await sales().post(`/quotations/${existing}/convert`).expect(409);
        await sales().post('/bookings', standaloneFor(customer.id)).expect(409);

        // Existing records stay readable and say why new work is blocked.
        const view = await api(tokens.operations)
          .get(`/quotations/${existing}`)
          .expect(200);
        expect(view.body.customerNewWorkBlock).toBe(status);
        // Editing an existing quotation without changing its customer is not new work.
        await sales()
          .patch(`/quotations/${draft.reference}`, {
            cargoSummary: 'Still editable',
          })
          .expect(200);

        // Once management makes the account active again, new work is accepted.
        await api(tokens.management)
          .patch(`/parties/${customer.id}`, { accountStatus: 'active' })
          .expect(200);
        const again = await sales().get(`/quotations/${existing}`).expect(200);
        expect(again.body.customerNewWorkBlock).toBeNull();
        await sales().post(`/quotations/${existing}/convert`).expect(201);
      },
    );

    it('refuses archiving while an accepted quotation has no booking (2026-11-27)', async () => {
      const customer = await newCustomer('Accepted Work Ltd');
      const unbooked = await accepted({ customerId: customer.id });
      const draft = await newQuotation({ customerId: customer.id });
      const sent = await newQuotation({ customerId: customer.id });
      await sales()
        .post(`/quotations/${sent.reference}/status`, {
          status: 'sent',
          sentAt: new Date().toISOString(),
          sentTo: 'buyer@example.com',
        })
        .expect(200);
      // An accepted quotation that was booked is not counted, even after its booking is cancelled.
      const booked = await accepted({ customerId: customer.id });
      const booking = (
        await sales().post(`/quotations/${booked}/convert`).expect(201)
      ).body.reference as string;
      await sales()
        .post(`/bookings/${booking}/cancel`, { reason: 'Plans changed' })
        .expect(200);

      const refused = await admin()
        .post(`/parties/${customer.id}/archive`)
        .expect(409);
      expect(refused.body.message).toContain('accepted quotations');
      const [a, b] = [draft.reference, sent.reference].sort();
      expect(refused.body.details).toEqual([
        { field: 'quotations', messages: [`2 open quotations: ${a}, ${b}.`] },
        {
          field: 'acceptedQuotations',
          messages: [`1 accepted quotation not yet booked: ${unbooked}.`],
        },
      ]);

      // Only the accepted quotation left: still refused, then declining it allows archiving.
      for (const reference of [draft.reference, sent.reference]) {
        await db.orm.public.Quotation.where({ reference }).update({
          issueDate: day(-30),
          validUntil: day(-1),
        });
      }
      const onlyAccepted = await admin()
        .post(`/parties/${customer.id}/archive`)
        .expect(409);
      expect(
        onlyAccepted.body.details.map((d: { field: string }) => d.field),
      ).toEqual(['acceptedQuotations']);
      await sales()
        .post(`/quotations/${unbooked}/status`, {
          status: 'declined',
          decidedAt: new Date().toISOString(),
        })
        .expect(200);
      await admin().post(`/parties/${customer.id}/archive`).expect(200);
    });

    it.each([
      ['on_hold', 'on hold'],
      ['closed', 'closed'],
    ])(
      'refuses confirming a pending booking of a %s customer (2026-11-27)',
      async (status, words) => {
        const customer = await newCustomer(`Pending ${status} Ltd`);
        const pending = (
          await sales()
            .post('/bookings', standaloneFor(customer.id))
            .expect(201)
        ).body.reference as string;
        const other = (
          await sales()
            .post('/bookings', standaloneFor(customer.id))
            .expect(201)
        ).body.reference as string;
        await setStatus(customer.id, status);

        const refused = await sales()
          .post(`/bookings/${pending}/confirm`)
          .expect(409);
        expect(refused.body.message).toContain(words);
        expect(refused.body.message).toContain('cannot be confirmed');
        expect(fieldsIn(refused.body)).toEqual(['customerId']);
        const view = await sales().get(`/bookings/${pending}`).expect(200);
        expect(view.body.status).toBe('pending');
        expect(view.body.customerNewWorkBlock).toBe(status);
        // Cancelling is not blocked.
        await sales()
          .post(`/bookings/${other}/cancel`, { reason: 'Customer on hold' })
          .expect(200);

        await setStatus(customer.id, 'active');
        await sales().post(`/bookings/${pending}/confirm`).expect(200);
      },
    );

    it.each([
      ['on_hold', 'on hold'],
      ['closed', 'closed'],
    ])(
      'refuses credit approval for a %s customer, but allows rejection (2026-11-27)',
      async (status, words) => {
        const customer = await newCustomer(`Approval ${status} Ltd`, {
          creditLimit: '1000',
        });
        const request = async () => {
          const reference = await accepted({ customerId: customer.id });
          return (
            await sales()
              .post(`/quotations/${reference}/convert`, {
                creditDecision: {
                  decision: 'request_approval',
                  reason: 'Please approve',
                },
              })
              .expect(201)
          ).body.reference as string;
        };
        const first = await request();
        const second = await request();
        await setStatus(customer.id, status);

        const refused = await api(tokens.finance)
          .post(`/bookings/${first}/credit-approval`, {
            decision: 'approve',
            reason: 'Payment plan agreed',
          })
          .expect(409);
        expect(refused.body.message).toContain(words);
        expect(refused.body.message).toContain('cannot be credit-approved');
        const view = await sales().get(`/bookings/${first}`).expect(200);
        expect(view.body.creditApproval.state).toBe('awaiting');
        // Rejecting is not approval, and cancels the booking as before.
        await api(tokens.management)
          .post(`/bookings/${second}/credit-approval`, {
            decision: 'reject',
            reason: 'Account on hold',
          })
          .expect(200);

        await setStatus(customer.id, 'active');
        await api(tokens.finance)
          .post(`/bookings/${first}/credit-approval`, {
            decision: 'approve',
            reason: 'Account active again',
          })
          .expect(200);
      },
    );

    it('only management and admin change the account status', async () => {
      const customer = await newCustomer('Status Permission Ltd');
      for (const role of ['sales', 'finance', 'operations']) {
        await api(tokens[role])
          .patch(`/parties/${customer.id}`, { accountStatus: 'on_hold' })
          .expect(403);
      }
      await api(tokens.management)
        .patch(`/parties/${customer.id}`, { accountStatus: 'on_hold' })
        .expect(200);
    });

    it('refuses archiving a customer with pending or confirmed bookings or open quotations, naming them', async () => {
      const customer = await newCustomer('Open Work Ltd');
      const open = await newQuotation({ customerId: customer.id });
      const pending = (
        await sales().post('/bookings', standaloneFor(customer.id)).expect(201)
      ).body.reference as string;
      const confirmed = (
        await sales().post('/bookings', standaloneFor(customer.id)).expect(201)
      ).body.reference as string;
      await sales().post(`/bookings/${confirmed}/confirm`).expect(200);
      // Expired quotations are not open work.
      const expired = await newQuotation({ customerId: customer.id });
      await db.orm.public.Quotation.where({
        reference: expired.reference,
      }).update({ issueDate: day(-30), validUntil: day(-1) });

      const refused = await admin()
        .post(`/parties/${customer.id}/archive`)
        .expect(409);
      expect(refused.body.message).toContain('open work');
      const [first, second] = [pending, confirmed].sort();
      expect(refused.body.details).toEqual([
        {
          field: 'bookings',
          messages: [`2 pending or confirmed bookings: ${first}, ${second}.`],
        },
        {
          field: 'quotations',
          messages: [`1 open quotation: ${open.reference}.`],
        },
      ]);
      expect(
        (await db.orm.public.Party.first({ id: customer.id }))!.archivedAt,
      ).toBeNull();

      // Resolving the work allows archiving.
      for (const reference of [pending, confirmed]) {
        await sales()
          .post(`/bookings/${reference}/cancel`, { reason: 'Not needed' })
          .expect(200);
      }
      await sales()
        .post(`/quotations/${open.reference}/status`, {
          status: 'sent',
          sentAt: new Date().toISOString(),
          sentTo: 'buyer@example.com',
        })
        .expect(200);
      await sales()
        .post(`/quotations/${open.reference}/status`, {
          status: 'declined',
          decidedAt: new Date().toISOString(),
        })
        .expect(200);
      await admin().post(`/parties/${customer.id}/archive`).expect(200);
    });

    it('has no booking edit endpoint, pending or confirmed', async () => {
      const pending = (
        await sales().post('/bookings', standaloneFor(customerId)).expect(201)
      ).body.reference as string;
      await sales()
        .patch(`/bookings/${pending}`, { carrierBookingNumber: 'X-1' })
        .expect(404);
      await sales().post(`/bookings/${pending}/confirm`).expect(200);
      await admin()
        .patch(`/bookings/${pending}`, { carrierBookingNumber: 'X-1' })
        .expect(404);
      const booking = await db.orm.public.Booking.where({
        reference: pending,
      }).first();
      expect(booking!.carrierBookingNumber).toBeNull();
    });

    it('keeps the approved permission matrix for quotations, bookings, credit and tax settings', async () => {
      const permissions = await db.orm.public.Permission.all();
      const grants = async (role: string) => {
        const r = await db.orm.public.Role.where({ code: role }).first();
        const links = await db.orm.public.RolePermission.where({
          roleId: r!.id,
        }).all();
        return new Set(
          links.map(
            (l) => permissions.find((p) => p.id === l.permissionId)!.code,
          ),
        );
      };
      const codes = [
        'quotations.view',
        'quotations.manage',
        'credit.override',
        'settings.tax.manage',
      ];
      const expected: Record<string, string[]> = {
        admin: codes,
        sales: ['quotations.view', 'quotations.manage'],
        finance: ['quotations.view', 'credit.override'],
        management: ['quotations.view', 'credit.override'],
        operations: ['quotations.view'],
      };
      for (const [role, wanted] of Object.entries(expected)) {
        const held = await grants(role);
        expect([role, codes.filter((c) => held.has(c))]).toEqual([
          role,
          wanted,
        ]);
      }
    });

    it('records the approver, and sales cannot approve their own request', async () => {
      const limited = await newCustomer('Self Approval Ltd', {
        creditLimit: '1000',
      });
      const reference = await accepted({ customerId: limited.id });
      const booking = await sales()
        .post(`/quotations/${reference}/convert`, {
          creditDecision: {
            decision: 'request_approval',
            reason: 'Please approve',
          },
        })
        .expect(201);
      await sales()
        .post(`/bookings/${booking.body.reference}/credit-approval`, {
          decision: 'approve',
          reason: 'Approving my own booking',
        })
        .expect(403);
      await api(tokens.finance)
        .post(`/bookings/${booking.body.reference}/credit-approval`, {
          decision: 'approve',
          reason: 'Payment plan agreed',
        })
        .expect(200);
      const check = await db.orm.public.CreditCheck.where({
        bookingId: booking.body.id,
      }).first();
      const finance = await db.orm.public.User.where({
        email: FINANCE,
      }).first();
      expect(check!.decidedById).toBe(finance!.id);
    });

    describe('tax settings', () => {
      it('lets only admin list and change charge-type tax settings', async () => {
        for (const role of ['sales', 'finance', 'management', 'operations']) {
          await api(tokens[role]).get('/charge-types/tax-settings').expect(403);
          await api(tokens[role])
            .patch('/charge-types/1/tax', { defaultTaxRate: '16' })
            .expect(403);
        }
        const { body } = await admin()
          .get('/charge-types/tax-settings')
          .expect(200);
        expect(body.length).toBeGreaterThan(0);
        expect(body[0]).toHaveProperty('isActive');
      });

      it('validates the change', async () => {
        const id = (await db.orm.public.ChargeType.first({}))!.id;
        const empty = await admin()
          .patch(`/charge-types/${id}/tax`, {})
          .expect(400);
        expect(fieldsIn(empty.body)).toEqual(['defaultTaxCategory']);
        const high = await admin()
          .patch(`/charge-types/${id}/tax`, { defaultTaxRate: '100.01' })
          .expect(400);
        expect(fieldsIn(high.body)).toEqual(['defaultTaxRate']);
        const shape = await admin()
          .patch(`/charge-types/${id}/tax`, { defaultTaxRate: '-1' })
          .expect(400);
        expect(fieldsIn(shape.body)).toEqual(['defaultTaxRate']);
        const category = await admin()
          .patch(`/charge-types/${id}/tax`, { defaultTaxCategory: 'luxury' })
          .expect(400);
        expect(fieldsIn(category.body)).toEqual(['defaultTaxCategory']);
        await admin()
          .patch('/charge-types/999999/tax', { defaultTaxRate: '1' })
          .expect(404);
      });

      it('changes the defaults for new lines only, and audits the change', async () => {
        const type = (await db.orm.public.ChargeType.where({
          isActive: true,
        }).first())!;
        const saved = await newQuotation({
          lines: [
            {
              chargeTypeId: type.id,
              description: 'Charge with defaults',
              quantity: '1',
              unitPrice: '1000',
              taxRate: type.defaultTaxRate,
            },
          ],
        });
        const before = (await db.orm.public.QuotationLine.where({
          quotationId: saved.id,
        }).first())!;
        const next =
          type.defaultTaxCategory === 'exempt' ? 'standard' : 'exempt';
        const { body } = await admin()
          .patch(`/charge-types/${type.id}/tax`, {
            defaultTaxCategory: next,
            defaultTaxRate: '8.5',
          })
          .expect(200);
        expect(body).toMatchObject({
          defaultTaxCategory: next,
          defaultTaxRate: '8.50',
        });
        await admin()
          .patch(`/charge-types/${type.id}/tax`, { defaultTaxRate: '8.50' })
          .expect(409);

        const listed = await sales().get('/charge-types').expect(200);
        expect(
          listed.body.find((c: { id: number }) => c.id === type.id),
        ).toMatchObject({ defaultTaxCategory: next, defaultTaxRate: '8.50' });
        const after = (await db.orm.public.QuotationLine.where({
          id: before.id,
        }).first())!;
        expect([after.taxCategory, after.taxRate]).toEqual([
          before.taxCategory,
          before.taxRate,
        ]);
        const fresh = await newQuotation({
          lines: [
            {
              chargeTypeId: type.id,
              description: 'Charge with new defaults',
              quantity: '1',
              unitPrice: '1000',
              taxRate: '8.5',
            },
          ],
        });
        const line = (await db.orm.public.QuotationLine.where({
          quotationId: fresh.id,
        }).first())!;
        expect(line.taxCategory).toBe(next);

        const audit = await db.orm.public.AuditLog.where({
          entityType: 'ChargeType',
          entityId: type.id,
        }).all();
        expect(audit.map((a) => a.action)).toEqual(['tax_update']);
        expect(audit[0].changes).toEqual({
          before: {
            defaultTaxCategory: type.defaultTaxCategory,
            defaultTaxRate: type.defaultTaxRate,
          },
          after: { defaultTaxCategory: next, defaultTaxRate: '8.50' },
        });

        // Put the seeded values back for later tests.
        await admin()
          .patch(`/charge-types/${type.id}/tax`, {
            defaultTaxCategory: type.defaultTaxCategory,
            defaultTaxRate: type.defaultTaxRate,
          })
          .expect(200);
      });
    });
  });
});
