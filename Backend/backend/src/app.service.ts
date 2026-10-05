import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getHello() {
    const users = await this.prisma.client.orm.public.User.all();
    return users;
  }

    getHealth() {
    return {
      status: 'ok',
      message: 'Freight Management API is running',
    };
  }
}