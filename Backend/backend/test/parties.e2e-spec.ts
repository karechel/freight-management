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
const BAOBAB = 'Baobab Crest Traders Ltd';

describe('Customers and contacts (e2e)', () => {
  let app: INestApplication<Server>;
  const tokens: Record<string, string> = {};

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
  const sales = () => api(tokens.sales);
  const finance = () => api(tokens.finance);
  const operations = () => api(tokens.operations);

  const fieldsIn = (body: { details: { field: string }[] }) =>
    body.details.map((problem) => problem.field);

  const newCustomer = async (name: string, extra: object = {}) =>
    (
      await admin()
        .post('/parties', { name, roles: ['customer'], ...extra })
        .expect(201)
    ).body as { id: number };

  const idOf = async (name: string) =>
    (await db.orm.public.Party.where({ name }).first())!.id;

  const lastAudit = (entityType: string, entityId: number) =>
    db.orm.public.AuditLog.where({ entityType, entityId })
      .orderBy((a) => a.id.desc())
      .first();

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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('access', () => {
    it('refuses anonymous callers on every route', async () => {
      const id = await idOf(BAOBAB);
      await api().get('/parties').expect(401);
      await api().get(`/parties/${id}`).expect(401);
      await api()
        .post('/parties', { name: 'X', roles: ['customer'] })
        .expect(401);
      await api().patch(`/parties/${id}`, { name: 'X' }).expect(401);
      await api().post(`/parties/${id}/archive`).expect(401);
      await api().post(`/parties/${id}/contacts`, { name: 'X' }).expect(401);
    });

    it('refuses operations and finance from creating customers', async () => {
      const body = { name: 'Refused Ltd', roles: ['customer'] };
      await operations().post('/parties', body).expect(403);
      await finance().post('/parties', body).expect(403);
      expect(
        await db.orm.public.Party.where({ name: 'Refused Ltd' }).first(),
      ).toBeNull();
    });

    it('refuses operations from editing, archiving and changing contacts', async () => {
      const id = await idOf(BAOBAB);
      await operations().patch(`/parties/${id}`, { city: 'Thika' }).expect(403);
      await operations()
        .patch(`/parties/${id}`, { paymentTermsDays: 7 })
        .expect(403);
      await operations().post(`/parties/${id}/archive`).expect(403);
      await operations()
        .post(`/parties/${id}/contacts`, { name: 'X' })
        .expect(403);
    });

    it('shows billing only to callers allowed to view it', async () => {
      const id = await idOf(BAOBAB);
      const withBilling = await finance().get(`/parties/${id}`).expect(200);
      expect(withBilling.body.billing).toMatchObject({
        paymentTermsDays: 14,
        creditLimit: null,
      });

      const without = await operations().get(`/parties/${id}`).expect(200);
      expect(without.body).not.toHaveProperty('billing');
      expect(JSON.stringify(without.body)).not.toContain('paymentTermsDays');
      expect(JSON.stringify(without.body)).not.toContain('creditLimit');

      const list = await operations().get('/parties?role=customer').expect(200);
      expect(list.body.items[0]).not.toHaveProperty('billing');
      expect(list.body.items[0].shipments).toEqual({ active: 0, total: 0 });
    });
  });

  describe('listing', () => {
    it('filters by role, sorts by name and pages with a total', async () => {
      const first = await admin()
        .get('/parties?role=customer&limit=2')
        .expect(200);
      expect(first.body.total).toBeGreaterThanOrEqual(6);
      expect(first.body.items).toHaveLength(2);
      expect(first.body.items[0].name).toBe(BAOBAB);
      expect(first.body.items[0].primaryContact).toMatchObject({
        name: 'J. Kamau',
        isPrimary: true,
      });

      const second = await admin()
        .get('/parties?role=customer&limit=2&offset=2')
        .expect(200);
      expect(second.body.items[0].id).not.toBe(first.body.items[0].id);

      const agents = await admin().get('/parties?role=agent').expect(200);
      expect(agents.body.total).toBe(3);
      for (const party of agents.body.items) {
        expect(party.roles).toContain('agent');
      }
    });

    it('keeps the total on a page past the end', async () => {
      const { body } = await admin()
        .get('/parties?role=agent&offset=500')
        .expect(200);
      expect(body).toEqual({ items: [], total: 3 });
    });

    it('searches company fields and contacts, ignoring case', async () => {
      const search = async (q: string) =>
        (
          await admin()
            .get(`/parties?q=${encodeURIComponent(q)}`)
            .expect(200)
        ).body.items.map((party: { name: string }) => party.name);
      expect(await search('baobab')).toEqual([BAOBAB]);
      expect(await search('MLIMAFRESH.example')).toEqual([
        'Mlima Fresh Exports Ltd',
      ]);
      expect(await search('j. kamau')).toEqual([BAOBAB]);
      expect(await search('Eldoret')).toEqual(['Simba Line Textiles Ltd']);
      expect(await search('nothing-matches-this')).toEqual([]);
    });

    it('treats search wildcards as ordinary characters', async () => {
      await newCustomer('Hundred 100% Ltd');
      const percent = await admin().get('/parties?q=100%25').expect(200);
      expect(percent.body.items.map((p: { name: string }) => p.name)).toEqual([
        'Hundred 100% Ltd',
      ]);
      const underscore = await admin().get('/parties?q=_').expect(200);
      expect(underscore.body.total).toBe(0);
    });

    it('filters by account status', async () => {
      const { id } = await newCustomer('On Hold Traders', {
        accountStatus: 'on_hold',
      });
      const { body } = await admin().get('/parties?status=on_hold').expect(200);
      expect(body.items.map((p: { id: number }) => p.id)).toEqual([id]);
    });

    it.each([
      ['role=king', 'role'],
      ['status=frozen', 'status'],
      ['archived=sometimes', 'archived'],
      ['limit=0', 'limit'],
      ['limit=1000', 'limit'],
      ['offset=-1', 'offset'],
    ])('rejects the query %s', async (query, field) => {
      const { body } = await admin().get(`/parties?${query}`).expect(400);
      expect(fieldsIn(body)).toContain(field);
    });
  });

  describe('creating', () => {
    it('lets sales create a customer and records who did it', async () => {
      const { body } = await sales()
        .post('/parties', {
          name: '  Tana River Foods Ltd  ',
          roles: ['customer'],
          email: 'orders@tanariver.example',
          phone: '+254 700 000 001',
          city: 'Garissa',
          country: 'KE',
          kraPin: 'p051234567a',
          legalName: '',
        })
        .expect(201);
      expect(body).toMatchObject({
        name: 'Tana River Foods Ltd',
        kraPin: 'P051234567A',
        legalName: null,
        accountStatus: 'active',
        archivedAt: null,
        roles: ['customer'],
        contacts: [],
      });
      const audit = await lastAudit('Party', body.id);
      expect(audit).toMatchObject({ action: 'create' });
      expect(audit!.actorUserId).toBe(
        (await db.orm.public.User.where({ email: SALES }).first())!.id,
      );
    });

    it('refuses sales setting billing fields, and saves nothing', async () => {
      for (const billing of [
        { paymentTermsDays: 30 },
        { creditLimit: '1000' },
        { accountStatus: 'on_hold' },
      ]) {
        await sales()
          .post('/parties', {
            name: 'Billing Refused Ltd',
            roles: ['customer'],
            ...billing,
          })
          .expect(403);
      }
      expect(
        await db.orm.public.Party.where({
          name: 'Billing Refused Ltd',
        }).first(),
      ).toBeNull();
    });

    it('stores money exactly and returns it as a decimal string', async () => {
      const { id } = await newCustomer('Exact Credit Ltd', {
        creditLimit: '1250.5',
        paymentTermsDays: 30,
      });
      const { body } = await admin().get(`/parties/${id}`).expect(200);
      expect(body.billing.creditLimit).toBe('1250.50');
      expect(body.billing.paymentTermsDays).toBe(30);
    });

    it.each([
      [{ name: '', roles: ['customer'] }, 'name'],
      [{ name: '   ', roles: ['customer'] }, 'name'],
      [{ roles: ['customer'] }, 'name'],
      [{ name: 'A' }, 'roles'],
      [{ name: 'A', roles: [] }, 'roles'],
      [{ name: 'A', roles: ['king'] }, 'roles'],
      [{ name: 'A', roles: ['customer', 'customer'] }, 'roles'],
      [{ name: 'A', roles: ['customer'], email: 'not-an-email' }, 'email'],
      [{ name: 'A', roles: ['customer'], kraPin: 'X'.repeat(21) }, 'kraPin'],
      [{ name: 'A', roles: ['customer'], phone: 'call me' }, 'phone'],
      [
        { name: 'A', roles: ['customer'], paymentTermsDays: -1 },
        'paymentTermsDays',
      ],
      [
        { name: 'A', roles: ['customer'], paymentTermsDays: 366 },
        'paymentTermsDays',
      ],
      [
        { name: 'A', roles: ['customer'], paymentTermsDays: 1.5 },
        'paymentTermsDays',
      ],
      [{ name: 'A', roles: ['customer'], creditLimit: '-1' }, 'creditLimit'],
      [{ name: 'A', roles: ['customer'], creditLimit: 1000 }, 'creditLimit'],
      [{ name: 'A', roles: ['customer'], creditLimit: '1.234' }, 'creditLimit'],
      [
        { name: 'A', roles: ['customer'], creditLimit: '1000000000000' },
        'creditLimit',
      ],
      [
        { name: 'A', roles: ['customer'], accountStatus: 'frozen' },
        'accountStatus',
      ],
      [
        { name: 'A', roles: ['customer'], accountStatus: null },
        'accountStatus',
      ],
    ])('rejects %j on field %s', async (body, field) => {
      const response = await admin().post('/parties', body).expect(400);
      expect(fieldsIn(response.body)).toContain(field);
    });

    it('accepts the limits of the allowed ranges', async () => {
      await newCustomer('Terms Zero Ltd', {
        paymentTermsDays: 0,
        creditLimit: '0',
      });
      await newCustomer('Terms Max Ltd', {
        paymentTermsDays: 365,
        creditLimit: '999999999999.99',
      });
    });

    it('rejects unknown fields', async () => {
      await admin()
        .post('/parties', { name: 'A', roles: ['customer'], archivedAt: null })
        .expect(400);
    });
  });

  describe('KRA PIN uniqueness', () => {
    it('accepts any format up to the length limit, for now', async () => {
      for (const kraPin of ['123', 'old-pin 7', 'X'.repeat(20)]) {
        const { id } = await newCustomer(`Free Format ${kraPin}`, { kraPin });
        const { body } = await admin().get(`/parties/${id}`).expect(200);
        expect(body.kraPin).toBe(kraPin.toUpperCase());
      }
    });

    it('refuses a PIN already in use, ignoring case', async () => {
      await newCustomer('Pin Holder Ltd', { kraPin: 'A111111111B' });
      const { body } = await admin()
        .post('/parties', {
          name: 'Pin Copier Ltd',
          roles: ['customer'],
          kraPin: 'a111111111b',
        })
        .expect(409);
      expect(fieldsIn(body)).toEqual(['kraPin']);
    });

    it('refuses changing to a PIN in use, but allows keeping your own', async () => {
      const { id } = await newCustomer('Pin Changer Ltd', {
        kraPin: 'A222222222B',
      });
      await admin()
        .patch(`/parties/${id}`, { kraPin: 'A111111111B' })
        .expect(409);
      await admin()
        .patch(`/parties/${id}`, { kraPin: 'A222222222B', city: 'Nyeri' })
        .expect(200);
    });

    it('allows any number of records with no PIN', async () => {
      await newCustomer('No Pin One Ltd');
      await newCustomer('No Pin Two Ltd');
    });

    it('returns 409 when two requests race for the same PIN', async () => {
      const attempt = (name: string) =>
        admin().post('/parties', {
          name,
          roles: ['customer'],
          kraPin: 'R333333333S',
        });
      const results = await Promise.all([
        attempt('Racer One'),
        attempt('Racer Two'),
        attempt('Racer Three'),
      ]);
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        201, 409, 409,
      ]);
    });
  });

  describe('updating', () => {
    it('lets sales change details but not billing', async () => {
      const { id } = await newCustomer('Split Rights Ltd');
      const { body } = await sales()
        .patch(`/parties/${id}`, { city: 'Nakuru', email: 'a@split.example' })
        .expect(200);
      expect(body).toMatchObject({ city: 'Nakuru', email: 'a@split.example' });

      await sales()
        .patch(`/parties/${id}`, { paymentTermsDays: 7 })
        .expect(403);
      await sales().patch(`/parties/${id}`, { creditLimit: '5' }).expect(403);
      await sales()
        .patch(`/parties/${id}`, { accountStatus: 'closed' })
        .expect(403);
      // A refused field stops the whole request, including allowed fields sent with it.
      await sales()
        .patch(`/parties/${id}`, { city: 'Kitale', creditLimit: '5' })
        .expect(403);
      const after = await admin().get(`/parties/${id}`).expect(200);
      expect(after.body.city).toBe('Nakuru');
      expect(after.body.billing.creditLimit).toBeNull();
    });

    it.each(['finance', 'management', 'admin'])(
      'lets %s change terms and limit',
      async (who) => {
        const { id } = await newCustomer(`Billing by ${who}`);
        const { body } = await api(tokens[who])
          .patch(`/parties/${id}`, {
            paymentTermsDays: 45,
            creditLimit: '250000',
          })
          .expect(200);
        expect(body.billing).toMatchObject({
          paymentTermsDays: 45,
          creditLimit: '250000.00',
        });
      },
    );

    it.each(['management', 'admin'])(
      'lets %s change account status',
      async (who) => {
        const { id } = await newCustomer(`Status by ${who}`);
        const { body } = await api(tokens[who])
          .patch(`/parties/${id}`, { accountStatus: 'on_hold' })
          .expect(200);
        expect(body.accountStatus).toBe('on_hold');
      },
    );

    it('stops finance changing account status, saving nothing', async () => {
      const { id } = await newCustomer('Finance Status Ltd');
      await finance()
        .patch(`/parties/${id}`, { accountStatus: 'on_hold' })
        .expect(403);
      await finance()
        .patch(`/parties/${id}`, {
          paymentTermsDays: 7,
          accountStatus: 'closed',
        })
        .expect(403);
      const { body } = await admin().get(`/parties/${id}`).expect(200);
      expect(body.accountStatus).toBe('active');
      expect(body.billing.paymentTermsDays).toBeNull();
    });

    it('stops finance changing company details', async () => {
      const { id } = await newCustomer('Finance Details Ltd');
      await finance().patch(`/parties/${id}`, { city: 'Thika' }).expect(403);
    });

    it('can clear optional values but not the name', async () => {
      const { id } = await newCustomer('Clearable Ltd', {
        email: 'x@clearable.example',
        creditLimit: '100',
      });
      const { body } = await admin()
        .patch(`/parties/${id}`, { email: '', creditLimit: null })
        .expect(200);
      expect(body.email).toBeNull();
      expect(body.billing.creditLimit).toBeNull();
      const rejected = await admin()
        .patch(`/parties/${id}`, { name: null })
        .expect(400);
      expect(fieldsIn(rejected.body)).toEqual(['name']);
      await admin().patch(`/parties/${id}`, { name: '  ' }).expect(400);
    });

    it('audits only what changed', async () => {
      const { id } = await newCustomer('Audited Ltd', {
        city: 'Meru',
        creditLimit: '100',
      });
      await admin()
        .patch(`/parties/${id}`, {
          city: 'Embu',
          name: 'Audited Ltd',
          creditLimit: '100.00',
        })
        .expect(200);
      const audit = await lastAudit('Party', id);
      expect(audit).toMatchObject({
        action: 'update',
        changes: { before: { city: 'Meru' }, after: { city: 'Embu' } },
      });
    });

    it('writes no audit entry and keeps updatedAt when nothing changed', async () => {
      const { id } = await newCustomer('Unchanged Ltd', { city: 'Lamu' });
      const before = await admin().get(`/parties/${id}`).expect(200);
      const entry = await lastAudit('Party', id);
      await admin().patch(`/parties/${id}`, { city: 'Lamu' }).expect(200);
      const after = await admin().get(`/parties/${id}`).expect(200);
      expect(after.body.updatedAt).toBe(before.body.updatedAt);
      expect((await lastAudit('Party', id))!.id).toBe(entry!.id);
    });

    it.each(['abc', '0', '1.5', '99999999999', '999999'])(
      'answers 404 for the id %s',
      async (id) => {
        await admin().get(`/parties/${id}`).expect(404);
        await admin().patch(`/parties/${id}`, { city: 'X' }).expect(404);
        await admin().post(`/parties/${id}/archive`).expect(404);
        await admin()
          .post(`/parties/${id}/contacts`, { name: 'X' })
          .expect(404);
      },
    );
  });

  describe('archiving', () => {
    it('hides archived records by default and restores them', async () => {
      const { id } = await newCustomer('Archive Me Ltd');
      const archived = await sales().post(`/parties/${id}/archive`).expect(200);
      expect(archived.body.archivedAt).not.toBeNull();
      expect((await lastAudit('Party', id))!.action).toBe('archive');

      const ids = async (query: string) =>
        (
          await admin()
            .get(`/parties?q=Archive%20Me${query}&limit=200`)
            .expect(200)
        ).body.items.map((p: { id: number }) => p.id);
      expect(await ids('')).toEqual([]);
      expect(await ids('&archived=only')).toEqual([id]);
      expect(await ids('&archived=include')).toEqual([id]);
      await admin().get(`/parties/${id}`).expect(200);

      const restored = await sales().post(`/parties/${id}/restore`).expect(200);
      expect(restored.body.archivedAt).toBeNull();
      expect((await lastAudit('Party', id))!.action).toBe('restore');
      expect(await ids('')).toEqual([id]);
    });

    it('refuses archiving a customer until every shipment is delivered', async () => {
      const { id } = await newCustomer('Busy Customer Ltd');
      await db.runtime().execute(
        db.raw.sql`
          INSERT INTO "Shipment"
            (reference, "customerId", mode, direction, status, origin, destination, "cargoDescription")
          VALUES ('BUSY-S1', ${id}::int, 'sea', 'import', 'on_hold', 'Shanghai', 'Mombasa', 'Fictional')
        `
          .affectedCount()
          .build(),
      );
      const { body } = await admin().post(`/parties/${id}/archive`).expect(409);
      expect(body.message).toContain('active shipments');
      expect((await db.orm.public.Party.first({ id }))!.archivedAt).toBeNull();
      expect((await lastAudit('Party', id))!.action).toBe('create');

      await db.orm.public.Shipment.where({ reference: 'BUSY-S1' }).update({
        status: 'delivered',
        deliveredAt: new Date(),
      });
      await admin().post(`/parties/${id}/archive`).expect(200);
    });

    it('refuses repeating an archive or restore', async () => {
      const { id } = await newCustomer('Archive Twice Ltd');
      await admin().post(`/parties/${id}/restore`).expect(409);
      await admin().post(`/parties/${id}/archive`).expect(200);
      await admin().post(`/parties/${id}/archive`).expect(409);
    });

    it('refuses changes to an archived record, leaving it untouched', async () => {
      const { id } = await newCustomer('Archived Edit Ltd');
      const contact = (
        await admin().post(`/parties/${id}/contacts`, { name: 'A' }).expect(201)
      ).body;
      const before = (await admin().post(`/parties/${id}/archive`).expect(200))
        .body;
      await admin().patch(`/parties/${id}`, { city: 'Voi' }).expect(409);
      await admin().post(`/parties/${id}/contacts`, { name: 'B' }).expect(409);
      await admin()
        .patch(`/parties/${id}/contacts/${contact.id}`, { name: 'C' })
        .expect(409);
      await admin().delete(`/parties/${id}/contacts/${contact.id}`).expect(409);
      const after = await admin().get(`/parties/${id}`).expect(200);
      expect(after.body.updatedAt).toBe(before.updatedAt);
      expect(after.body.contacts.map((c: { name: string }) => c.name)).toEqual([
        'A',
      ]);
    });

    it('offers no way to delete a customer', async () => {
      const { id } = await newCustomer('Never Deleted Ltd');
      await admin().delete(`/parties/${id}`).expect(404);
      expect(await db.orm.public.Party.first({ id })).not.toBeNull();
    });
  });

  describe('contacts', () => {
    const contactsOf = async (id: number) =>
      (await admin().get(`/parties/${id}`).expect(200)).body.contacts as {
        id: number;
        name: string;
        isPrimary: boolean;
      }[];

    it('makes the first contact primary and moves primary when asked', async () => {
      const { id } = await newCustomer('Primary Moves Ltd');
      const first = await sales()
        .post(`/parties/${id}/contacts`, {
          name: 'First',
          title: 'Accounts',
          email: 'first@primary.example',
          phone: '+254 700 000 002',
        })
        .expect(201);
      expect(first.body).toMatchObject({ name: 'First', isPrimary: true });

      const second = await admin()
        .post(`/parties/${id}/contacts`, { name: 'Second' })
        .expect(201);
      expect(second.body.isPrimary).toBe(false);

      await admin()
        .patch(`/parties/${id}/contacts/${second.body.id}`, { isPrimary: true })
        .expect(200);
      const contacts = await contactsOf(id);
      expect(contacts.map((c) => [c.name, c.isPrimary])).toEqual([
        ['Second', true],
        ['First', false],
      ]);
      const audit = await lastAudit('Contact', second.body.id);
      expect(audit).toMatchObject({
        action: 'update',
        changes: { before: { isPrimary: false }, after: { isPrimary: true } },
      });
    });

    it('adding a new primary contact replaces the old one', async () => {
      const { id } = await newCustomer('New Primary Ltd');
      await admin()
        .post(`/parties/${id}/contacts`, { name: 'Old' })
        .expect(201);
      await admin()
        .post(`/parties/${id}/contacts`, { name: 'New', isPrimary: true })
        .expect(201);
      const primaries = (await contactsOf(id)).filter((c) => c.isPrimary);
      expect(primaries.map((c) => c.name)).toEqual(['New']);
    });

    it('refuses leaving a party with no primary contact', async () => {
      const { id } = await newCustomer('Keep Primary Ltd');
      const { body: only } = await admin()
        .post(`/parties/${id}/contacts`, { name: 'Only' })
        .expect(201);
      const { body } = await admin()
        .patch(`/parties/${id}/contacts/${only.id}`, { isPrimary: false })
        .expect(400);
      expect(fieldsIn(body)).toEqual(['isPrimary']);
    });

    it('promotes the longest-standing contact when the primary is removed', async () => {
      const { id } = await newCustomer('Promote Ltd');
      const add = async (name: string) =>
        (await admin().post(`/parties/${id}/contacts`, { name }).expect(201))
          .body as { id: number };
      const a = await add('A');
      await add('B');
      await add('C');
      await sales().delete(`/parties/${id}/contacts/${a.id}`).expect(204);
      expect((await lastAudit('Contact', a.id))!.action).toBe('delete');
      const contacts = await contactsOf(id);
      expect(contacts.map((c) => [c.name, c.isPrimary])).toEqual([
        ['B', true],
        ['C', false],
      ]);
    });

    it('never ends with two primaries when requests race', async () => {
      const { id } = await newCustomer('Primary Race Ltd');
      await Promise.all(
        ['A', 'B', 'C', 'D', 'E'].map((name) =>
          admin()
            .post(`/parties/${id}/contacts`, { name, isPrimary: true })
            .expect(201),
        ),
      );
      const contacts = await contactsOf(id);
      expect(contacts).toHaveLength(5);
      expect(contacts.filter((c) => c.isPrimary)).toHaveLength(1);
    });

    it('will not touch a contact through another party', async () => {
      const one = await newCustomer('Contact Owner Ltd');
      const other = await newCustomer('Contact Stranger Ltd');
      const { body: contact } = await admin()
        .post(`/parties/${one.id}/contacts`, { name: 'Mine' })
        .expect(201);
      await admin()
        .patch(`/parties/${other.id}/contacts/${contact.id}`, {
          name: 'Stolen',
        })
        .expect(404);
      await admin()
        .delete(`/parties/${other.id}/contacts/${contact.id}`)
        .expect(404);
      expect((await contactsOf(one.id))[0].name).toBe('Mine');
    });

    it.each([
      [{}, 'name'],
      [{ name: ' ' }, 'name'],
      [{ name: 'A', email: 'nope' }, 'email'],
      [{ name: 'A', phone: 'nope' }, 'phone'],
      [{ name: 'A', isPrimary: 'yes' }, 'isPrimary'],
    ])('rejects the contact %j', async (body, field) => {
      const { id } = await newCustomer(`Bad Contact ${JSON.stringify(body)}`);
      const response = await admin()
        .post(`/parties/${id}/contacts`, body)
        .expect(400);
      expect(fieldsIn(response.body)).toContain(field);
    });
  });

  describe('calculated figures', () => {
    const run = (statement: ReturnType<typeof db.raw.sql>) =>
      db.runtime().execute(statement.affectedCount().build());

    it('calculates counts and balances exactly, from fictional records', async () => {
      const { id } = await newCustomer('Figures Ltd', {
        creditLimit: '1000.00',
      });
      const { id: untouched } = await newCustomer('Other Figures Ltd');

      const addShipment = (reference: string, status: string, party = id) =>
        run(db.raw.sql`
          INSERT INTO "Shipment"
            (reference, "customerId", mode, direction, status, origin, destination,
             "cargoDescription", "deliveredAt")
          VALUES (${reference}, ${party}::int, 'sea', 'import', ${status}, 'Shanghai', 'Mombasa',
             'Fictional', CASE WHEN ${status}::text = 'delivered' THEN now() END)
        `);
      await addShipment('FIG-S1', 'in_transit');
      await addShipment('FIG-S2', 'on_hold');
      await addShipment('FIG-S3', 'delivered');
      await addShipment('FIG-S4', 'in_transit', untouched);
      const shipment = await db.orm.public.Shipment.where({
        reference: 'FIG-S1',
      }).first();

      const addQuotation = (reference: string, status: string) =>
        run(db.raw.sql`
          INSERT INTO "Quotation"
            (reference, "customerId", mode, direction, status, origin, destination,
             "cargoSummary", "issueDate", "validUntil")
          VALUES (${reference}, ${id}::int, 'sea', 'import', ${status}, 'Shanghai', 'Mombasa',
             'Fictional', '2026-11-01'::date, '2026-11-30'::date)
        `);
      await addQuotation('FIG-Q1', 'draft');
      await addQuotation('FIG-Q2', 'sent');
      await addQuotation('FIG-Q3', 'declined');

      const addInvoice = (
        number: string,
        status: string,
        total: string,
        dueDate: string,
        party = id,
      ) =>
        run(db.raw.sql`
          INSERT INTO "Invoice"
            (number, "shipmentId", "customerId", status, "issueDate", "dueDate", "customerName",
             subtotal, "taxTotal", total, "issuedAt")
          VALUES (${number}, ${shipment!.id}::int, ${party}::int, ${status}, '2020-01-01'::date,
             ${dueDate}::date, 'Figures Ltd', ${total}::numeric, 0, ${total}::numeric, now())
        `);
      // Decimal values that floats cannot add exactly: 0.10 + 0.20 is not 0.30 in JavaScript.
      await addInvoice('FIG-I1', 'issued', '100.10', '2020-02-01'); // Overdue, part paid.
      await addInvoice('FIG-I2', 'issued', '200.20', '2020-02-01'); // Overdue, fully credited.
      await addInvoice('FIG-I3', 'issued', '300.30', '2999-01-01'); // Not yet due.
      await addInvoice('FIG-I4', 'draft', '999.99', '2020-02-01'); // Drafts never count.
      await addInvoice('FIG-I5', 'cancelled', '888.88', '2020-02-01'); // Nor cancelled.
      await addInvoice('FIG-I6', 'issued', '77.00', '2020-02-01', untouched);

      const invoiceId = async (number: string) =>
        (await db.orm.public.Invoice.where({ number }).first())!.id;

      const addCreditNote = async (
        number: string,
        invoice: string,
        status: string,
        total: string,
      ) =>
        run(db.raw.sql`
          INSERT INTO "CreditNote"
            (number, "invoiceId", status, reason, "issueDate", subtotal, "taxTotal", total, "issuedAt")
          VALUES (${number}, ${await invoiceId(invoice)}::int, ${status}, 'Fictional',
             '2020-01-02'::date, ${total}::numeric, 0, ${total}::numeric, now())
        `);
      await addCreditNote('FIG-C1', 'FIG-I2', 'issued', '200.20');
      await addCreditNote('FIG-C2', 'FIG-I1', 'draft', '50.00'); // Drafts never count.

      const addPayment = async (
        reference: string,
        status: string,
        invoice: string,
        amount: string,
      ) => {
        await run(db.raw.sql`
          INSERT INTO "Payment"
            (reference, "customerId", method, amount, "receivedAt", status, "bouncedAt", "clearedAt")
          VALUES (${reference}, ${id}::int, 'bank_transfer', ${amount}::numeric, now(), ${status}, now(), now())
        `);
        const payment = await db.orm.public.Payment.where({
          reference,
        }).first();
        await run(db.raw.sql`
          INSERT INTO "PaymentAllocation" ("paymentId", "invoiceId", amount)
          VALUES (${payment!.id}::int, ${await invoiceId(invoice)}::int, ${amount}::numeric)
        `);
      };
      await addPayment('FIG-P1', 'cleared', 'FIG-I1', '0.10');
      await addPayment('FIG-P2', 'received', 'FIG-I1', '0.20');
      await addPayment('FIG-P3', 'bounced', 'FIG-I1', '50.00'); // Stops counting.
      await addPayment('FIG-P4', 'cancelled', 'FIG-I3', '60.00'); // Stops counting.

      const { body } = await admin().get(`/parties/${id}`).expect(200);
      expect(body.shipments).toEqual({ active: 2, total: 3 });
      expect(body.quotations).toEqual({ open: 2, total: 3 });
      expect(body.billing.account).toEqual({
        invoiced: '600.60',
        credited: '200.20',
        paid: '0.30',
        outstanding: '400.10',
        overdue: '99.80',
        overdueInvoices: 1,
        availableCredit: '599.90',
      });

      // The list shows the same figures, kept apart for each customer.
      const list = await admin().get('/parties?q=Figures%20Ltd').expect(200);
      const row = (name: string) =>
        list.body.items.find((p: { name: string }) => p.name === name);
      expect(row('Figures Ltd').billing.account.outstanding).toBe('400.10');
      expect(row('Other Figures Ltd').billing.account).toEqual({
        invoiced: '77.00',
        credited: '0.00',
        paid: '0.00',
        outstanding: '77.00',
        overdue: '77.00',
        overdueInvoices: 1,
        availableCredit: null,
      });
      expect(row('Other Figures Ltd').shipments).toEqual({
        active: 1,
        total: 1,
      });

      // A customer over their limit shows a negative figure, not zero.
      await admin().patch(`/parties/${id}`, { creditLimit: '100' }).expect(200);
      const over = await admin().get(`/parties/${id}`).expect(200);
      expect(over.body.billing.account.availableCredit).toBe('-300.10');
    });

    it('shows zeros, as decimal text, for a customer with no records', async () => {
      const { id } = await newCustomer('Empty Figures Ltd');
      const { body } = await admin().get(`/parties/${id}`).expect(200);
      expect(body.billing.account).toEqual({
        invoiced: '0.00',
        credited: '0.00',
        paid: '0.00',
        outstanding: '0.00',
        overdue: '0.00',
        overdueInvoices: 0,
        availableCredit: null,
      });
    });
  });
});
