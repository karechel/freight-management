import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { db } from './db.js';

export type Db = typeof db;
/** The context passed to `db.transaction(...)` callbacks. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

@Injectable()
export class PrismaService implements OnModuleDestroy {
  get client() {
    return db;
  }

  async onModuleDestroy() {
    await db.close();
  }
}
