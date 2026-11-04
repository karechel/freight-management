import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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
const FINANCE = 'f.mwende@freight-demo.example';

describe('Authentication and authorization (e2e)', () => {
  let app: INestApplication<Server>;

  const login = (email: string, password: string) =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });

  const tokenFor = async (email: string, password: string) =>
    (await login(email, password).expect(200)).body.accessToken as string;

  const me = (token: string) =>
    request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase();
    await seedSetup(db, ADMIN);
    await seedDemo(db, DEMO_PASSWORD);
  });

  afterAll(async () => {
    await app.close();
  });

  it('signs in and returns the user without their password hash', async () => {
    const response = await login(ADMIN.email, ADMIN.password);
    expect(response.status).toBe(200);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.expiresIn).toBe(8 * 60 * 60);
    expect(response.body.user.roles).toEqual(['admin']);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain('scrypt');
  });

  it('treats the email as case-insensitive', async () => {
    await login(ADMIN.email.toUpperCase(), ADMIN.password).expect(200);
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const wrong = await login(ADMIN.email, 'not-the-right-password');
    const unknown = await login(
      'nobody@freight-demo.example',
      'whatever-it-is',
    );
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('validates the request and rejects unknown fields', async () => {
    const invalid = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: '' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.message).toBe('Validation failed');
    expect(invalid.body.details.map((d: { field: string }) => d.field)).toEqual(
      ['email', 'password'],
    );

    const extra = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: ADMIN.email, password: ADMIN.password, isAdmin: true });
    expect(extra.status).toBe(400);
  });

  it('protects endpoints by default', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    await me('garbage').expect(401);
  });

  it('rejects a token signed with another secret', async () => {
    const forged = new JwtService({
      secret: 'a-different-secret-of-sufficient-length',
    }).sign({ sub: 1 });
    await me(forged).expect(401);
  });

  it('rejects an unsigned token', async () => {
    const encode = (value: object) =>
      Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: 1 })}.`;
    await me(unsigned).expect(401);
  });

  it('returns the signed-in user with roles and permissions', async () => {
    const response = await me(await tokenFor(FINANCE, DEMO_PASSWORD));
    expect(response.status).toBe(200);
    expect(response.body.roles).toEqual(['finance']);
    expect(response.body.permissions).toContain('credit.override');
  });

  it('gives only finance, management and admin the credit override', async () => {
    const holders = async (email: string, password: string) =>
      (await me(await tokenFor(email, password))).body.permissions.includes(
        'credit.override',
      );
    await expect(holders(ADMIN.email, ADMIN.password)).resolves.toBe(true);
    await expect(
      holders('g.nduta@freight-demo.example', DEMO_PASSWORD),
    ).resolves.toBe(true);
    await expect(holders(FINANCE, DEMO_PASSWORD)).resolves.toBe(true);
    await expect(holders(OPERATIONS, DEMO_PASSWORD)).resolves.toBe(false);
    await expect(
      holders('b.otieno@freight-demo.example', DEMO_PASSWORD),
    ).resolves.toBe(false);
  });

  it('applies disabling a user immediately, even with a valid token', async () => {
    const token = await tokenFor(OPERATIONS, DEMO_PASSWORD);
    await me(token).expect(200);

    const users = db.orm.public.User;
    await users.where({ email: OPERATIONS }).update({ status: 'disabled' });
    try {
      await me(token).expect(401);
      await login(OPERATIONS, DEMO_PASSWORD).expect(401);
    } finally {
      await users.where({ email: OPERATIONS }).update({ status: 'active' });
    }
  });

  it('blocks repeated failed sign-ins', async () => {
    const email = 'g.nduta@freight-demo.example';
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await login(email, 'not-the-right-password').expect(401);
    }
    const blocked = await login(email, DEMO_PASSWORD);
    expect(blocked.status).toBe(429);
    expect(blocked.body.statusCode).toBe(429);
  });
});
