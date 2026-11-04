#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/3277325397aec2a66c498a80377ddeeeee51528527b3b4c6864dd3167eb01cdc/contract';
import startContract from '../../snapshots/3277325397aec2a66c498a80377ddeeeee51528527b3b4c6864dd3167eb01cdc/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/9e7525994cc714cbd7e14206800c9edfb1fa22728f0ca2b813dd94de450da3db/contract';
import endContract from '../../snapshots/9e7525994cc714cbd7e14206800c9edfb1fa22728f0ca2b813dd94de450da3db/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'ReferenceFormat',
        columns: [
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('documentType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('resetPolicy', 'text', {
            notNull: true,
            default: lit('never'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('template', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('updatedById', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'ReferenceFormat_documentType_check_ea19f9ed',
            "\"documentType\" IN ('shipment', 'quotation', 'invoice', 'booking', 'credit_note', 'payment', 'customs_entry')",
          ),
          checkExpression(
            'ReferenceFormat_resetPolicy_check_aab625b6',
            "\"resetPolicy\" IN ('never', 'yearly', 'monthly')",
          ),
          checkExpression('reference_format_has_sequence_31975ed0', "template LIKE '%{SEQ:%}%'"),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ReferenceFormat',
        constraint: 'ReferenceFormat_documentType_key',
        columns: ['documentType'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ReferenceFormat',
        index: 'ReferenceFormat_updatedById_idx_d0517c24',
        columns: ['updatedById'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ReferenceFormat',
        foreignKey: {
          name: 'ReferenceFormat_updatedById_fkey',
          columns: ['updatedById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
