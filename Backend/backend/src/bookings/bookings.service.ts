import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../auth/auth.decorators.js';
import type { Page } from '../common/pagination.dto.js';
import { validationFailed } from '../common/validation-exception.js';
import {
  CreditService,
  type CreditFigures,
  type CreditOutcome,
} from '../credit/credit.service.js';
import {
  requireActiveCustomer,
  requirePartyWithRole,
} from '../parties/party-checks.js';
import { containsPattern } from '../parties/party-rules.js';
import { BILLING_VIEW } from '../parties/parties.service.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import {
  effectiveStatus,
  nairobiToday,
} from '../quotations/quotation-rules.js';
import { QuotationsService } from '../quotations/quotations.service.js';
import { ReferencesService } from '../references/references.service.js';
import {
  bookingActionProblem,
  plannedDatesProblem,
  type BookingAction,
} from './booking-rules.js';
import type {
  CancelBookingDto,
  ConvertQuotationDto,
  CreateBookingDto,
  ListBookingsQueryDto,
} from './bookings.dto.js';

type BookingInsert = {
  quotationId: number | null;
  customerId: number;
  agentId: number | null;
  mode: 'sea' | 'air' | 'road' | 'rail';
  direction: 'import' | 'export' | 'transit';
  origin: string;
  destination: string;
  cargoSummary: string;
};

