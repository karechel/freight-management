import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Numeric } from '@prisma/orm-postgres/target/codec-types';
import type { Principal } from '../auth/auth.decorators.js';
import { AuditService } from '../audit/audit.service.js';
import { validationFailed } from '../common/validation-exception.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';

export const CREDIT_OVERRIDE = 'credit.override';

/**
 * `request_approval` (added 2026-11-20, LOG-20261120-1514-credit-approval): staff without
 * `credit.override` create the booking as pending, awaiting approval by an override holder.
 */
export type CreditDecisionValue = 'proceed' | 'blocked' | 'request_approval';

export interface CreditDecisionInput {
  decision: CreditDecisionValue;
  reason: string;
}

export interface CreditFigures {
  /** Outstanding balance of issued invoices before this work (the Phase 1 `outstanding`). */
  exposure: string;
  creditLimit: string;
  attemptedAmount: string;
}

/** What the caller must do after the check. */
export type CreditOutcome =
  | { kind: 'clear' }
  | { kind: 'proceed'; figures: CreditFigures; reason: string }
  | { kind: 'blocked'; figures: CreditFigures; reason: string }
  | { kind: 'request'; figures: CreditFigures; reason: string };

/** A recorded decision: `request` is never stored in `CreditCheck`. */
export type RecordedOutcome = Extract<
  CreditOutcome,
  { kind: 'proceed' } | { kind: 'blocked' }
>;

type Money = Numeric<14, 2>;

/**
 * Credit-limit check (docs/database-design.md §1, docs/backend-implementation-plan.md §4).
 *
 * Rule decided by the operator on 2026-11-20 (LOG-20261120-1315-phase2-start): warn when the
 * customer's outstanding issued-invoice balance plus the value of the new work exceeds their
 * credit limit. No limit recorded means no check. On a warning, staff choose to proceed or stop;
 * only `credit.override` holders may proceed. Every decision is a `CreditCheck` row.
 */
