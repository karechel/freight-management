import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Numeric } from '@prisma/orm-postgres/target/codec-types';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../auth/auth.decorators.js';
import { normalizeDecimal } from '../common/decimal-fields.js';
import type { Page } from '../common/pagination.dto.js';
import { validationFailed } from '../common/validation-exception.js';
import {
  requireActiveCustomer,
  requirePartyWithRole,
} from '../parties/party-checks.js';
import { containsPattern, newWorkBlock } from '../parties/party-rules.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { ReferencesService } from '../references/references.service.js';
import {
  effectiveStatus,
  headerProblems,
  issueAfterSentProblem,
  isCalendarDate,
  isEditable,
  lineProblems,
  nairobiToday,
  statusChangeProblems,
  totalProblem,
  transitionProblem,
  type FieldProblem,
  type QuotationStatus,
} from './quotation-rules.js';
import type {
  ChangeQuotationStatusDto,
  CreateQuotationDto,
  ListQuotationsQueryDto,
  QuotationLineDto,
  TaxCategory,
  UpdateQuotationDto,
} from './quotations.dto.js';

export const QUOTATIONS_VIEW = 'quotations.view';
/** Seeded as "Create and edit quotations and bookings". */
export const QUOTATIONS_MANAGE = 'quotations.manage';

type Quantity = Numeric<12, 3>;
type Money = Numeric<14, 2>;
type Percent = Numeric<5, 2>;

const quantity = (value: string) => normalizeDecimal(value, 3) as Quantity;
const money = (value: string) => normalizeDecimal(value, 2) as Money;
const percent = (value: string) => normalizeDecimal(value, 2) as Percent;
const optionalQuantity = (value: string | null | undefined) =>
  value == null ? null : quantity(value);

/** Header fields compared for the audit log on update. */
const HEADER_FIELDS = [
  'customerId',
  'agentId',
  'mode',
  'direction',
  'origin',
  'destination',
  'incoterm',
  'cargoSummary',
  'packages',
  'grossWeightKg',
  'volumeCbm',
  'terms',
  'internalNote',
  'issueDate',
  'validUntil',
] as const;

export interface QuotationTotals {
  subtotal: string;
  tax: string;
  total: string;
}

interface LineAmounts {
  net: string;
  tax: string;
  total: string;
}

const ZERO_TOTALS: QuotationTotals = {
  subtotal: '0.00',
  tax: '0.00',
  total: '0.00',
};

const idList = (ids: readonly number[]) => ids.join(',');

