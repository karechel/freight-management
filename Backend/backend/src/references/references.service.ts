import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { validationFailed } from '../common/validation-exception.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import {
  counterPeriod,
  nairobiDateParts,
  renderReference,
  validateTemplate,
} from './reference-template.js';
import type {
  ContractDocumentType,
  ContractResetPolicy,
  ContractTransportMode,
} from './reference.types.js';

// How many numbers to skip when a format change makes new references match old ones.
const MAX_ATTEMPTS = 100;

export interface GenerateOptions {
  mode?: ContractTransportMode;
  /** Whether a candidate is already used on the record type being created. */
  isTaken?: (candidate: string) => Promise<boolean>;
  at?: Date;
}

@Injectable()
export class ReferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Issues the next reference inside the caller's transaction. The counter row stays locked until
   * that transaction ends, so concurrent requests wait, and a rollback gives the number back.
   */
  async generate(
    tx: Tx,
    documentType: ContractDocumentType,
    options: GenerateOptions = {},
  ): Promise<string> {
    const format = await tx.orm.public.ReferenceFormat.where({
      documentType,
    }).first();
    if (!format) {
      throw new InternalServerErrorException(
        `No reference format is configured for ${documentType}.`,
      );
    }

    const parts = nairobiDateParts(options.at ?? new Date());
    const period = counterPeriod(format.resetPolicy, parts);
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const sequence = await this.nextNumber(tx, documentType, period);
      const candidate = renderReference(format.template, {
        ...parts,
        sequence,
        mode: options.mode,
      });
      if (!(await options.isTaken?.(candidate))) return candidate;
    }
    throw new ConflictException(
      `Could not find a free ${documentType} reference. Check the reference format.`,
    );
  }

  /** Atomically takes the next number for a counter, creating the counter on first use. */
  private async nextNumber(
    tx: Tx,
    documentType: string,
    period: number,
  ): Promise<number> {
    const plan = this.prisma.client.raw.sql`
      INSERT INTO "NumberSequence" ("prefix", "year", "nextValue")
      VALUES (${documentType}, ${period}, 2)
      ON CONFLICT ("prefix", "year")
      DO UPDATE SET "nextValue" = "NumberSequence"."nextValue" + 1
      RETURNING "nextValue" - 1 AS "value"
    `
      .returnsRow({ value: 'pg/int4@1' })
      .build();
    const [row] = await tx.query(plan);
    return row.value;
  }

  listFormats() {
    return this.prisma.client.orm.public.ReferenceFormat.orderBy((f) =>
      f.documentType.asc(),
    ).all();
  }

  async updateFormat(
    documentType: ContractDocumentType,
    template: string,
    resetPolicy: ContractResetPolicy,
    actorUserId: number,
  ) {
    this.assertValid(documentType, template, resetPolicy);
    return this.prisma.client.transaction(async (tx) => {
      const formats = tx.orm.public.ReferenceFormat;
      const before = await formats.where({ documentType }).first();
      if (!before) {
        throw new NotFoundException(
          `No reference format exists for ${documentType}.`,
        );
      }
      const after = await formats.where({ id: before.id }).update({
        template,
        resetPolicy,
        updatedById: actorUserId,
        updatedAt: new Date(),
      });
      await this.audit.record(tx, {
        actorUserId,
        entityType: 'ReferenceFormat',
        entityId: before.id,
        action: 'update',
        summary: `Reference format for ${documentType} changed`,
        changes: {
          before: {
            template: before.template,
            resetPolicy: before.resetPolicy,
          },
          after: { template, resetPolicy },
        },
      });
      return after;
    });
  }

  /** Shows what the next reference would look like, without taking a number. */
  async preview(
    documentType: ContractDocumentType,
    template: string,
    resetPolicy: ContractResetPolicy,
    mode: ContractTransportMode | undefined,
  ) {
    this.assertValid(documentType, template, resetPolicy);
    const parts = nairobiDateParts(new Date());
    const counter = await this.prisma.client.orm.public.NumberSequence.where({
      prefix: documentType,
      year: counterPeriod(resetPolicy, parts),
    }).first();
    return {
      reference: renderReference(template, {
        ...parts,
        sequence: counter?.nextValue ?? 1,
        mode: mode ?? (documentType === 'shipment' ? 'sea' : undefined),
      }),
    };
  }

  private assertValid(
    documentType: ContractDocumentType,
    template: string,
    resetPolicy: ContractResetPolicy,
  ): void {
    const problems = validateTemplate(documentType, template, resetPolicy);
    if (problems.length > 0) {
      throw validationFailed([{ field: 'template', messages: problems }]);
    }
  }
}
