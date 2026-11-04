import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { Numeric } from '@prisma/orm-postgres/target/codec-types';
import type { Scalars } from '@prisma/orm-postgres/family-contract/types';
import type { Principal } from '../auth/auth.decorators.js';
import type { Page } from '../common/pagination.dto.js';
import { validationFailed } from '../common/validation-exception.js';
import type { Models } from '../prisma/contract.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import type {
  CreateContactDto,
  CreatePartyDto,
  ListPartiesQueryDto,
  PartyAccountStatus,
  PartyRole,
  UpdateContactDto,
  UpdatePartyDto,
} from './parties.dto.js';
import { containsPattern, normalizeMoney } from './party-rules.js';

export const PARTIES_VIEW = 'parties.view';
export const PARTIES_MANAGE = 'parties.manage';
export const BILLING_VIEW = 'parties.billing.view';
export const BILLING_MANAGE = 'parties.billing.manage';
export const STATUS_MANAGE = 'parties.status.manage';

const DETAIL_FIELDS = [
  'name',
  'legalName',
  'kraPin',
  'email',
  'phone',
  'address',
  'city',
  'country',
  'notes',
] as const;
const BILLING_FIELDS = ['paymentTermsDays', 'creditLimit'] as const;
const CONTACT_FIELDS = ['name', 'title', 'email', 'phone'] as const;

export interface PartyFigures {
  shipments: { active: number; total: number };
  quotations: { open: number; total: number };
}

/** Calculated in SQL. Issued invoices only; bounced and cancelled payments do not count. */
export interface PartyAccount {
  invoiced: string;
  credited: string;
  paid: string;
  outstanding: string;
  overdue: string;
  overdueInvoices: number;
  /** Null when no credit limit is recorded. Negative when the customer is over their limit. */
  availableCredit: string | null;
}

interface FiguresRow extends PartyFigures {
  account: PartyAccount;
}

type PartyRow = Scalars<Models.public_Party>;
type ContactRow = Scalars<Models.public_Contact>;
type Money = Numeric<14, 2>;

const money = (value: string) => normalizeMoney(value) as Money;

function contactView(contact: ContactRow) {
  return {
    id: contact.id,
    name: contact.name,
    title: contact.title,
    email: contact.email,
    phone: contact.phone,
    isPrimary: contact.isPrimary,
  };
}

/** What a caller sees. Billing appears only for callers allowed to view it. */
function partyView(
  party: PartyRow,
  roles: string[],
  figures: FiguresRow,
  user: Principal,
) {
  return {
    id: party.id,
    name: party.name,
    legalName: party.legalName,
    kraPin: party.kraPin,
    email: party.email,
    phone: party.phone,
    address: party.address,
    city: party.city,
    country: party.country,
    notes: party.notes,
    accountStatus: party.accountStatus,
    archivedAt: party.archivedAt,
    createdAt: party.createdAt,
    updatedAt: party.updatedAt,
    roles,
    shipments: figures.shipments,
    quotations: figures.quotations,
    ...(user.permissions.includes(BILLING_VIEW)
      ? {
          billing: {
            paymentTermsDays: party.paymentTermsDays,
            creditLimit: party.creditLimit,
            account: figures.account,
          },
        }
      : {}),
  };
}

/** Only the fields actually sent, with before and after values for those that differ. */
function changedFields<T extends object>(
  before: T,
  patch: Partial<T>,
): { after: Partial<T>; was: Partial<T> } {
  const after: Partial<T> = {};
  const was: Partial<T> = {};
  for (const key of Object.keys(patch) as (keyof T)[]) {
    if (patch[key] !== before[key]) {
      after[key] = patch[key];
      was[key] = before[key];
    }
  }
  return { after, was };
}

function pick<T extends object, K extends keyof T>(
  source: T,
  fields: readonly K[],
): Partial<Pick<T, K>> {
  const result: Partial<Pick<T, K>> = {};
  for (const field of fields) {
    if (source[field] !== undefined) result[field] = source[field];
  }
  return result;
}

