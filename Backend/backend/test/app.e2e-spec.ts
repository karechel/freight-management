import { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { createTestApp } from './support/app.js';

describe('App (e2e)', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health is public', async () => {
    const response = await request(app.getHttpServer()).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      message: 'Freight Management API is running',
    });
  });

  it('GET / no longer exposes users', async () => {
    const response = await request(app.getHttpServer()).get('/');
    expect(response.status).toBe(404);
    expect(JSON.stringify(response.body)).not.toContain('email');
  });

  it('unknown routes use the standard error format', async () => {
    const response = await request(app.getHttpServer()).get('/api/nowhere');
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      details: [],
    });
  });
});
