import { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { db } from '../src/prisma/db.js';
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

const DAY = 24 * 60 * 60 * 1000;
/** An ISO time `days` from now (negative for the past). */
const when = (days: number) => new Date(Date.now() + days * DAY).toISOString();

interface Milestone {
  id: number;
  label: string;
  state: string;
  actualAt: string | null;
  plannedAt: string | null;
}
interface Issue {
  id: number;
  status: string;
  actions: { note: string; automatic: boolean }[];
}
interface ShipmentView {
  reference: string;
  status: string;
  booking: { reference: string } | null;
  customer: { id: number; name: string };
  carrier: { id: number } | null;
  agent: { id: number } | null;
  assignedTo: { id: number } | null;
  origin: string;
  cargoDescription: string;
  etd: string | null;
  eta: string | null;
  atd: string | null;
  ata: string | null;
  deliveredAt: string | null;
  currentEta: { at: string | null; revised: boolean };
  needsAttention: boolean;
  milestones: Milestone[];
  issues: Issue[];
  containers: { id: number; containerNumber: string }[];
  history: { action: string; summary: string; actor: string }[];
}

describe('Shipments and tracking (e2e)', () => {
  let app: INestApplication<Server>;
  const tokens: Record<string, string> = {};
  let customerId: number;
  let agentId: number;
  let carrierId: number;
  let operationsUserId: number;

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
      delete: (path: string) => withAuth(agent.delete(`/api${path}`)),
    };
  };
  const admin = () => api(tokens.admin);
  const ops = () => api(tokens.operations);

  const fieldsIn = (body: { details: { field: string }[] }) =>
    body.details.map((problem) => problem.field);

  const idOf = async (name: string) =>
    (await db.orm.public.Party.where({ name }).first())!.id;

  const newCustomer = async (name: string, extra: object = {}) =>
    (
      await admin()
        .post('/parties', { name, roles: ['customer'], ...extra })
        .expect(201)
    ).body as { id: number };

  /** A confirmed standalone booking for a customer without a credit limit. */
  const confirmedBooking = async (forCustomer = customerId) => {
    const booking = (
      await admin()
        .post('/bookings', {
          customerId: forCustomer,
          agentId,
          carrierId,
          mode: 'sea',
          direction: 'import',
          origin: 'Shanghai',
          destination: 'Mombasa',
          cargoSummary: '2 × 40ft HC, machine parts',
          plannedEtd: when(2),
          plannedEta: when(20),
        })
        .expect(201)
    ).body as { reference: string };
    await admin().post(`/bookings/${booking.reference}/confirm`).expect(200);
    return booking.reference;
  };

  const standalone = (extra: object = {}) => ({
    customerId,
    mode: 'road',
    direction: 'import',
    origin: 'Mombasa',
    destination: 'Nairobi ICD',
    cargoDescription: 'Clearing only: 1 × 20ft, electrical goods',
    eta: when(3),
    ...extra,
  });

  const newShipment = async (extra: object = {}) =>
    (await ops().post('/shipments', standalone(extra)).expect(201))
      .body as ShipmentView;

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
    customerId = (await newCustomer('Shipment Test Traders Ltd')).id;
    agentId = await idOf('Eastgate Forwarding (Shanghai)');
    carrierId = await idOf('Indigo Ocean Lines');
    operationsUserId = (await db.orm.public.User.where({
      email: OPERATIONS,
    }).first())!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('access', () => {
    it('refuses callers who are not signed in', async () => {
      await api().get('/shipments').expect(401);
    });

    it('lets every staff role read, and only operations and admin write', async () => {
      for (const role of [
        'operations',
        'finance',
        'management',
        'sales',
        'admin',
      ]) {
        await api(tokens[role]).get('/shipments').expect(200);
        await api(tokens[role]).get('/shipments/options/staff').expect(200);
      }
      for (const role of ['sales', 'finance', 'management']) {
        await api(tokens[role]).post('/shipments', standalone()).expect(403);
      }
      const shipment = await newShipment();
      for (const role of ['sales', 'finance', 'management']) {
        await api(tokens[role])
          .post(`/shipments/${shipment.reference}/status`, {
            status: 'on_hold',
          })
          .expect(403);
        await api(tokens[role])
          .patch(`/shipments/${shipment.reference}`, { equipment: 'Tilt' })
          .expect(403);
      }
      await admin()
        .patch(`/shipments/${shipment.reference}`, { equipment: 'Flatbed' })
        .expect(200);
    });

    it('answers 404 for an unknown shipment', async () => {
      await ops().get('/shipments/FMS-SEA-0000-0000').expect(404);
    });
  });

  describe('creating shipments', () => {
    it('creates a standalone job with a configured reference and default milestones', async () => {
      const s = await newShipment({ assignedToId: operationsUserId });
      expect(s.reference).toMatch(/^FMS-ROAD-\d{4}-\d{4}$/);
      expect(s.status).toBe('booked');
      expect(s.booking).toBeNull();
      expect(s.assignedTo?.id).toBe(operationsUserId);
      expect(s.milestones.map((m) => [m.label, m.state])).toEqual([
        ['Job opened', 'done'],
        ['Departed origin', 'current'],
        ['Arrived Nairobi ICD', 'pending'],
        ['Customs clearance', 'pending'],
        ['Released', 'pending'],
        ['Delivered', 'pending'],
      ]);
      expect(s.history.map((h) => h.action)).toEqual(['create']);
    });

    it('creates shipments from a confirmed booking, copying its details', async () => {
      const booking = await confirmedBooking();
      const first = (
        await ops()
          .post('/shipments', { bookingReference: booking })
          .expect(201)
      ).body as ShipmentView;
      expect(first.reference).toMatch(/^FMS-SEA-/);
      expect(first.booking?.reference).toBe(booking);
      expect(first.customer.id).toBe(customerId);
      expect(first.carrier?.id).toBe(carrierId);
      expect(first.agent?.id).toBe(agentId);
      expect(first.cargoDescription).toBe('2 × 40ft HC, machine parts');
      expect(first.etd).not.toBeNull();
      expect(first.milestones[0].label).toBe('Booking confirmed');
      // A booking may have several shipments, with their own cargo.
      const second = (
        await ops()
          .post('/shipments', {
            bookingReference: booking,
            cargoDescription: 'Second container',
          })
          .expect(201)
      ).body as ShipmentView;
      expect(second.cargoDescription).toBe('Second container');
      const view = (await ops().get(`/bookings/${booking}`).expect(200))
        .body as {
        shipments: { reference: string }[];
      };
      expect(view.shipments.map((s) => s.reference)).toEqual([
        first.reference,
        second.reference,
      ]);
      const listed = (
        await ops().get(`/shipments?bookingReference=${booking}`).expect(200)
      ).body as { total: number };
      expect(listed.total).toBe(2);
    });

    it('refuses bookings that are not confirmed, or whose details differ', async () => {
      const pending = (
        await admin()
          .post('/bookings', {
            customerId,
            mode: 'air',
            direction: 'export',
            origin: 'Nairobi JKIA',
            destination: 'Amsterdam',
            cargoSummary: 'Cut flowers',
          })
          .expect(201)
      ).body as { reference: string };
      const refused = await ops()
        .post('/shipments', { bookingReference: pending.reference })
        .expect(409);
      expect(refused.body.message).toMatch(/Only confirmed bookings/);
      const booking = await confirmedBooking();
      const differs = await ops()
        .post('/shipments', { bookingReference: booking, mode: 'air' })
        .expect(400);
      expect(fieldsIn(differs.body)).toEqual(['mode']);
      const unknown = await ops()
        .post('/shipments', { bookingReference: 'BKG-0000-0000' })
        .expect(400);
      expect(fieldsIn(unknown.body)).toEqual(['bookingReference']);
    });

    it('refuses a booking with shipments being cancelled', async () => {
      const booking = await confirmedBooking();
      const s = (
        await ops()
          .post('/shipments', { bookingReference: booking })
          .expect(201)
      ).body as ShipmentView;
      const refused = await admin()
        .post(`/bookings/${booking}/cancel`, {
          reason: 'Customer changed plans',
        })
        .expect(409);
      expect(refused.body.details[0].messages).toEqual([s.reference]);
    });

    it('validates standalone jobs', async () => {
      const missing = await ops().post('/shipments', {}).expect(400);
      expect(fieldsIn(missing.body)).toEqual([
        'customerId',
        'mode',
        'direction',
        'origin',
        'destination',
        'cargoDescription',
      ]);
      const noEta = await ops()
        .post('/shipments', standalone({ eta: undefined }))
        .expect(400);
      expect(fieldsIn(noEta.body)).toEqual(['eta']);
      const withEta = await newShipment();
      const clearEta = await ops()
        .patch(`/shipments/${withEta.reference}`, { eta: null })
        .expect(400);
      expect(fieldsIn(clearEta.body)).toEqual(['eta']);
      const same = await ops()
        .post('/shipments', standalone({ destination: 'mombasa' }))
        .expect(400);
      expect(fieldsIn(same.body)).toEqual(['destination']);
      const dates = await ops()
        .post('/shipments', standalone({ etd: when(5), eta: when(3) }))
        .expect(400);
      expect(fieldsIn(dates.body)).toEqual(['eta']);
      const wrongRole = await ops()
        .post('/shipments', standalone({ carrierId: agentId }))
        .expect(400);
      expect(fieldsIn(wrongRole.body)).toEqual(['carrierId']);
      const notStaff = await ops()
        .post('/shipments', standalone({ assignedToId: 999999 }))
        .expect(400);
      expect(fieldsIn(notStaff.body)).toEqual(['assignedToId']);
    });

    it('refuses new standalone jobs for archived, on-hold and closed customers', async () => {
      const held = await newCustomer('Held Shipment Ltd', {
        accountStatus: 'on_hold',
      });
      const closed = await newCustomer('Closed Shipment Ltd', {
        accountStatus: 'closed',
      });
      for (const id of [held.id, closed.id]) {
        const refused = await ops()
          .post('/shipments', standalone({ customerId: id }))
          .expect(409);
        expect(refused.body.message).toMatch(/new work is blocked/);
      }
      const archivedCustomer = await newCustomer('Archived Shipment Ltd');
      const booking = await confirmedBooking(archivedCustomer.id);
      await db.orm.public.Party.where({ id: archivedCustomer.id }).update({
        archivedAt: new Date(),
      });
      const fromBooking = await ops()
        .post('/shipments', { bookingReference: booking })
        .expect(409);
      expect(fromBooking.body.message).toMatch(/archived/);
      await ops()
        .post('/shipments', standalone({ customerId: archivedCustomer.id }))
        .expect(409);
    });
  });

  describe('repository-owner decisions (2026-11-27)', () => {
    const setStatus = (id: number, accountStatus: string) =>
      admin().patch(`/parties/${id}`, { accountStatus }).expect(200);
    const deliver = (reference: string) =>
      ops().post(`/shipments/${reference}/status`, {
        status: 'delivered',
        deliveredAt: when(0),
      });
    const bookingOf = async (reference: string) =>
      (await admin().get(`/bookings/${reference}`).expect(200)).body as {
        id: number;
        status: string;
      };
    const completions = async (bookingId: number) =>
      (
        await db.orm.public.AuditLog.where({
          entityType: 'Booking',
          entityId: bookingId,
          action: 'complete',
        }).all()
      ).length;
    const shipmentFrom = async (booking: string) =>
      (
        await ops()
          .post('/shipments', { bookingReference: booking })
          .expect(201)
      ).body as ShipmentView;

    it.each([
      ['on_hold', 'on hold'],
      ['closed', 'closed'],
    ])(
      'refuses a shipment from a confirmed booking of a %s customer (question 19)',
      async (status, words) => {
        const customer = await newCustomer(`Booking Hold ${status} Ltd`);
        const booking = await confirmedBooking(customer.id);
        await setStatus(customer.id, status);
        const refused = await ops()
          .post('/shipments', { bookingReference: booking })
          .expect(409);
        expect(refused.body.message).toContain(words);
        expect(refused.body.message).toContain('new shipment');
        expect(fieldsIn(refused.body)).toEqual(['bookingReference']);
        await setStatus(customer.id, 'active');
        await shipmentFrom(booking);
      },
    );

    it('completes a booking when its only shipment is delivered (question 20)', async () => {
      const booking = await confirmedBooking();
      const s = await shipmentFrom(booking);
      expect((await bookingOf(booking)).status).toBe('confirmed');
      await deliver(s.reference).expect(200);
      const after = await bookingOf(booking);
      expect(after.status).toBe('completed');
      expect(await completions(after.id)).toBe(1);
      // Repeating the delivery is refused (delivered is final) and changes nothing.
      await deliver(s.reference).expect(409);
      expect((await bookingOf(booking)).status).toBe('completed');
      expect(await completions(after.id)).toBe(1);
      // A completed booking is no longer cancellable and takes no new shipments.
      await admin()
        .post(`/bookings/${booking}/cancel`, { reason: 'Too late' })
        .expect(409);
      await ops().post('/shipments', { bookingReference: booking }).expect(409);
      // The shipment's own history is kept.
      const view = (await ops().get(`/shipments/${s.reference}`).expect(200))
        .body as ShipmentView;
      expect(view.history.map((h) => h.action)).toEqual([
        'create',
        'status_change',
      ]);
    });

    it('waits until every shipment of the booking is delivered', async () => {
      const booking = await confirmedBooking();
      const first = await shipmentFrom(booking);
      const second = await shipmentFrom(booking);
      const third = await shipmentFrom(booking);
      await deliver(first.reference).expect(200);
      await ops()
        .post(`/shipments/${second.reference}/status`, { status: 'in_transit' })
        .expect(200);
      expect((await bookingOf(booking)).status).toBe('confirmed');
      await deliver(second.reference).expect(200);
      expect((await bookingOf(booking)).status).toBe('confirmed');
      await deliver(third.reference).expect(200);
      const after = await bookingOf(booking);
      expect(after.status).toBe('completed');
      expect(await completions(after.id)).toBe(1);
    });

    it('completes the booking exactly once when its shipments are delivered at the same time', async () => {
      const booking = await confirmedBooking();
      const shipments = [
        await shipmentFrom(booking),
        await shipmentFrom(booking),
        await shipmentFrom(booking),
      ];
      const results = await Promise.all(
        shipments.map((s) => deliver(s.reference)),
      );
      expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
      const after = await bookingOf(booking);
      expect(after.status).toBe('completed');
      expect(await completions(after.id)).toBe(1);
    });

    it('never completes a booking without shipments, or through another booking', async () => {
      const empty = await confirmedBooking();
      const other = await confirmedBooking();
      const s = await shipmentFrom(other);
      await deliver(s.reference).expect(200);
      expect((await bookingOf(empty)).status).toBe('confirmed');
      expect((await bookingOf(other)).status).toBe('completed');
      // A standalone shipment has no booking to complete.
      const standaloneJob = await newShipment();
      await deliver(standaloneJob.reference).expect(200);
    });
  });

  describe('status and dates', () => {
    it('records departure, arrival and delivery, completing their milestones', async () => {
      const s = await newShipment();
      const path = `/shipments/${s.reference}`;
      const inTransit = (
        await ops()
          .post(`${path}/status`, { status: 'in_transit', atd: when(-3) })
          .expect(200)
      ).body as ShipmentView;
      expect(inTransit.status).toBe('in_transit');
      expect(
        inTransit.milestones.find((m) => m.label === 'Departed origin')!.state,
      ).toBe('done');

      const noAta = await ops()
        .post(`${path}/status`, { status: 'arrived' })
        .expect(400);
      expect(fieldsIn(noAta.body)).toEqual(['ata']);
      const early = await ops()
        .post(`${path}/status`, { status: 'arrived', ata: when(-4) })
        .expect(400);
      expect(fieldsIn(early.body)).toEqual(['ata']);
      const future = await ops()
        .post(`${path}/status`, { status: 'arrived', ata: when(1) })
        .expect(400);
      expect(fieldsIn(future.body)).toEqual(['ata']);
      await ops()
        .post(`${path}/status`, { status: 'arrived', ata: when(-1) })
        .expect(200);

      const noDelivery = await ops()
        .post(`${path}/status`, { status: 'delivered' })
        .expect(400);
      expect(fieldsIn(noDelivery.body)).toEqual(['deliveredAt']);
      const delivered = (
        await ops()
          .post(`${path}/status`, {
            status: 'delivered',
            deliveredAt: when(0),
            note: 'Signed for by the stores clerk',
          })
          .expect(200)
      ).body as ShipmentView;
      expect(delivered.deliveredAt).not.toBeNull();
      expect(delivered.milestones.every((m) => m.state === 'done')).toBe(true);
      expect(delivered.history.at(-1)!.summary).toMatch(
        /to "Delivered"\. Note: Signed for/,
      );
      // Delivered is final.
      await ops().post(`${path}/status`, { status: 'released' }).expect(409);
      await ops().post(`${path}/status`, { status: 'delivered' }).expect(409);
    });

    it('edits details and estimates, syncing planned milestone dates', async () => {
      const s = await newShipment();
      const path = `/shipments/${s.reference}`;
      const eta = when(10);
      const updated = (
        await ops()
          .patch(path, {
            eta,
            transportDocRef: 'CMR-4471',
            packages: 12,
            grossWeightKg: '1520.5',
            carrierId,
          })
          .expect(200)
      ).body as ShipmentView & { packages: number; grossWeightKg: string };
      expect(updated.packages).toBe(12);
      expect(updated.grossWeightKg).toBe('1520.500');
      expect(
        updated.milestones.find((m) => m.label.startsWith('Arrived'))!
          .plannedAt,
      ).toBe(eta);
      expect(updated.history.at(-1)!.summary).toMatch(/Details updated/);
      // Nothing changed: no new history entry.
      const again = (await ops().patch(path, { packages: 12 }).expect(200))
        .body as ShipmentView;
      expect(again.history.length).toBe(updated.history.length);
      const cleared = await ops()
        .patch(path, { cargoDescription: '' })
        .expect(400);
      expect(fieldsIn(cleared.body)).toEqual(['cargoDescription']);
    });

    it('records milestone times in order, and leaves delivery to the status change', async () => {
      const s = await newShipment();
      const path = `/shipments/${s.reference}`;
      const departed = s.milestones.find((m) => m.label === 'Departed origin')!;
      const delivered = s.milestones.find((m) => m.label === 'Delivered')!;
      const customs = s.milestones.find(
        (m) => m.label === 'Customs clearance',
      )!;
      const done = (
        await ops()
          .patch(`${path}/milestones/${departed.id}`, { actualAt: when(-2) })
          .expect(200)
      ).body as ShipmentView;
      expect(done.atd).not.toBeNull();
      const future = await ops()
        .patch(`${path}/milestones/${customs.id}`, { actualAt: when(1) })
        .expect(400);
      expect(fieldsIn(future.body)).toEqual(['actualAt']);
      await ops()
        .patch(`${path}/milestones/${customs.id}`, {
          actualAt: when(-1),
          note: 'Entry passed',
        })
        .expect(200);
      const clearEarlier = await ops()
        .patch(`${path}/milestones/${departed.id}`, { actualAt: null })
        .expect(400);
      expect(clearEarlier.body.details[0].messages[0]).toMatch(
        /later milestone/,
      );
      await ops()
        .patch(`${path}/milestones/${delivered.id}`, { actualAt: when(0) })
        .expect(409);
      await ops().patch(`${path}/milestones/999999`, { note: 'x' }).expect(404);
    });
  });

  describe('delays and issues', () => {
    it('records a delay that revises the ETA, then resolves it', async () => {
      const s = await newShipment({ assignedToId: operationsUserId });
      const path = `/shipments/${s.reference}`;
      const revised = when(9);
      const withDelay = (
        await ops()
          .post(`${path}/issues`, {
            type: 'delay',
            severity: 'high',
            reason: 'port_congestion',
            reasonDetail: 'Vessel waiting at anchorage',
            identifiedAt: when(-1),
            originalExpectedAt: s.eta,
            revisedExpectedAt: revised,
            affectsEta: true,
          })
          .expect(201)
      ).body as ShipmentView;
      expect(withDelay.currentEta).toEqual({ at: revised, revised: true });
      expect(withDelay.needsAttention).toBe(true);
      const issue = withDelay.issues[0];
      expect(issue.status).toBe('open');

      const delayed = (
        await ops().get('/shipments?view=delayed&limit=200').expect(200)
      ).body as {
        items: { reference: string }[];
        counts: Record<string, number>;
      };
      expect(delayed.items.map((i) => i.reference)).toContain(s.reference);
      expect(delayed.counts.delayed).toBeGreaterThan(0);

      await ops()
        .post(`${path}/issues/${issue.id}/actions`, {
          note: 'Called the shipping line',
        })
        .expect(201);
      const noTime = await ops()
        .patch(`${path}/issues/${issue.id}`, { status: 'resolved' })
        .expect(400);
      expect(fieldsIn(noTime.body)).toEqual(['resolvedAt']);
      const resolved = (
        await ops()
          .patch(`${path}/issues/${issue.id}`, {
            status: 'resolved',
            resolvedAt: when(0),
            resolution: 'Berthed',
            customerNotification: 'informed_manually',
            customerNotifiedAt: when(0),
          })
          .expect(200)
      ).body as ShipmentView;
      expect(resolved.issues[0].status).toBe('resolved');
      expect(resolved.issues[0].actions.map((a) => a.automatic)).toEqual([
        true,
        false,
        true,
      ]);
      // The approved plan: the current ETA comes from open delays only.
      expect(resolved.currentEta.revised).toBe(false);
      expect(resolved.needsAttention).toBe(false);
    });

    it('validates delays and other issues', async () => {
      const s = await newShipment();
      const path = `/shipments/${s.reference}`;
      const missing = await ops()
        .post(`${path}/issues`, { type: 'delay' })
        .expect(400);
      expect(fieldsIn(missing.body)).toEqual([
        'severity',
        'reasonDetail',
        'identifiedAt',
      ]);
      const delay = await ops()
        .post(`${path}/issues`, {
          type: 'delay',
          severity: 'low',
          reasonDetail: 'x',
          identifiedAt: when(-1),
        })
        .expect(400);
      expect(fieldsIn(delay.body)).toEqual(['reason', 'originalExpectedAt']);
      const damage = (
        await ops()
          .post(`${path}/issues`, {
            type: 'damage',
            severity: 'medium',
            reasonDetail: 'Two cartons crushed',
            identifiedAt: when(0),
          })
          .expect(201)
      ).body as ShipmentView;
      expect(damage.needsAttention).toBe(true);
      expect(damage.currentEta.revised).toBe(false);
      const otherShipment = await newShipment();
      await ops()
        .post(`${path}/issues`, {
          type: 'other',
          severity: 'low',
          reasonDetail: 'x',
          identifiedAt: when(0),
          affectedMilestoneId: otherShipment.milestones[0].id,
        })
        .expect(400);
      await ops()
        .patch(
          `/shipments/${otherShipment.reference}/issues/${damage.issues[0].id}`,
          {
            status: 'monitoring',
          },
        )
        .expect(404);
    });
  });

  describe('delay notes and corrections', () => {
    it('keeps notes, corrects severity and description, and refuses a blank description', async () => {
      const s = await newShipment();
      const path = `/shipments/${s.reference}`;
      const created = (
        await ops()
          .post(`${path}/issues`, {
            type: 'delay',
            severity: 'low',
            reason: 'weather',
            reasonDetail: 'Storm at the port',
            identifiedAt: when(-1),
            originalExpectedAt: s.eta,
            notes: 'Harbour master expects 24 hours',
          })
          .expect(201)
      ).body as ShipmentView & {
        issues: {
          id: number;
          notes: string | null;
          severity: string;
          reasonDetail: string;
        }[];
      };
      const issue = created.issues[0];
      expect(issue.notes).toBe('Harbour master expects 24 hours');
      const updated = (
        await ops()
          .patch(`${path}/issues/${issue.id}`, {
            severity: 'high',
            reasonDetail: 'Storm closed the port',
            notes: 'Port closed for 48 hours',
          })
          .expect(200)
      ).body as typeof created;
      expect(updated.issues[0]).toMatchObject({
        severity: 'high',
        reasonDetail: 'Storm closed the port',
        notes: 'Port closed for 48 hours',
      });
      expect(updated.history.at(-1)!.summary).toMatch(
        /Severity changed from low to high/,
      );
      const blank = await ops()
        .patch(`${path}/issues/${issue.id}`, { reasonDetail: '  ' })
        .expect(400);
      expect(fieldsIn(blank.body)).toEqual(['reasonDetail']);
      const future = await ops()
        .post(`${path}/issues/${issue.id}/actions`, {
          note: 'Too early',
          at: when(1),
        })
        .expect(400);
      expect(fieldsIn(future.body)).toEqual(['at']);
    });
  });

  describe('containers', () => {
    it('adds containers in the ISO format and removes them', async () => {
      const booking = await confirmedBooking();
      const s = (
        await ops()
          .post('/shipments', { bookingReference: booking })
          .expect(201)
      ).body as ShipmentView;
      const path = `/shipments/${s.reference}`;
      const added = (
        await ops()
          .post(`${path}/containers`, {
            containerNumber: 'mscu 1234567',
            type: 'high_cube_40',
            sealNumber: 'SL-99',
          })
          .expect(201)
      ).body as ShipmentView;
      expect(added.containers.map((c) => c.containerNumber)).toEqual([
        'MSCU1234567',
      ]);
      await ops()
        .post(`${path}/containers`, {
          containerNumber: 'MSCU1234567',
          type: 'dry_40',
        })
        .expect(409);
      const bad = await ops()
        .post(`${path}/containers`, {
          containerNumber: 'ABC123',
          type: 'dry_20',
        })
        .expect(400);
      expect(fieldsIn(bad.body)).toEqual(['containerNumber']);
      const removed = (
        await ops()
          .delete(`${path}/containers/${added.containers[0].id}`)
          .expect(200)
      ).body as ShipmentView;
      expect(removed.containers).toEqual([]);
      expect(removed.history.map((h) => h.action)).toEqual([
        'create',
        'container_add',
        'container_remove',
      ]);
    });
  });

  describe('views', () => {
    it('filters by view, mode, customer and search, with counts per view', async () => {
      const viewsCustomer = await newCustomer('Views Test Imports Ltd');
      const arriving = await newShipment({
        customerId: viewsCustomer.id,
        mode: 'air',
        origin: 'Dubai',
        destination: 'Nairobi JKIA',
        eta: when(2),
      });
      const later = await newShipment({
        customerId: viewsCustomer.id,
        eta: when(30),
      });
      const held = await newShipment({ customerId: viewsCustomer.id });
      await ops()
        .post(`/shipments/${held.reference}/status`, { status: 'on_hold' })
        .expect(200);
      await ops()
        .post(`/shipments/${later.reference}/status`, { status: 'customs' })
        .expect(200);

      const list = async (query: string) =>
        (
          await ops()
            .get(`/shipments?customerId=${viewsCustomer.id}&${query}`)
            .expect(200)
        ).body as {
          items: { reference: string }[];
          total: number;
          counts: Record<string, number>;
        };

      const all = await list('view=all');
      expect(all.total).toBe(3);
      expect(all.counts).toEqual({
        all: 3,
        active: 3,
        attention: 1,
        delayed: 0,
        arriving: 1,
        customs: 1,
      });
      expect(
        (await list('view=arriving')).items.map((i) => i.reference),
      ).toEqual([arriving.reference]);
      expect(
        (await list('view=attention')).items.map((i) => i.reference),
      ).toEqual([held.reference]);
      expect(
        (await list('view=customs')).items.map((i) => i.reference),
      ).toEqual([later.reference]);
      expect((await list('mode=air')).total).toBe(1);
      expect((await list('q=dubai')).total).toBe(1);
      expect((await list('status=on_hold')).total).toBe(1);
      const paged = await list('limit=2&offset=2');
      expect(paged.items).toHaveLength(1);
      expect(paged.total).toBe(3);
    });

    it('blocks archiving a customer with an undelivered shipment', async () => {
      const customer = await newCustomer('Archive Shipment Check Ltd');
      const s = await newShipment({ customerId: customer.id });
      const refused = await admin()
        .post(`/parties/${customer.id}/archive`)
        .expect(409);
      expect(JSON.stringify(refused.body.details)).toContain(s.reference);
    });
  });
});
