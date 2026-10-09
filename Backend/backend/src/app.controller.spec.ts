import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './prisma/prisma.service.js';

describe('AppController', () => {
  let appController: AppController;
  const users = [
    { id: 1, email: 'test@example.com', name: 'Test User', createdAt: new Date() },
  ];

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PrismaService,
          useValue: {
            client: {
              orm: { public: { User: { all: vi.fn().mockResolvedValue(users) } } },
            },
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return the users from the database', async () => {
      await expect(appController.getHello()).resolves.toEqual(users);
    });
  });

  describe('health', () => {
    it('should report an ok status', () => {
      expect(appController.getHealth()).toEqual({
        status: 'ok',
        message: 'Freight Management API is running',
      });
    });
  });
});