@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly references: ReferencesService,
  ) {}

  async list(query: ListQuotationsQueryDto) {
    const { client } = this.prisma;
    const today = nairobiToday();
    // Raw parameters cannot be null: an empty string or 0 means "no filter".
    const status = query.status ?? '';
    const customerId = query.customerId ?? 0;
    const agentId = query.agentId ?? 0;
    const pattern = query.q ? containsPattern(query.q) : '';

    const plan = client.raw.sql`
      WITH matching AS (
        SELECT q.id, q."issueDate"
        FROM "Quotation" q
        JOIN "Party" c ON c.id = q."customerId"
        WHERE (${customerId}::int = 0 OR q."customerId" = ${customerId}::int)
          AND (${agentId}::int = 0 OR q."agentId" = ${agentId}::int)
          AND (${status}::text = '' OR
                (CASE WHEN q.status IN ('draft', 'sent') AND q."validUntil" < ${today}::date
                      THEN 'expired' ELSE q.status END) = ${status}::text)
          AND (${pattern}::text = ''
                OR q.reference ILIKE ${pattern}::text
                OR q.origin ILIKE ${pattern}::text
                OR q.destination ILIKE ${pattern}::text
                OR q."cargoSummary" ILIKE ${pattern}::text
                OR c.name ILIKE ${pattern}::text)
      )
      SELECT
        (SELECT COUNT(*)::int FROM matching) AS "total",
        COALESCE((
          SELECT json_agg(page.id)::text FROM (
            SELECT id FROM matching
            ORDER BY "issueDate" DESC, id DESC
            LIMIT ${query.limit}::int OFFSET ${query.offset}::int
          ) page
        ), '[]') AS "ids"
    `
      .returnsRow({ total: 'pg/int4@1', ids: 'pg/text@1' })
      .build();
    const [{ total, ids: idsJson }] = await client.runtime().query(plan);
    const ids = JSON.parse(idsJson) as number[];
    const views = await this.views(ids, false);
    return { items: views, total } satisfies Page<unknown>;
  }

  async getOne(reference: string) {
    const quotation = await this.prisma.client.orm.public.Quotation.where({
      reference,
    }).first();
    if (!quotation) throw new NotFoundException('Record not found.');
    const [view] = await this.views([quotation.id], true);
    return view;
  }

  async create(dto: CreateQuotationDto, user: Principal) {
    const today = nairobiToday();
    this.assertValid([
      ...this.dateProblems(dto),
      ...(this.datesValid(dto)
        ? headerProblems(
            {
              origin: dto.origin,
              destination: dto.destination,
              issueDate: dto.issueDate,
              validUntil: dto.validUntil,
            },
            today,
          )
        : []),
      ...lineProblems(dto.lines),
    ]);

    const reference = await this.prisma.client.transaction(async (tx) => {
      await requireActiveCustomer(tx, dto.customerId);
      if (dto.agentId) {
        await requirePartyWithRole(tx, dto.agentId, 'agent', 'agentId');
      }
      const duplicatedFromId = await this.duplicatedFromId(
        tx,
        dto.duplicatedFrom,
      );
      const lines = await this.resolveLines(tx, dto.lines);

      const quotations = tx.orm.public.Quotation;
      const reference = await this.references.generate(tx, 'quotation', {
        isTaken: async (candidate) =>
          (await quotations.where({ reference: candidate }).first()) !== null,
      });
      const now = new Date();
      const quotation = await quotations.create({
        reference,
        customerId: dto.customerId,
        agentId: dto.agentId ?? null,
        mode: dto.mode,
        direction: dto.direction,
        origin: dto.origin,
        destination: dto.destination,
        incoterm: dto.incoterm ?? null,
        cargoSummary: dto.cargoSummary,
        packages: dto.packages ?? null,
        grossWeightKg: optionalQuantity(dto.grossWeightKg),
        volumeCbm: optionalQuantity(dto.volumeCbm),
        terms: dto.terms ?? null,
        internalNote: dto.internalNote ?? null,
        status: 'draft',
        issueDate: dto.issueDate,
        validUntil: dto.validUntil,
        sentAt: null,
        sentTo: null,
        decidedAt: null,
        duplicatedFromId,
        preparedById: user.id,
        createdAt: now,
        updatedAt: now,
      });
      await this.insertLines(tx, quotation.id, lines);
      const totals = await this.assertTotal(tx, quotation.id);

      await this.audit.record(tx, {
        actorUserId: user.id,
        entityType: 'Quotation',
        entityId: quotation.id,
        action: duplicatedFromId ? 'duplicate' : 'create',
        summary: duplicatedFromId
          ? `${reference} created as a copy of ${dto.duplicatedFrom}`
          : `${reference} created`,
        changes: {
          after: {
            ...this.headerSnapshot(quotation),
            lines: lines.map((line) => this.lineSnapshot(line)),
            total: totals.total,
          },
        },
      });
      return reference;
    });
    return this.getOne(reference);
  }

  async update(reference: string, dto: UpdateQuotationDto, user: Principal) {
    await this.prisma.client.transaction(async (tx) => {
      const before = await this.lockForChange(tx, reference);
      const status = effectiveStatus(
        before.status,
        before.validUntil,
        nairobiToday(),
      );
      if (!isEditable(status, await this.isBooked(tx, before.id))) {
        throw new ConflictException(
          status === 'expired'
            ? 'This quotation has expired. Duplicate it as a new draft to quote again.'
            : 'Only draft and sent quotations can be edited. Duplicate it to quote again.',
        );
      }

      const merged = {
        origin: dto.origin ?? before.origin,
        destination: dto.destination ?? before.destination,
        issueDate: dto.issueDate ?? before.issueDate,
        validUntil: dto.validUntil ?? before.validUntil,
      };
      this.assertValid([
        ...this.dateProblems(merged),
        ...(this.datesValid(merged)
          ? [
              ...headerProblems(merged, nairobiToday()),
              ...[
                issueAfterSentProblem(merged.issueDate, before.sentAt),
              ].filter((problem) => problem !== null),
            ]
          : []),
        ...(dto.lines ? lineProblems(dto.lines) : []),
      ]);

      // Moving a quotation to another customer is new work for that customer.
      if (
        dto.customerId !== undefined &&
        dto.customerId !== before.customerId
      ) {
        await requireActiveCustomer(tx, dto.customerId);
      }
      if (dto.agentId && dto.agentId !== before.agentId) {
        await requirePartyWithRole(tx, dto.agentId, 'agent', 'agentId');
      }

      const patch = {
        ...(dto.customerId === undefined ? {} : { customerId: dto.customerId }),
        ...(dto.agentId === undefined ? {} : { agentId: dto.agentId }),
        ...(dto.mode === undefined ? {} : { mode: dto.mode }),
        ...(dto.direction === undefined ? {} : { direction: dto.direction }),
        ...(dto.origin === undefined ? {} : { origin: dto.origin }),
        ...(dto.destination === undefined
          ? {}
          : { destination: dto.destination }),
        ...(dto.incoterm === undefined ? {} : { incoterm: dto.incoterm }),
        ...(dto.cargoSummary === undefined
          ? {}
          : { cargoSummary: dto.cargoSummary }),
        ...(dto.packages === undefined ? {} : { packages: dto.packages }),
        ...(dto.grossWeightKg === undefined
          ? {}
          : { grossWeightKg: optionalQuantity(dto.grossWeightKg) }),
        ...(dto.volumeCbm === undefined
          ? {}
          : { volumeCbm: optionalQuantity(dto.volumeCbm) }),
        ...(dto.terms === undefined ? {} : { terms: dto.terms }),
        ...(dto.internalNote === undefined
          ? {}
          : { internalNote: dto.internalNote }),
        ...(dto.issueDate === undefined ? {} : { issueDate: dto.issueDate }),
        ...(dto.validUntil === undefined ? {} : { validUntil: dto.validUntil }),
      };
      const was: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      for (const field of HEADER_FIELDS) {
        if (field in patch) {
          const next = (patch as Record<string, unknown>)[field];
          if (next !== before[field]) {
            was[field] = before[field];
            after[field] = next;
          }
        }
      }

      let linesBefore: ReturnType<typeof this.lineSnapshot>[] | undefined;
      let linesAfter: ReturnType<typeof this.lineSnapshot>[] | undefined;
      if (dto.lines) {
        const resolved = await this.resolveLines(tx, dto.lines);
        const existing = await tx.orm.public.QuotationLine.where({
          quotationId: before.id,
        })
          .orderBy((l) => l.sortOrder.asc())
          .all();
        linesBefore = existing.map((line) => this.lineSnapshot(line));
        linesAfter = resolved.map((line) => this.lineSnapshot(line));
        await tx.orm.public.QuotationLine.where({
          quotationId: before.id,
        }).deleteAll();
        await this.insertLines(tx, before.id, resolved);
      }
      if (Object.keys(after).length === 0 && !dto.lines) return;

      await tx.orm.public.Quotation.where({ id: before.id }).update({
        ...patch,
        updatedAt: new Date(),
      });
      const totals = await this.assertTotal(tx, before.id);
      await this.audit.record(tx, {
        actorUserId: user.id,
        entityType: 'Quotation',
        entityId: before.id,
        action: 'update',
        summary: `${reference} updated`,
        changes: this.json({
          before: { ...was, ...(linesBefore ? { lines: linesBefore } : {}) },
          after: {
            ...after,
            ...(linesAfter ? { lines: linesAfter } : {}),
            total: totals.total,
          },
        }),
      });
    });
    return this.getOne(reference);
  }

  async changeStatus(
    reference: string,
    dto: ChangeQuotationStatusDto,
    user: Principal,
  ) {
    await this.prisma.client.transaction(async (tx) => {
      const before = await this.lockForChange(tx, reference);
      const current = effectiveStatus(
        before.status,
        before.validUntil,
        nairobiToday(),
      );
      const problem = transitionProblem(
        current,
        dto.status,
        await this.isBooked(tx, before.id),
      );
      if (problem) {
        throw new ConflictException({
          message: problem,
          details: [{ field: 'status', messages: [problem] }],
        });
      }
      const sentAt = dto.sentAt ? new Date(dto.sentAt) : undefined;
      const decidedAt = dto.decidedAt ? new Date(dto.decidedAt) : undefined;
      this.assertValid(
        statusChangeProblems(
          { issueDate: before.issueDate, sentAt: before.sentAt },
          {
            status: dto.status,
            sentAt,
            sentTo: dto.sentTo ?? undefined,
            decidedAt,
          },
          new Date(),
        ),
      );

      const patch =
        dto.status === 'sent'
          ? { status: dto.status, sentAt: sentAt!, sentTo: dto.sentTo! }
          : { status: dto.status, decidedAt: decidedAt! };
      await tx.orm.public.Quotation.where({ id: before.id }).update({
        ...patch,
        updatedAt: new Date(),
      });
      await this.audit.record(tx, {
        actorUserId: user.id,
        entityType: 'Quotation',
        entityId: before.id,
        action: 'status_change',
        summary: `${reference} marked ${dto.status}${dto.note ? `: ${dto.note}` : ''}`,
        changes: this.json({
          before: { status: before.status },
          after: { ...patch, ...(dto.note ? { note: dto.note } : {}) },
        }),
      });
    });
    return this.getOne(reference);
  }

  /**
   * Locks the quotation row until the transaction ends, so concurrent edits, status changes and
   * conversions of the same quotation run one at a time.
   */
  async lockForChange(tx: Tx, reference: string) {
    const [row] = await tx.query(
      this.prisma.client.raw.sql`
        SELECT id FROM "Quotation" WHERE reference = ${reference}::text FOR UPDATE
      `
        .returnsRow({ id: 'pg/int4@1' })
        .build(),
    );
    if (!row) throw new NotFoundException('Record not found.');
    return (await tx.orm.public.Quotation.first({ id: row.id }))!;
  }

  async isBooked(tx: Tx, quotationId: number): Promise<boolean> {
    return (
      (await tx.orm.public.Booking.where({ quotationId }).first()) !== null
    );
  }

  /** Totals calculated in SQL, inside the caller's transaction when one is given. */
  async totals(
    ids: readonly number[],
    tx?: Tx,
  ): Promise<Map<number, QuotationTotals>> {
    if (ids.length === 0) return new Map();
    const plan = this.prisma.client.raw.sql`
      SELECT
        q.id AS "quotationId",
        COALESCE(SUM(l.net), 0::numeric(14, 2))::text AS "subtotal",
        COALESCE(SUM(l.tax), 0::numeric(14, 2))::text AS "tax",
        COALESCE(SUM(l.net + l.tax), 0::numeric(14, 2))::text AS "total"
      FROM "Quotation" q
      LEFT JOIN LATERAL (
        SELECT a.net, round(a.net * ql."taxRate" / 100, 2) AS tax
        FROM "QuotationLine" ql
        CROSS JOIN LATERAL (SELECT round(ql.quantity * ql."unitPrice", 2) AS net) a
        WHERE ql."quotationId" = q.id
      ) l ON true
      WHERE q.id = ANY (string_to_array(${idList(ids)}::text, ',')::int[])
      GROUP BY q.id
    `
      .returnsRow({
        quotationId: 'pg/int4@1',
        subtotal: 'pg/text@1',
        tax: 'pg/text@1',
        total: 'pg/text@1',
      })
      .build();
    const rows = tx
      ? await tx.query(plan)
      : await this.prisma.client.runtime().query(plan);
    return new Map(
      rows.map(({ quotationId, ...totals }) => [quotationId, totals]),
    );
  }

  private async lineAmounts(
    quotationIds: readonly number[],
  ): Promise<Map<number, LineAmounts>> {
    if (quotationIds.length === 0) return new Map();
    const plan = this.prisma.client.raw.sql`
      SELECT
        ql.id AS "lineId",
        a.net::text AS "net",
        t.tax::text AS "tax",
        (a.net + t.tax)::text AS "total"
      FROM "QuotationLine" ql
      CROSS JOIN LATERAL (SELECT round(ql.quantity * ql."unitPrice", 2) AS net) a
      CROSS JOIN LATERAL (SELECT round(a.net * ql."taxRate" / 100, 2) AS tax) t
      WHERE ql."quotationId" = ANY (string_to_array(${idList(quotationIds)}::text, ',')::int[])
    `
      .returnsRow({
        lineId: 'pg/int4@1',
        net: 'pg/text@1',
        tax: 'pg/text@1',
        total: 'pg/text@1',
      })
      .build();
    const rows = await this.prisma.client.runtime().query(plan);
    return new Map(rows.map(({ lineId, ...amounts }) => [lineId, amounts]));
  }

  /** What a caller sees. Lines are included on the detail view only. */
  private async views(ids: number[], withLines: boolean) {
    if (ids.length === 0) return [];
    const { orm } = this.prisma.client;
    const today = nairobiToday();
    const quotations = await orm.public.Quotation.where((q) =>
      q.id.in(ids),
    ).all();
    const partyIds = [
      ...new Set(
        quotations.flatMap((q) =>
          q.agentId ? [q.customerId, q.agentId] : [q.customerId],
        ),
      ),
    ];
    const userIds = [
      ...new Set(
        quotations.flatMap((q) => (q.preparedById ? [q.preparedById] : [])),
      ),
    ];
    const copiedIds = [
      ...new Set(
        quotations.flatMap((q) =>
          q.duplicatedFromId ? [q.duplicatedFromId] : [],
        ),
      ),
    ];
    const [parties, users, bookings, copied, totals, lines] = await Promise.all(
      [
        orm.public.Party.where((p) => p.id.in(partyIds)).all(),
        userIds.length
          ? orm.public.User.where((u) => u.id.in(userIds)).all()
          : Promise.resolve([]),
        orm.public.Booking.where((b) => b.quotationId.in(ids)).all(),
        copiedIds.length
          ? orm.public.Quotation.where((q) => q.id.in(copiedIds)).all()
          : Promise.resolve([]),
        this.totals(ids),
        withLines
          ? orm.public.QuotationLine.where((l) => l.quotationId.in(ids))
              .orderBy((l) => l.sortOrder.asc())
              .all()
          : Promise.resolve([]),
      ],
    );
    const amounts = withLines ? await this.lineAmounts(ids) : new Map();
    const party = (id: number | null) => {
      const found = id === null ? undefined : parties.find((p) => p.id === id);
      return found ? { id: found.id, name: found.name } : null;
    };
    const blockOf = (id: number) => {
      const found = parties.find((p) => p.id === id);
      return found ? newWorkBlock(found) : null;
    };
    const byId = new Map(quotations.map((q) => [q.id, q]));

    return ids.map((id) => {
      const q = byId.get(id)!;
      const booking = bookings.find((b) => b.quotationId === id);
      const source = copied.find((c) => c.id === q.duplicatedFromId);
      const preparedBy = users.find((u) => u.id === q.preparedById);
      const status: QuotationStatus = effectiveStatus(
        q.status,
        q.validUntil,
        today,
      );
      return {
        id: q.id,
        reference: q.reference,
        status,
        storedStatus: q.status,
        editable: isEditable(status, booking !== undefined),
        customer: party(q.customerId),
        // Why the customer cannot receive new work (a booking from this quotation), or null.
        customerNewWorkBlock: blockOf(q.customerId),
        agent: party(q.agentId),
        mode: q.mode,
        direction: q.direction,
        origin: q.origin,
        destination: q.destination,
        incoterm: q.incoterm,
        cargoSummary: q.cargoSummary,
        packages: q.packages,
        grossWeightKg: q.grossWeightKg,
        volumeCbm: q.volumeCbm,
        terms: q.terms,
        internalNote: q.internalNote,
        currency: 'KES' as const,
        issueDate: q.issueDate,
        validUntil: q.validUntil,
        sentAt: q.sentAt,
        sentTo: q.sentTo,
        decidedAt: q.decidedAt,
        duplicatedFrom: source
          ? { id: source.id, reference: source.reference }
          : null,
        preparedBy: preparedBy
          ? { id: preparedBy.id, name: preparedBy.name ?? preparedBy.email }
          : null,
        booking: booking
          ? {
              id: booking.id,
              reference: booking.reference,
              status: booking.status,
            }
          : null,
        totals: totals.get(id) ?? ZERO_TOTALS,
        ...(withLines
          ? {
              lines: lines
                .filter((line) => line.quotationId === id)
                .map((line) => ({
                  id: line.id,
                  chargeTypeId: line.chargeTypeId,
                  description: line.description,
                  quantity: line.quantity,
                  unitPrice: line.unitPrice,
                  taxCategory: line.taxCategory,
                  taxRate: line.taxRate,
                  sortOrder: line.sortOrder,
                  amounts: amounts.get(line.id) ?? {
                    net: '0.00',
                    tax: '0.00',
                    total: '0.00',
                  },
                })),
            }
          : {}),
        createdAt: q.createdAt,
        updatedAt: q.updatedAt,
      };
    });
  }

  /** Checks charge types and fills in the default tax category. */
  private async resolveLines(tx: Tx, lines: readonly QuotationLineDto[]) {
    const chargeTypeIds = [
      ...new Set(
        lines.flatMap((l) => (l.chargeTypeId ? [l.chargeTypeId] : [])),
      ),
    ];
    const chargeTypes = chargeTypeIds.length
      ? await tx.orm.public.ChargeType.where((c) =>
          c.id.in(chargeTypeIds),
        ).all()
      : [];
    const problems: FieldProblem[] = [];
    const resolved = lines.map((line, index) => {
      const chargeType = line.chargeTypeId
        ? chargeTypes.find((c) => c.id === line.chargeTypeId)
        : undefined;
      if (line.chargeTypeId && (!chargeType || !chargeType.isActive)) {
        problems.push({
          field: `lines.${index}.chargeTypeId`,
          messages: ['Select an active charge type.'],
        });
      }
      const taxCategory: TaxCategory =
        line.taxCategory ?? chargeType?.defaultTaxCategory ?? 'standard';
      return {
        chargeTypeId: line.chargeTypeId ?? null,
        description: line.description,
        quantity: quantity(line.quantity),
        unitPrice: money(line.unitPrice),
        taxCategory,
        taxRate: percent(line.taxRate),
        sortOrder: index,
      };
    });
    this.assertValid(problems);
    return resolved;
  }

  private async insertLines(
    tx: Tx,
    quotationId: number,
    lines: Awaited<ReturnType<typeof this.resolveLines>>,
  ) {
    for (const line of lines) {
      await tx.orm.public.QuotationLine.create({ quotationId, ...line });
    }
  }

  /** The total must be above zero and fit the money columns; checked after lines are saved. */
  private async assertTotal(tx: Tx, quotationId: number) {
    const totals = (await this.totals([quotationId], tx)).get(quotationId)!;
    const problem = totalProblem(totals.total);
    if (problem) this.assertValid([problem]);
    return totals;
  }

  private async duplicatedFromId(
    tx: Tx,
    reference: string | undefined,
  ): Promise<number | null> {
    if (!reference) return null;
    const source = await tx.orm.public.Quotation.where({ reference }).first();
    if (!source) {
      throw validationFailed([
        {
          field: 'duplicatedFrom',
          messages: ['No quotation has this reference.'],
        },
      ]);
    }
    return source.id;
  }

  private dateProblems(dates: {
    issueDate: string;
    validUntil: string;
  }): FieldProblem[] {
    return (['issueDate', 'validUntil'] as const).flatMap((field) =>
      isCalendarDate(dates[field])
        ? []
        : [{ field, messages: ['Enter a valid date.'] }],
    );
  }

  private datesValid(dates: { issueDate: string; validUntil: string }) {
    return this.dateProblems(dates).length === 0;
  }

  private assertValid(problems: FieldProblem[]): void {
    if (problems.length > 0) throw validationFailed(problems);
  }

  private headerSnapshot(q: {
    [K in (typeof HEADER_FIELDS)[number]]: unknown;
  }) {
    const snapshot: Record<string, unknown> = {};
    for (const field of HEADER_FIELDS) snapshot[field] = q[field];
    return this.json(snapshot);
  }

  private lineSnapshot(line: {
    chargeTypeId: number | null;
    description: string;
    quantity: string;
    unitPrice: string;
    taxCategory: string;
    taxRate: string;
  }) {
    return {
      chargeTypeId: line.chargeTypeId,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxCategory: line.taxCategory,
      taxRate: line.taxRate,
    };
  }

  /** Plain JSON for the audit log (dates become ISO strings). */
  private json<T>(value: T) {
    return JSON.parse(JSON.stringify(value)) as {
      readonly [key: string]: string | number | boolean | null;
    };
  }
}
