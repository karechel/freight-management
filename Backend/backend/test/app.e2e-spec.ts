import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', async () => {
    const response = await request(app.getHttpServer()).get('/');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('/health (GET)', async () => {
    const response = await request(app.getHttpServer()).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      message: 'Freight Management API is running',
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
