import { Injectable } from '@nestjs/common';
import type { JsonValue } from '@prisma/orm-postgres/target/codec-types';
import type { Tx } from '../prisma/prisma.service.js';

export interface AuditEntry {
  actorUserId: number | null;
  entityType: string;
  entityId: number;
  action: string;
  summary?: string;
  /** Before and after values, for example `{ before: {...}, after: {...} }`. */
  changes?: { readonly [key: string]: JsonValue };
}

@Injectable()
export class AuditService {
  /** Records a change inside the caller's transaction, so both commit or roll back together. */
  async record(tx: Tx, entry: AuditEntry): Promise<void> {
    await tx.orm.public.AuditLog.create({
      actorUserId: entry.actorUserId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      summary: entry.summary ?? null,
      changes: entry.changes ?? null,
      occurredAt: new Date(),
    });
  }
}