@Injectable()
export class PartiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    query: ListPartiesQueryDto,
    user: Principal,
  ): Promise<Page<ReturnType<typeof partyView> & { primaryContact: unknown }>> {
    const { client } = this.prisma;
    // Raw parameters cannot be null, so an empty string means "no filter".
    const role = query.role ?? '';
    const status = query.status ?? '';
    const archived = query.archived;
    const pattern = query.q ? containsPattern(query.q) : '';

    // One row always comes back, so the total is right even for a page past the end.
    const plan = client.raw.sql`
      WITH matching AS (
        SELECT p.id, p.name
        FROM "Party" p
        WHERE (${role}::text = '' OR EXISTS (
                SELECT 1 FROM "PartyRole" r
                WHERE r."partyId" = p.id AND r.role = ${role}::text))
          AND (${status}::text = '' OR p."accountStatus" = ${status}::text)
          AND (${archived}::text = 'include'
                OR (${archived}::text = 'only' AND p."archivedAt" IS NOT NULL)
                OR (${archived}::text = 'exclude' AND p."archivedAt" IS NULL))
          AND (${pattern}::text = ''
                OR p.name ILIKE ${pattern}::text
                OR p."legalName" ILIKE ${pattern}::text
                OR p."kraPin" ILIKE ${pattern}::text
                OR p.email ILIKE ${pattern}::text
                OR p.phone ILIKE ${pattern}::text
                OR p.city ILIKE ${pattern}::text
                OR EXISTS (
                  SELECT 1 FROM "Contact" c
                  WHERE c."partyId" = p.id
                    AND (c.name ILIKE ${pattern}::text OR c.email ILIKE ${pattern}::text)))
      )
      SELECT
        (SELECT COUNT(*)::int FROM matching) AS "total",
        COALESCE((
          SELECT json_agg(page.id)::text FROM (
            SELECT id FROM matching
            ORDER BY lower(name), id
            LIMIT ${query.limit}::int OFFSET ${query.offset}::int
          ) page
        ), '[]') AS "ids"
    `
      .returnsRow({ total: 'pg/int4@1', ids: 'pg/text@1' })
      .build();
    const [{ total, ids: idsJson }] = await client.runtime().query(plan);
    const ids = JSON.parse(idsJson) as number[];
    if (ids.length === 0) return { items: [], total };

    const parties = await client.orm.public.Party.where((p) =>
      p.id.in(ids),
    ).all();
    const [roles, primaries, figures] = await Promise.all([
      this.rolesByParty(ids),
      client.orm.public.Contact.where((c) => c.partyId.in(ids))
        .where({ isPrimary: true })
        .all(),
      this.figures(ids),
    ]);
    const byId = new Map(parties.map((party) => [party.id, party]));
    return {
      items: ids.map((id) => {
        const primary = primaries.find((c) => c.partyId === id);
        return {
          ...partyView(
            byId.get(id)!,
            roles.get(id) ?? [],
            figures.get(id)!,
            user,
          ),
          primaryContact: primary ? contactView(primary) : null,
        };
      }),
      total,
    };
  }

  async getOne(id: number, user: Principal) {
    const { orm } = this.prisma.client;
    const party = await orm.public.Party.first({ id });
    if (!party) throw new NotFoundException('Record not found.');
    const [roles, contacts, figures] = await Promise.all([
      this.rolesByParty([id]),
      orm.public.Contact.where({ partyId: id })
        .orderBy((c) => c.name.asc())
        .all(),
      this.figures([id]),
    ]);
    return {
      ...partyView(party, roles.get(id) ?? [], figures.get(id)!, user),
      // Primary first; the sort keeps the rest in name order.
      contacts: contacts
        .map(contactView)
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)),
    };
  }

  async create(dto: CreatePartyDto, user: Principal) {
    this.assertBillingAllowed(dto, user);
    const id = await this.prisma.client.transaction(async (tx) => {
      const kraPin = dto.kraPin ?? null;
      await this.assertKraPinFree(tx, kraPin);
      const now = new Date();
      const party = await tx.orm.public.Party.create({
        name: dto.name,
        legalName: dto.legalName ?? null,
        kraPin,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        address: dto.address ?? null,
        city: dto.city ?? null,
        country: dto.country ?? null,
        notes: dto.notes ?? null,
        paymentTermsDays: dto.paymentTermsDays ?? null,
        creditLimit: dto.creditLimit == null ? null : money(dto.creditLimit),
        accountStatus: dto.accountStatus ?? 'active',
        archivedAt: null,
        createdById: user.id,
        createdAt: now,
        updatedAt: now,
      });
      for (const role of dto.roles) {
        await tx.orm.public.PartyRole.create({ partyId: party.id, role });
      }
      await this.audit.record(tx, {
        actorUserId: user.id,
        entityType: 'Party',
        entityId: party.id,
        action: 'create',
        summary: `${party.name} created`,
        changes: {
          after: {
            ...this.auditable(pick(dto, DETAIL_FIELDS)),
            ...this.auditable(pick(dto, BILLING_FIELDS)),
            ...this.auditable(pick(dto, ['accountStatus'])),
            roles: dto.roles,
          },
        },
      });
      return party.id;
    });
    return this.getOne(id, user);
  }

  async update(id: number, dto: UpdatePartyDto, user: Principal) {
    const details = pick(dto, DETAIL_FIELDS);
    const billing = pick(dto, BILLING_FIELDS);
    if (
      ![PARTIES_MANAGE, BILLING_MANAGE, STATUS_MANAGE].some((code) =>
        user.permissions.includes(code),
      )
    ) {
      throw new ForbiddenException('You do not have permission to do this.');
    }
    if (
      Object.keys(details).length > 0 &&
      !user.permissions.includes(PARTIES_MANAGE)
    ) {
      throw new ForbiddenException('You cannot change company details.');
    }
    this.assertBillingAllowed(dto, user);

    const { creditLimit, ...otherBilling } = billing;
    const patch = {
      ...details,
      ...otherBilling,
      ...pick(dto, ['accountStatus']),
      ...(creditLimit === undefined
        ? {}
        : { creditLimit: creditLimit === null ? null : money(creditLimit) }),
    };
    await this.prisma.client.transaction(async (tx) => {
      const before = await this.requireEditable(tx, id);
      const { after, was } = changedFields(before, patch);
      if (Object.keys(after).length === 0) return;
      if (after.kraPin) await this.assertKraPinFree(tx, after.kraPin, id);
      await tx.orm.public.Party.where({ id }).update({
        ...after,
        updatedAt: new Date(),
      });
      await this.audit.record(tx, {
        actorUserId: user.id,
        entityType: 'Party',
        entityId: id,
        action: 'update',
        summary: `${before.name} updated`,
        changes: {
          before: this.auditable(was),
          after: this.auditable(after),
        },
      });
    });
    return this.getOne(id, user);
  }

  archive(id: number, user: Principal) {
    return this.setArchived(id, user, true);
  }

  restore(id: number, user: Principal) {
    return this.setArchived(id, user, false);
  }

  private async setArchived(id: number, user: Principal, archive: boolean) {
    await this.prisma.client.transaction(async (tx) => {
      const party = await tx.orm.public.Party.first({ id });
      if (!party) throw new NotFoundException('Record not found.');
      if ((party.archivedAt !== null) === archive) {
        throw new ConflictException(
          archive
            ? 'This record is already archived.'
            : 'This record is not archived.',
        );
      }
      if (archive) {
        const active = await tx.orm.public.Shipment.where({ customerId: id })
          .where((s) => s.status.neq('delivered'))
          .first();
        if (active) {
          throw new ConflictException(
            'This customer has active shipments. They can be archived once every shipment is delivered.',
          );
        }
      }
      const now = new Date();
      await tx.orm.public.Party.where({ id }).update({
        archivedAt: archive ? now : null,
        updatedAt: now,
      });
      await this.audit.record(tx, {
        actorUserId: user.id,
        entityType: 'Party',
        entityId: id,
        action: archive ? 'archive' : 'restore',
        summary: `${party.name} ${archive ? 'archived' : 'restored'}`,
      });
    });
    return this.getOne(id, user);
  }

  async addContact(partyId: number, dto: CreateContactDto, user: Principal) {
    return this.prisma.client.transaction(async (tx) => {
      await this.lockEditable(tx, partyId);
      const contacts = tx.orm.public.Contact;
      const hasContacts = (await contacts.where({ partyId }).first()) !== null;
      // A party's first contact is always its primary contact.
      const isPrimary = dto.isPrimary === true || !hasContacts;
      if (isPrimary) await this.clearPrimary(tx, partyId);
      const now = new Date();
      const contact = await contacts.create({
        partyId,
        name: dto.name,
        title: dto.title ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        isPrimary,
        createdAt: now,
        updatedAt: now,
      });
      await this.audit.record(tx, {
        actorUserId: user.id,
        entityType: 'Contact',
        entityId: contact.id,
        action: 'create',
        summary: `Contact ${contact.name} added to party ${partyId}`,
        changes: { after: contactView(contact) },
      });
      return contactView(contact);
    });
  }

  async updateContact(
    partyId: number,
    contactId: number,
    dto: UpdateContactDto,
    user: Principal,
  ) {
    return this.prisma.client.transaction(async (tx) => {
      await this.lockEditable(tx, partyId);
      const before = await this.requireContact(tx, partyId, contactId);
      if (dto.isPrimary === false && before.isPrimary) {
        throw validationFailed([
          {
            field: 'isPrimary',
            messages: ['Choose another primary contact instead.'],
          },
        ]);
      }
      const patch = {
        ...pick(dto, CONTACT_FIELDS),
        ...(dto.isPrimary === undefined ? {} : { isPrimary: dto.isPrimary }),
      };
      const { after, was } = changedFields(before, patch);
      if (Object.keys(after).length === 0) return contactView(before);
      if (after.isPrimary) await this.clearPrimary(tx, partyId);
      const saved = await tx.orm.public.Contact.where({ id: contactId }).update(
        { ...after, updatedAt: new Date() },
      );
      await this.audit.record(tx, {
        actorUserId: user.id,
        entityType: 'Contact',
        entityId: contactId,
        action: 'update',
        summary: `Contact ${before.name} updated on party ${partyId}`,
        changes: {
          before: this.auditable(was),
          after: this.auditable(after),
        },
      });
      return contactView(saved!);
    });
  }

  async removeContact(partyId: number, contactId: number, user: Principal) {
    await this.prisma.client.transaction(async (tx) => {
      await this.lockEditable(tx, partyId);
      const contact = await this.requireContact(tx, partyId, contactId);
      const contacts = tx.orm.public.Contact;
      await contacts.where({ id: contactId }).delete();
      if (contact.isPrimary) {
        // The longest-standing remaining contact takes over, so one is always primary.
        const next = await contacts
          .where({ partyId })
          .orderBy((c) => c.id.asc())
          .first();
        if (next) {
          await contacts
            .where({ id: next.id })
            .update({ isPrimary: true, updatedAt: new Date() });
        }
      }
      await this.audit.record(tx, {
        actorUserId: user.id,
        entityType: 'Contact',
        entityId: contactId,
        action: 'delete',
        summary: `Contact ${contact.name} removed from party ${partyId}`,
        changes: { before: contactView(contact) },
      });
    });
  }

  private assertBillingAllowed(
    dto: {
      paymentTermsDays?: number | null;
      creditLimit?: string | null;
      accountStatus?: PartyAccountStatus;
    },
    user: Principal,
  ): void {
    if (
      Object.keys(pick(dto, BILLING_FIELDS)).length > 0 &&
      !user.permissions.includes(BILLING_MANAGE)
    ) {
      throw new ForbiddenException(
        'Only finance, management and administrators can change payment terms or the credit limit.',
      );
    }
    if (
      dto.accountStatus !== undefined &&
      !user.permissions.includes(STATUS_MANAGE)
    ) {
      throw new ForbiddenException(
        'Only management and administrators can change account status.',
      );
    }
  }

  private async assertKraPinFree(
    tx: Tx,
    kraPin: string | null,
    exceptId?: number,
  ): Promise<void> {
    if (!kraPin) return;
    const holder = await tx.orm.public.Party.where({ kraPin }).first();
    if (holder && holder.id !== exceptId) {
      throw new ConflictException({
        message: 'Another record already uses this KRA PIN.',
        details: [
          {
            field: 'kraPin',
            messages: ['Another record already uses this KRA PIN.'],
          },
        ],
      });
    }
  }

  private async requireEditable(tx: Tx, id: number) {
    const party = await tx.orm.public.Party.first({ id });
    if (!party) throw new NotFoundException('Record not found.');
    this.assertNotArchived(party);
    return party;
  }

  /**
   * Updating the party row holds its lock until the transaction ends, so concurrent contact
   * changes run one at a time and a party can never end up with two primary contacts.
   */
  private async lockEditable(tx: Tx, id: number): Promise<void> {
    const party = await tx.orm.public.Party.where({ id }).update({
      updatedAt: new Date(),
    });
    if (!party) throw new NotFoundException('Record not found.');
    this.assertNotArchived(party);
  }

  private assertNotArchived(party: { archivedAt: Date | null }): void {
    if (party.archivedAt !== null) {
      throw new ConflictException(
        'This record is archived. Restore it before changing it.',
      );
    }
  }

  private async requireContact(tx: Tx, partyId: number, contactId: number) {
    const contact = await tx.orm.public.Contact.where({
      id: contactId,
      partyId,
    }).first();
    if (!contact) throw new NotFoundException('Record not found.');
    return contact;
  }

  private async clearPrimary(tx: Tx, partyId: number): Promise<void> {
    await tx.orm.public.Contact.where({ partyId, isPrimary: true }).update({
      isPrimary: false,
      updatedAt: new Date(),
    });
  }

  private auditable<T extends object>(values: T) {
    return JSON.parse(JSON.stringify(values)) as {
      readonly [key: string]: string | number | boolean | null;
    };
  }

  private async rolesByParty(ids: number[]): Promise<Map<number, PartyRole[]>> {
    const rows = await this.prisma.client.orm.public.PartyRole.where((r) =>
      r.partyId.in(ids),
    ).all();
    const roles = new Map<number, PartyRole[]>();
    for (const { partyId, role } of rows) {
      roles.set(partyId, [...(roles.get(partyId) ?? []), role]);
    }
    return roles;
  }

  /** Counts and balances, all calculated in SQL so money is never added up as floats. */
  private async figures(ids: number[]): Promise<Map<number, FiguresRow>> {
    const { client } = this.prisma;
    const plan = client.raw.sql`
      SELECT
        p.id AS "partyId",
        (SELECT COUNT(*)::int FROM "Shipment" s
          WHERE s."customerId" = p.id) AS "totalShipments",
        (SELECT COUNT(*)::int FROM "Shipment" s
          WHERE s."customerId" = p.id AND s.status <> 'delivered') AS "activeShipments",
        (SELECT COUNT(*)::int FROM "Quotation" q
          WHERE q."customerId" = p.id) AS "totalQuotations",
        (SELECT COUNT(*)::int FROM "Quotation" q
          WHERE q."customerId" = p.id AND q.status IN ('draft', 'sent')) AS "openQuotations",
        a.invoiced::text AS "invoiced",
        a.credited::text AS "credited",
        a.paid::text AS "paid",
        a.outstanding::text AS "outstanding",
        a.overdue::text AS "overdue",
        a."overdueInvoices" AS "overdueInvoices",
        (p."creditLimit" - a.outstanding)::text AS "availableCredit"
      FROM "Party" p
      CROSS JOIN LATERAL (
        SELECT
          COALESCE(SUM(i.total), 0::numeric(14, 2)) AS invoiced,
          COALESCE(SUM(i.credited), 0::numeric(14, 2)) AS credited,
          COALESCE(SUM(i.paid), 0::numeric(14, 2)) AS paid,
          COALESCE(SUM(i.balance), 0::numeric(14, 2)) AS outstanding,
          COALESCE(SUM(i.balance) FILTER (WHERE i.late AND i.balance > 0),
            0::numeric(14, 2)) AS overdue,
          (COUNT(*) FILTER (WHERE i.late AND i.balance > 0))::int AS "overdueInvoices"
        FROM (
          SELECT
            inv.total,
            cn.credited,
            al.paid,
            inv.total - cn.credited - al.paid AS balance,
            inv."dueDate" < (now() AT TIME ZONE 'Africa/Nairobi')::date AS late
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
          WHERE inv."customerId" = p.id AND inv.status = 'issued'
        ) i
      ) a
      WHERE p.id = ANY (string_to_array(${ids.join(',')}::text, ',')::int[])
    `
      .returnsRow({
        partyId: 'pg/int4@1',
        totalShipments: 'pg/int4@1',
        activeShipments: 'pg/int4@1',
        totalQuotations: 'pg/int4@1',
        openQuotations: 'pg/int4@1',
        invoiced: 'pg/text@1',
        credited: 'pg/text@1',
        paid: 'pg/text@1',
        outstanding: 'pg/text@1',
        overdue: 'pg/text@1',
        overdueInvoices: 'pg/int4@1',
        availableCredit: 'pg/text@1',
      })
      .build();
    const rows = await client.runtime().query(plan);
    return new Map(
      rows.map((row) => [
        row.partyId,
        {
          shipments: { active: row.activeShipments, total: row.totalShipments },
          quotations: { open: row.openQuotations, total: row.totalQuotations },
          account: {
            invoiced: row.invoiced,
            credited: row.credited,
            paid: row.paid,
            outstanding: row.outstanding,
            overdue: row.overdue,
            overdueInvoices: row.overdueInvoices,
            availableCredit: row.availableCredit as string | null,
          },
        },
      ]),
    );
  }
}