@Injectable()
export class CreditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Runs inside the caller's transaction. Locks the customer row first, so two bookings for the
   * same customer are checked one after the other, never against the same balance at once.
   *
   * @param attemptedAmount the value of the new work; null when none was given
   * @param amountField the request field that holds the value, for error messages
   */
  async check(
    tx: Tx,
    input: {
      customerId: number;
      attemptedAmount: string | null;
      amountField: string;
      decision?: CreditDecisionInput;
      user: Principal;
    },
  ): Promise<CreditOutcome> {
    const current = await this.currentFigures(
      tx,
      input.customerId,
      input.attemptedAmount,
    );
    if (current.creditLimit === null) return { kind: 'clear' };

    if (input.attemptedAmount === null) {
      throw validationFailed([
        {
          field: input.amountField,
          messages: [
            'This customer has a credit limit. Enter the estimated value of the booking.',
          ],
        },
      ]);
    }
    const figures = current;
    const creditLimit = current.creditLimit;
    if (!figures.exceeds) return { kind: 'clear' };

    const result: CreditFigures = {
      exposure: figures.exposure,
      creditLimit,
      attemptedAmount: input.attemptedAmount,
    };
    const { decision } = input;
    if (!decision) {
      throw new ConflictException({
        message:
          'This booking would take the customer over their credit limit. Choose to proceed, request approval or stop, and give a reason.',
        details: [
          {
            field: 'creditDecision',
            messages: ['Over the credit limit: a decision is required.'],
            ...result,
            canOverride: input.user.permissions.includes(CREDIT_OVERRIDE),
          },
        ],
      });
    }
    if (
      decision.decision === 'proceed' &&
      !input.user.permissions.includes(CREDIT_OVERRIDE)
    ) {
      throw new ForbiddenException(
        'Only finance, management and administrators can proceed past a credit-limit warning.',
      );
    }
    return {
      kind:
        decision.decision === 'request_approval'
          ? 'request'
          : decision.decision,
      figures: result,
      reason: decision.reason,
    };
  }

  /**
   * The customer's credit limit (null when none), outstanding balance and whether `attempted` would
   * exceed the limit. Locks the customer row until the caller's transaction ends.
   */
  async currentFigures(
    tx: Tx,
    customerId: number,
    attempted: string | null,
  ): Promise<{
    creditLimit: string | null;
    exposure: string;
    exceeds: boolean;
  }> {
    const input = { customerId, attemptedAmount: attempted ?? '0' };
    const { client } = this.prisma;
    const [row] = await tx.query(
      client.raw.sql`
        SELECT "creditLimit"::text AS "creditLimit"
        FROM "Party" WHERE id = ${input.customerId}::int
        FOR UPDATE
      `
        .returnsRow({ creditLimit: 'pg/text@1' })
        .build(),
    );
    const creditLimit = (row?.creditLimit as string | null | undefined) ?? null;
    if (creditLimit === null) {
      return { creditLimit: null, exposure: '0.00', exceeds: false };
    }

    // Outstanding balance: same definition as the Phase 1 customer figures
    // (`PartiesService.figures`): issued invoices, minus issued credit notes, minus allocations
    // from payments that are not bounced or cancelled. Summed in SQL, never as floats.
    const [figures] = await tx.query(
      client.raw.sql`
        SELECT
          o.outstanding::text AS "exposure",
          (o.outstanding + ${input.attemptedAmount}::numeric > ${creditLimit}::numeric) AS "exceeds"
        FROM (
          SELECT COALESCE(SUM(inv.total - cn.credited - al.paid), 0::numeric(14, 2)) AS outstanding
          FROM "Invoice" inv
          CROSS JOIN LATERAL (
            SELECT COALESCE(SUM(c.total), 0::numeric(14, 2)) AS credited
            FROM "CreditNote" c
            WHERE c."invoiceId" = inv.id AND c.status = 'issued'
          ) cn
          CROSS JOIN LATERAL (
            SELECT COALESCE(SUM(pa.amount), 0::numeric(14, 2)) AS paid
            FROM "PaymentAllocation" pa
            JOIN "Payment" pay ON pay.id = pa."paymentId"
            WHERE pa."invoiceId" = inv.id
              AND pay.status NOT IN ('bounced', 'cancelled')
          ) al
          WHERE inv."customerId" = ${input.customerId}::int AND inv.status = 'issued'
        ) o
      `
        .returnsRow({ exposure: 'pg/text@1', exceeds: 'pg/bool@1' })
        .build(),
    );
    return {
      creditLimit,
      exposure: figures.exposure,
      exceeds: figures.exceeds,
    };
  }

  /** Writes the decision (and its audit entry) inside the caller's transaction. */
  async record(
    tx: Tx,
    input: {
      customerId: number;
      bookingId: number | null;
      outcome: RecordedOutcome;
      user: Principal;
    },
  ) {
    const { figures, reason, kind } = input.outcome;
    const check = await tx.orm.public.CreditCheck.create({
      customerId: input.customerId,
      bookingId: input.bookingId,
      invoiceId: null,
      exposure: figures.exposure as Money,
      creditLimit: figures.creditLimit as Money,
      attemptedAmount: figures.attemptedAmount as Money,
      decision: kind,
      reason,
      decidedById: input.user.id,
      decidedAt: new Date(),
    });
    await this.audit.record(tx, {
      actorUserId: input.user.id,
      entityType: 'CreditCheck',
      entityId: check.id,
      action: kind === 'proceed' ? 'credit_override' : 'credit_blocked',
      summary:
        kind === 'proceed'
          ? `Proceeded past the credit limit for customer ${input.customerId}`
          : `Stopped at the credit limit for customer ${input.customerId}`,
      changes: {
        after: {
          customerId: input.customerId,
          bookingId: input.bookingId,
          ...figures,
          decision: kind,
          reason,
        },
      },
    });
    return check;
  }
}