/** Thrown after the transaction commits, so a "stop" decision stays recorded. */
function blockedError(figures: CreditFigures) {
  return new ConflictException({
    message:
      'The booking was not created: the decision to stop at the credit limit has been recorded.',
    details: [
      {
        field: 'creditDecision',
        messages: ['Stopped at the credit limit.'],
        decision: 'blocked',
        ...figures,
      },
    ],
  });
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly references: ReferencesService,
    private readonly credit: CreditService,
    private readonly quotations: QuotationsService,
  ) {}

  /** Converts an accepted quotation into its booking (at most one per quotation). */
  async convert(reference: string, dto: ConvertQuotationDto, user: Principal) {
    const plannedEtd = this.instant(dto.plannedEtd);
    const plannedEta = this.instant(dto.plannedEta);
    this.assertPlannedDates(plannedEtd, plannedEta);

    const result = await this.prisma.client.transaction(async (tx) => {
      const quotation = await this.quotations.lockForChange(tx, reference);
      if (await this.quotations.isBooked(tx, quotation.id)) {
        throw new ConflictException(
          'This quotation has already been converted to a booking.',
        );
      }
      const status = effectiveStatus(
        quotation.status,
        quotation.validUntil,
        nairobiToday(),
      );
      if (status !== 'accepted') {
        throw new ConflictException(
          `Only accepted quotations can be converted. This quotation is ${status}.`,
        );
      }
      await requireActiveCustomer(tx, quotation.customerId);
      if (dto.carrierId) {
        await requirePartyWithRole(tx, dto.carrierId, 'carrier', 'carrierId');
      }

      const total = (await this.quotations.totals([quotation.id], tx)).get(
        quotation.id,
      )!.total;
      const outcome = await this.credit.check(tx, {
        customerId: quotation.customerId,
        attemptedAmount: total,
        // Never null here: a quotation always has a total.
        amountField: 'lines',
        decision: dto.creditDecision,
        user,
      });
      if (outcome.kind === 'blocked') {
        await this.credit.record(tx, {
          customerId: quotation.customerId,
          bookingId: null,
          outcome,
          user,
        });
        return { kind: 'blocked' as const, figures: outcome.figures };
      }

      const booking = await this.insert(
        tx,
        {
          quotationId: quotation.id,
          customerId: quotation.customerId,
          agentId: quotation.agentId,
          mode: quotation.mode,
          direction: quotation.direction,
          origin: quotation.origin,
          destination: quotation.destination,
          cargoSummary: quotation.cargoSummary,
        },
        dto,
        plannedEtd,
        plannedEta,
        outcome,
        user,
      );
      await this.audit.record(tx, {
        actorUserId: user.id,
        entityType: 'Quotation',
        entityId: quotation.id,
        action: 'convert',
        summary: `${quotation.reference} converted to booking ${booking.reference}`,
        changes: {
          after: { bookingId: booking.id, booking: booking.reference },
        },
      });
      return { kind: 'created' as const, reference: booking.reference };
    });
    if (result.kind === 'blocked') throw blockedError(result.figures);
    return this.getOne(result.reference, user);
  }

  /** A booking agreed without a quotation. */
  async create(dto: CreateBookingDto, user: Principal) {
    const plannedEtd = this.instant(dto.plannedEtd);
    const plannedEta = this.instant(dto.plannedEta);
    this.assertPlannedDates(plannedEtd, plannedEta);
    if (dto.origin.toLowerCase() === dto.destination.toLowerCase()) {
      throw validationFailed([
        {
          field: 'destination',
          messages: ['Destination must be different from the origin.'],
        },
      ]);
    }

    const result = await this.prisma.client.transaction(async (tx) => {
      await requireActiveCustomer(tx, dto.customerId);
      if (dto.agentId) {
        await requirePartyWithRole(tx, dto.agentId, 'agent', 'agentId');
      }
      if (dto.carrierId) {
        await requirePartyWithRole(tx, dto.carrierId, 'carrier', 'carrierId');
      }
      const outcome = await this.credit.check(tx, {
        customerId: dto.customerId,
        attemptedAmount: dto.estimatedValue ?? null,
        amountField: 'estimatedValue',
        decision: dto.creditDecision,
        user,
      });
      if (outcome.kind === 'blocked') {
        await this.credit.record(tx, {
          customerId: dto.customerId,
          bookingId: null,
          outcome,
          user,
        });
        return { kind: 'blocked' as const, figures: outcome.figures };
      }
      const booking = await this.insert(
        tx,
        {
          quotationId: null,
          customerId: dto.customerId,
          agentId: dto.agentId ?? null,
          mode: dto.mode,
          direction: dto.direction,
          origin: dto.origin,
          destination: dto.destination,
          cargoSummary: dto.cargoSummary,
        },
        dto,
        plannedEtd,
        plannedEta,
        outcome,
        user,
      );
      return { kind: 'created' as const, reference: booking.reference };
    });
    if (result.kind === 'blocked') throw blockedError(result.figures);
    return this.getOne(result.reference, user);
  }

  confirm(reference: string, user: Principal) {
    return this.act(reference, 'confirm', user);
  }

  cancel(reference: string, dto: CancelBookingDto, user: Principal) {
    return this.act(reference, 'cancel', user, dto.reason);
  }

  async list(query: ListBookingsQueryDto, user: Principal) {
    const { client } = this.prisma;
    const status = query.status ?? '';
    const customerId = query.customerId ?? 0;
    const pattern = query.q ? containsPattern(query.q) : '';
    const plan = client.raw.sql`
      WITH matching AS (
        SELECT b.id, b."createdAt"
        FROM "Booking" b
        JOIN "Party" c ON c.id = b."customerId"
        LEFT JOIN "Quotation" q ON q.id = b."quotationId"
        WHERE (${status}::text = '' OR b.status = ${status}::text)
          AND (${customerId}::int = 0 OR b."customerId" = ${customerId}::int)
          AND (${pattern}::text = ''
                OR b.reference ILIKE ${pattern}::text
                OR q.reference ILIKE ${pattern}::text
                OR b.origin ILIKE ${pattern}::text
                OR b.destination ILIKE ${pattern}::text
                OR b."cargoSummary" ILIKE ${pattern}::text
                OR c.name ILIKE ${pattern}::text)
      )
      SELECT
        (SELECT COUNT(*)::int FROM matching) AS "total",
        COALESCE((
          SELECT json_agg(page.id)::text FROM (
            SELECT id FROM matching
            ORDER BY "createdAt" DESC, id DESC
            LIMIT ${query.limit}::int OFFSET ${query.offset}::int
          ) page
        ), '[]') AS "ids"
    `
      .returnsRow({ total: 'pg/int4@1', ids: 'pg/text@1' })
      .build();
    const [{ total, ids: idsJson }] = await client.runtime().query(plan);
    const ids = JSON.parse(idsJson) as number[];
    const items = await this.views(ids, user, false);
    return { items, total } satisfies Page<unknown>;
  }

  async getOne(reference: string, user: Principal) {
    const booking = await this.prisma.client.orm.public.Booking.where({
      reference,
    }).first();
    if (!booking) throw new NotFoundException('Record not found.');
    const [view] = await this.views([booking.id], user, true);
    return view;
  }

  private async insert(
    tx: Tx,
    fields: BookingInsert,
    extras: { carrierId?: number | null; carrierBookingNumber?: string | null },
    plannedEtd: Date | null,
    plannedEta: Date | null,
    outcome: CreditOutcome,
    user: Principal,
  ) {
    const bookings = tx.orm.public.Booking;
    const reference = await this.references.generate(tx, 'booking', {
      isTaken: async (candidate) =>
        (await bookings.where({ reference: candidate }).first()) !== null,
    });
    const now = new Date();
    const booking = await bookings.create({
      reference,
      ...fields,
      carrierId: extras.carrierId ?? null,
      carrierBookingNumber: extras.carrierBookingNumber ?? null,
      plannedEtd,
      plannedEta,
      status: 'pending',
      confirmedAt: null,
      cancelledAt: null,
      cancellationReason: null,
      createdById: user.id,
      createdAt: now,
      updatedAt: now,
    });
    if (outcome.kind === 'proceed') {
      await this.credit.record(tx, {
        customerId: fields.customerId,
        bookingId: booking.id,
        outcome,
        user,
      });
    }
    await this.audit.record(tx, {
      actorUserId: user.id,
      entityType: 'Booking',
      entityId: booking.id,
      action: 'create',
      summary: `${reference} created`,
      changes: JSON.parse(
        JSON.stringify({
          after: {
            ...fields,
            carrierId: booking.carrierId,
            carrierBookingNumber: booking.carrierBookingNumber,
            plannedEtd,
            plannedEta,
            creditOverride: outcome.kind === 'proceed',
          },
        }),
      ) as { readonly [key: string]: string },
    });
    return booking;
  }

  private async act(
    reference: string,
    action: BookingAction,
    user: Principal,
    reason?: string,
  ) {
    await this.prisma.client.transaction(async (tx) => {
      const [row] = await tx.query(
        this.prisma.client.raw.sql`
          SELECT id FROM "Booking" WHERE reference = ${reference}::text FOR UPDATE
        `
          .returnsRow({ id: 'pg/int4@1' })
          .build(),
      );
      if (!row) throw new NotFoundException('Record not found.');
      const before = (await tx.orm.public.Booking.first({ id: row.id }))!;
      const problem = bookingActionProblem(before.status, action);
      if (problem) throw new ConflictException(problem);
      const now = new Date();
      const patch =
        action === 'confirm'
          ? { status: 'confirmed' as const, confirmedAt: now }
          : {
              status: 'cancelled' as const,
              cancelledAt: now,
              cancellationReason: reason!,
            };
      await tx.orm.public.Booking.where({ id: before.id }).update({
        ...patch,
        updatedAt: now,
      });
      await this.audit.record(tx, {
        actorUserId: user.id,
        entityType: 'Booking',
        entityId: before.id,
        action,
        summary:
          action === 'confirm'
            ? `${reference} confirmed`
            : `${reference} cancelled: ${reason}`,
        changes: JSON.parse(
          JSON.stringify({ before: { status: before.status }, after: patch }),
        ) as { readonly [key: string]: string },
      });
    });
    return this.getOne(reference, user);
  }

  /** What a caller sees. Credit decisions appear only for callers who may view billing. */
  private async views(ids: number[], user: Principal, detail: boolean) {
    if (ids.length === 0) return [];
    const { orm } = this.prisma.client;
    const bookings = await orm.public.Booking.where((b) => b.id.in(ids)).all();
    const partyIds = [
      ...new Set(
        bookings.flatMap((b) =>
          [b.customerId, b.agentId, b.carrierId].filter(
            (id): id is number => id !== null,
          ),
        ),
      ),
    ];
    const quotationIds = bookings.flatMap((b) =>
      b.quotationId ? [b.quotationId] : [],
    );
    const showCredit = detail && user.permissions.includes(BILLING_VIEW);
    const [parties, quotations, checks] = await Promise.all([
      orm.public.Party.where((p) => p.id.in(partyIds)).all(),
      quotationIds.length
        ? orm.public.Quotation.where((q) => q.id.in(quotationIds)).all()
        : Promise.resolve([]),
      showCredit
        ? orm.public.CreditCheck.where((c) => c.bookingId.in(ids))
            .orderBy((c) => c.decidedAt.asc())
            .all()
        : Promise.resolve([]),
    ]);
    const userIds = [
      ...new Set([
        ...bookings.flatMap((b) => (b.createdById ? [b.createdById] : [])),
        ...checks.map((c) => c.decidedById),
      ]),
    ];
    const users = userIds.length
      ? await orm.public.User.where((u) => u.id.in(userIds)).all()
      : [];
    const party = (id: number | null) => {
      const found = id === null ? undefined : parties.find((p) => p.id === id);
      return found ? { id: found.id, name: found.name } : null;
    };
    const person = (id: number | null) => {
      const found = id === null ? undefined : users.find((u) => u.id === id);
      return found ? { id: found.id, name: found.name ?? found.email } : null;
    };
    const byId = new Map(bookings.map((b) => [b.id, b]));

    return ids.map((id) => {
      const b = byId.get(id)!;
      const quotation = quotations.find((q) => q.id === b.quotationId);
      return {
        id: b.id,
        reference: b.reference,
        status: b.status,
        quotation: quotation
          ? { id: quotation.id, reference: quotation.reference }
          : null,
        customer: party(b.customerId),
        agent: party(b.agentId),
        carrier: party(b.carrierId),
        carrierBookingNumber: b.carrierBookingNumber,
        mode: b.mode,
        direction: b.direction,
        origin: b.origin,
        destination: b.destination,
        cargoSummary: b.cargoSummary,
        plannedEtd: b.plannedEtd,
        plannedEta: b.plannedEta,
        confirmedAt: b.confirmedAt,
        cancelledAt: b.cancelledAt,
        cancellationReason: b.cancellationReason,
        createdBy: person(b.createdById),
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        ...(showCredit
          ? {
              creditChecks: checks
                .filter((c) => c.bookingId === id)
                .map((c) => ({
                  decision: c.decision,
                  reason: c.reason,
                  exposure: c.exposure,
                  creditLimit: c.creditLimit,
                  attemptedAmount: c.attemptedAmount,
                  decidedBy: person(c.decidedById),
                  decidedAt: c.decidedAt,
                })),
            }
          : {}),
      };
    });
  }

  private instant(value: string | null | undefined): Date | null {
    return value ? new Date(value) : null;
  }

  private assertPlannedDates(etd: Date | null, eta: Date | null) {
    const problem = plannedDatesProblem(etd, eta);
    if (problem) {
      throw validationFailed([{ field: 'plannedEta', messages: [problem] }]);
    }
  }
}
