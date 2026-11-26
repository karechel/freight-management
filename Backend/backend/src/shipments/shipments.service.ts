import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Numeric } from '@prisma/orm-postgres/target/codec-types';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../auth/auth.decorators.js';
import { normalizeDecimal } from '../common/decimal-fields.js';
import {
  validationFailed,
  type FieldProblem,
} from '../common/validation-exception.js';
import { requirePartyWithRole } from '../parties/party-checks.js';
import { containsPattern, newWorkBlock } from '../parties/party-rules.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { ReferencesService } from '../references/references.service.js';
import {
  ACTUAL_MILESTONE,
  PLANNED_FOR_ACTUAL,
  currentEta,
  dateProblems,
  defaultMilestones,
  issueProblems,
  milestoneActualProblem,
  milestoneStates,
  statusChangeProblem,
  statusProblems,
  type ActualField,
  type IssueState,
  type ShipmentDates,
  type ShipmentStatus,
  type ShipmentView,
} from './shipment-rules.js';
import type {
  AddContainerDto,
  ChangeStatusDto,
  CreateIssueDto,
  CreateShipmentDto,
  IssueActionDto,
  ListShipmentsQueryDto,
  UpdateIssueDto,
  UpdateMilestoneDto,
  UpdateShipmentDto,
} from './shipments.dto.js';

export const SHIPMENTS_VIEW = 'shipments.view';
export const SHIPMENTS_MANAGE = 'shipments.manage';

/** Audit actions whose `changes.after.issueId` ties them to one delay or other issue. */
const ISSUE_ACTIONS = ['issue_create', 'issue_update', 'issue_action'];

const SHIPMENT_BLOCK_MESSAGES = {
  archived:
    'This customer is archived. Restore the customer before opening a new shipment for them.',
  on_hold:
    'This customer is on hold, so new work is blocked. Management or an administrator must make the account active before a new shipment is opened.',
  closed:
    "This customer's account is closed, so new work is blocked. Management or an administrator must make the account active before a new shipment is opened.",
} as const;

const BOOKING_CUSTOMER_BLOCK = {
  archived: "This booking's customer is archived.",
  on_hold: "This booking's customer is on hold.",
  closed: "This booking's customer account is closed.",
} as const;

const DETAIL_FIELDS = [
  'carrierId',
  'agentId',
  'assignedToId',
  'origin',
  'destination',
  'transportDocRef',
  'vesselOrFlight',
  'voyageNumber',
  'equipment',
  'cargoDescription',
  'packages',
  'grossWeightKg',
  'volumeCbm',
] as const;
const DATE_FIELDS = [
  'etd',
  'eta',
  'estimatedDeliveryAt',
  'atd',
  'ata',
  'deliveredAt',
] as const;

type ShipmentRow = NonNullable<
  Awaited<ReturnType<Tx['orm']['public']['Shipment']['first']>>
>;

const instant = (value: string | null | undefined): Date | null =>
  value ? new Date(value) : null;

/** undefined keeps the current value; null clears it. */
const pick = <T>(next: T | undefined, current: T): T =>
  next === undefined ? current : next;

const sameTime = (a: Date | null, b: Date | null) =>
  (a?.getTime() ?? null) === (b?.getTime() ?? null);

const plainJson = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as { readonly [key: string]: string };

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly references: ReferencesService,
  ) {}

  // --- Create, edit, status -----------------------------------------------------------------

  async create(dto: CreateShipmentDto, user: Principal) {
    const reference = await this.prisma.client.transaction(async (tx) => {
      const now = new Date();
      let base: {
        bookingId: number | null;
        customerId: number;
        mode: 'sea' | 'air' | 'road' | 'rail';
        direction: 'import' | 'export' | 'transit';
        origin: string;
        destination: string;
        cargoDescription: string;
        carrierId: number | null;
        agentId: number | null;
        etd: Date | null;
        eta: Date | null;
      };

      if (dto.bookingReference) {
        const [row] = await tx.query(
          this.prisma.client.raw.sql`
            SELECT id FROM "Booking" WHERE reference = ${dto.bookingReference}::text FOR UPDATE
          `
            .returnsRow({ id: 'pg/int4@1' })
            .build(),
        );
        if (!row) {
          throw validationFailed([
            {
              field: 'bookingReference',
              messages: ['Select an existing booking.'],
            },
          ]);
        }
        const booking = (await tx.orm.public.Booking.first({ id: row.id }))!;
        if (booking.status !== 'confirmed') {
          throw new ConflictException(
            `Only confirmed bookings can be turned into shipments. This booking is ${booking.status}.`,
          );
        }
        const problems: FieldProblem[] = [];
        for (const field of ['customerId', 'mode', 'direction'] as const) {
          if (dto[field] !== undefined && dto[field] !== booking[field]) {
            problems.push({
              field,
              messages: ['This comes from the booking and cannot differ.'],
            });
          }
        }
        if (problems.length) throw validationFailed(problems);
        // Archived customers since Phase 3; on-hold and closed customers too since the repository
        // owner's decision of 2026-11-27 (CLAUDE.md §17 question 19).
        const customer = (await tx.orm.public.Party.first({
          id: booking.customerId,
        }))!;
        const block = newWorkBlock(customer);
        if (block) {
          throw new ConflictException({
            message: SHIPMENT_BLOCK_MESSAGES[block],
            details: [
              {
                field: 'bookingReference',
                messages: [BOOKING_CUSTOMER_BLOCK[block]],
              },
            ],
          });
        }
        base = {
          bookingId: booking.id,
          customerId: booking.customerId,
          mode: booking.mode,
          direction: booking.direction,
          origin: dto.origin ?? booking.origin,
          destination: dto.destination ?? booking.destination,
          cargoDescription: dto.cargoDescription ?? booking.cargoSummary,
          carrierId: pick(dto.carrierId, booking.carrierId),
          agentId: pick(dto.agentId, booking.agentId),
          etd: dto.etd === undefined ? booking.plannedEtd : instant(dto.etd),
          eta: dto.eta === undefined ? booking.plannedEta : instant(dto.eta),
        };
      } else {
        const missing: FieldProblem[] = [];
        const need = (field: string, value: unknown, message: string) => {
          if (value === undefined || value === null || value === '') {
            missing.push({ field, messages: [message] });
          }
        };
        need('customerId', dto.customerId, 'Select the customer.');
        need('mode', dto.mode, 'Select the transport mode.');
        need('direction', dto.direction, 'Select import, export or transit.');
        need('origin', dto.origin, 'This field is required.');
        need('destination', dto.destination, 'This field is required.');
        need('cargoDescription', dto.cargoDescription, 'Describe the cargo.');
        if (missing.length) throw validationFailed(missing);
        const customer = await requirePartyWithRole(
          tx,
          dto.customerId!,
          'customer',
          'customerId',
        );
        const block = newWorkBlock(customer);
        if (block) {
          throw new ConflictException({
            message: SHIPMENT_BLOCK_MESSAGES[block],
            details: [
              {
                field: 'customerId',
                messages: [SHIPMENT_BLOCK_MESSAGES[block]],
              },
            ],
          });
        }
        base = {
          bookingId: null,
          customerId: dto.customerId!,
          mode: dto.mode!,
          direction: dto.direction!,
          origin: dto.origin!,
          destination: dto.destination!,
          cargoDescription: dto.cargoDescription!,
          carrierId: dto.carrierId ?? null,
          agentId: dto.agentId ?? null,
          etd: instant(dto.etd),
          eta: instant(dto.eta),
        };
      }

      const estimatedDeliveryAt = instant(dto.estimatedDeliveryAt);
      const problems: FieldProblem[] = [
        ...this.routeProblems(base.origin, base.destination),
        ...etaProblems(base.eta),
        ...dateProblems(
          {
            etd: base.etd,
            eta: base.eta,
            estimatedDeliveryAt,
            atd: null,
            ata: null,
            deliveredAt: null,
          },
          now,
        ),
      ];
      if (problems.length) throw validationFailed(problems);
      await this.checkLinks(tx, {
        carrierId: base.carrierId,
        agentId: base.agentId,
        assignedToId: dto.assignedToId ?? null,
      });

      const shipments = tx.orm.public.Shipment;
      const reference = await this.references.generate(tx, 'shipment', {
        mode: base.mode,
        isTaken: async (candidate) =>
          (await shipments.where({ reference: candidate }).first()) !== null,
      });
      const shipment = await shipments.create({
        reference,
        ...base,
        assignedToId: dto.assignedToId ?? null,
        status: 'booked',
        transportDocRef: dto.transportDocRef ?? null,
        vesselOrFlight: dto.vesselOrFlight ?? null,
        voyageNumber: dto.voyageNumber ?? null,
        equipment: dto.equipment ?? null,
        packages: dto.packages ?? null,
        grossWeightKg: this.quantity(dto.grossWeightKg),
        volumeCbm: this.quantity(dto.volumeCbm),
        estimatedDeliveryAt,
        atd: null,
        ata: null,
        deliveredAt: null,
        createdById: user.id,
        createdAt: now,
        updatedAt: now,
      });
      const steps = defaultMilestones(
        {
          direction: base.direction,
          origin: base.origin,
          destination: base.destination,
          etd: base.etd,
          eta: base.eta,
          estimatedDeliveryAt,
          fromBooking: base.bookingId !== null,
        },
        now,
      );
      for (const [index, step] of steps.entries()) {
        await tx.orm.public.ShipmentMilestone.create({
          shipmentId: shipment.id,
          sequence: index + 1,
          label: step.label,
          location: step.location,
          plannedAt: step.plannedAt,
          actualAt: step.actualAt,
          note: null,
          recordedById: step.actualAt ? user.id : null,
          createdAt: now,
          updatedAt: now,
        });
      }
      await this.audit.record(tx, {
        actorUserId: user.id,
        entityType: 'Shipment',
        entityId: shipment.id,
        action: 'create',
        summary: dto.bookingReference
          ? `Shipment created from booking ${dto.bookingReference}.`
          : 'Shipment created without a booking.',
        changes: plainJson({ after: { ...base, estimatedDeliveryAt } }),
      });
      return reference;
    });
    return this.getOne(reference);
  }

  async update(reference: string, dto: UpdateShipmentDto, user: Principal) {
    await this.prisma.client.transaction(async (tx) => {
      const before = await this.lock(tx, reference);
      const now = new Date();
      const next = {
        carrierId: pick(dto.carrierId, before.carrierId),
        agentId: pick(dto.agentId, before.agentId),
        assignedToId: pick(dto.assignedToId, before.assignedToId),
        origin: dto.origin ?? before.origin,
        destination: dto.destination ?? before.destination,
        transportDocRef: pick(dto.transportDocRef, before.transportDocRef),
        vesselOrFlight: pick(dto.vesselOrFlight, before.vesselOrFlight),
        voyageNumber: pick(dto.voyageNumber, before.voyageNumber),
        equipment: pick(dto.equipment, before.equipment),
        cargoDescription: dto.cargoDescription ?? before.cargoDescription,
        packages: pick(dto.packages, before.packages),
        grossWeightKg:
          dto.grossWeightKg === undefined
            ? before.grossWeightKg
            : this.quantity(dto.grossWeightKg),
        volumeCbm:
          dto.volumeCbm === undefined
            ? before.volumeCbm
            : this.quantity(dto.volumeCbm),
      };
      const dates: ShipmentDates = {
        etd: dto.etd === undefined ? before.etd : instant(dto.etd),
        eta: dto.eta === undefined ? before.eta : instant(dto.eta),
        estimatedDeliveryAt:
          dto.estimatedDeliveryAt === undefined
            ? before.estimatedDeliveryAt
            : instant(dto.estimatedDeliveryAt),
        atd: dto.atd === undefined ? before.atd : instant(dto.atd),
        ata: dto.ata === undefined ? before.ata : instant(dto.ata),
        deliveredAt: before.deliveredAt,
      };
      const problems = [
        ...this.routeProblems(next.origin, next.destination),
        ...etaProblems(dates.eta),
        ...dateProblems(dates, now),
        ...statusProblems(before.status, dates),
      ];
      if (problems.length) throw validationFailed(problems);
      await this.checkLinks(tx, {
        carrierId: next.carrierId === before.carrierId ? null : next.carrierId,
        agentId: next.agentId === before.agentId ? null : next.agentId,
        assignedToId:
          next.assignedToId === before.assignedToId ? null : next.assignedToId,
      });

      const changed = [
        ...DETAIL_FIELDS.filter((f) => next[f] !== before[f]),
        ...DATE_FIELDS.filter((f) => !sameTime(dates[f], before[f])),
      ];
      if (changed.length === 0) return;
      await tx.orm.public.Shipment.where({ id: before.id }).update({
        ...next,
        ...dates,
        updatedAt: now,
      });
      await this.syncMilestones(tx, before.id, before, dates, user);
      await this.audit.record(tx, {
        actorUserId: user.id,
        entityType: 'Shipment',
        entityId: before.id,
        action: 'update',
        summary: `Details updated: ${changed.map(fieldLabel).join(', ')}.`,
        changes: plainJson({
          before: Object.fromEntries(changed.map((f) => [f, before[f]])),
          after: Object.fromEntries(
            changed.map((f) => [
              f,
              (DATE_FIELDS as readonly string[]).includes(f)
                ? dates[f as keyof ShipmentDates]
                : next[f as keyof typeof next],
            ]),
          ),
        }),
      });
    });
    return this.getOne(reference);
  }

  async changeStatus(reference: string, dto: ChangeStatusDto, user: Principal) {
    await this.prisma.client.transaction(async (tx) => {
      const before = await this.lock(tx, reference);
      const problem = statusChangeProblem(before.status, dto.status);
      if (problem) throw new ConflictException(problem);
      const now = new Date();
      const dates: ShipmentDates = {
        etd: before.etd,
        eta: before.eta,
        estimatedDeliveryAt: before.estimatedDeliveryAt,
        atd: dto.atd === undefined ? before.atd : instant(dto.atd),
        ata: dto.ata === undefined ? before.ata : instant(dto.ata),
        deliveredAt:
          dto.deliveredAt === undefined
            ? before.deliveredAt
            : instant(dto.deliveredAt),
      };
      const problems = [
        ...dateProblems(dates, now),
        ...statusProblems(dto.status, dates),
      ];
      if (problems.length) throw validationFailed(problems);
      await tx.orm.public.Shipment.where({ id: before.id }).update({
        status: dto.status,
        atd: dates.atd,
        ata: dates.ata,
        deliveredAt: dates.deliveredAt,
        updatedAt: now,
      });
      await this.syncMilestones(tx, before.id, before, dates, user);
      if (dto.status === 'delivered' && before.bookingId !== null) {
        await this.completeBookingIfDelivered(tx, before.bookingId, user);
      }
      const recorded = (['atd', 'ata', 'deliveredAt'] as const).filter(
        (f) => !sameTime(dates[f], before[f]),
      );
      await this.audit.record(tx, {
        actorUserId: user.id,
        entityType: 'Shipment',
        entityId: before.id,
        action: 'status_change',
        summary: `Status changed from "${statusLabel(before.status)}" to "${statusLabel(dto.status)}".${
          dto.note ? ` Note: ${dto.note}` : ''
        }`,
        changes: plainJson({
          before: {
            status: before.status,
            ...Object.fromEntries(recorded.map((f) => [f, before[f]])),
          },
          after: {
            status: dto.status,
            ...Object.fromEntries(recorded.map((f) => [f, dates[f]])),
            note: dto.note ?? null,
          },
        }),
      });
    });
    return this.getOne(reference);
  }

  // --- Milestones ---------------------------------------------------------------------------

  async updateMilestone(
    reference: string,
    milestoneId: number,
    dto: UpdateMilestoneDto,
    user: Principal,
  ) {
    await this.prisma.client.transaction(async (tx) => {
      const shipment = await this.lock(tx, reference);
      const milestones = await this.milestonesOf(tx, shipment.id);
      const index = milestones.findIndex((m) => m.id === milestoneId);
      if (index < 0) throw new NotFoundException('Record not found.');
      const before = milestones[index];
      const now = new Date();
      const actualAt =
        dto.actualAt === undefined ? before.actualAt : instant(dto.actualAt);
      const actualChanged = !sameTime(actualAt, before.actualAt);
      const linked = (Object.keys(ACTUAL_MILESTONE) as ActualField[]).find(
        (f) =>
          ACTUAL_MILESTONE[f].test(before.label) &&
          milestones.findIndex((m) => ACTUAL_MILESTONE[f].test(m.label)) ===
            index,
      );
      let shipmentPatch: Partial<ShipmentDates> = {};
      if (actualChanged) {
        if (linked === 'deliveredAt') {
          throw new ConflictException(
            'Record the delivery by changing the shipment status to delivered.',
          );
        }
        const problem = milestoneActualProblem(
          milestones,
          index,
          actualAt,
          now,
        );
        if (problem) {
          throw validationFailed([{ field: 'actualAt', messages: [problem] }]);
        }
        if (linked) {
          // Departure and arrival are also the shipment's actual times.
          const dates: ShipmentDates = {
            ...pickDates(shipment),
            [linked]: actualAt,
          };
          const problems = [
            ...dateProblems(dates, now),
            ...statusProblems(shipment.status, dates),
          ].map((p) => ({ field: 'actualAt', messages: p.messages }));
          if (problems.length) throw validationFailed(problems);
          shipmentPatch = { [linked]: actualAt };
        }
      }
      const patch = {
        actualAt,
        plannedAt:
          dto.plannedAt === undefined
            ? before.plannedAt
            : instant(dto.plannedAt),
        location: pick(dto.location, before.location),
        note: pick(dto.note, before.note),
      };
      const changed =
        actualChanged ||
        !sameTime(patch.plannedAt, before.plannedAt) ||
        patch.location !== before.location ||
        patch.note !== before.note;
      if (!changed) return;
      await tx.orm.public.ShipmentMilestone.where({ id: before.id }).update({
        ...patch,
        ...(actualChanged ? { recordedById: user.id } : {}),
        updatedAt: now,
      });
      await tx.orm.public.Shipment.where({ id: shipment.id }).update({
        ...shipmentPatch,
        updatedAt: now,
      });
      const state = actualAt ? 'completed' : 'not completed';
      await this.audit.record(tx, {
        actorUserId: user.id,
        entityType: 'Shipment',
        entityId: shipment.id,
        action: 'milestone',
        summary: actualChanged
          ? `Milestone "${before.label}" marked ${state}${actualAt ? ` (${nairobiTime(actualAt)})` : ''}.`
          : `Milestone "${before.label}" details updated.`,
        changes: plainJson({
          before: {
            milestoneId: before.id,
            actualAt: before.actualAt,
            plannedAt: before.plannedAt,
            location: before.location,
            note: before.note,
          },
          after: { milestoneId: before.id, ...patch },
        }),
      });
    });
    return this.getOne(reference);
  }

  // --- Delays and other issues --------------------------------------------------------------

  async createIssue(reference: string, dto: CreateIssueDto, user: Principal) {
    await this.prisma.client.transaction(async (tx) => {
      const shipment = await this.lock(tx, reference);
      const missing: FieldProblem[] = [];
      if (!dto.severity) {
        missing.push({
          field: 'severity',
          messages: ['Select low, medium or high.'],
        });
      }
      if (!dto.reasonDetail) {
        missing.push({
          field: 'reasonDetail',
          messages: ['Describe what happened.'],
        });
      }
      if (!dto.identifiedAt) {
        missing.push({
          field: 'identifiedAt',
          messages: ['Enter when the issue was identified.'],
        });
      }
      if (missing.length) throw validationFailed(missing);
      const now = new Date();
      const state: IssueState = {
        type: dto.type,
        reason: dto.reason ?? null,
        identifiedAt: new Date(dto.identifiedAt!),
        originalExpectedAt: instant(dto.originalExpectedAt),
        revisedExpectedAt: instant(dto.revisedExpectedAt),
        affectsEta: dto.affectsEta ?? false,
        status: 'open',
        resolvedAt: null,
        customerNotification: dto.customerNotification ?? 'not_notified',
        customerNotifiedAt: instant(dto.customerNotifiedAt),
      };
      const problems = issueProblems(state, now);
      if (problems.length) throw validationFailed(problems);
      const followUpUserId = pick(dto.followUpUserId, shipment.assignedToId);
      await this.checkIssueLinks(tx, shipment.id, {
        affectedMilestoneId: dto.affectedMilestoneId ?? null,
        followUpUserId: dto.followUpUserId ?? null,
      });
      const issue = await tx.orm.public.ShipmentIssue.create({
        shipmentId: shipment.id,
        ...state,
        severity: dto.severity!,
        reasonDetail: dto.reasonDetail!,
        affectedMilestoneId: dto.affectedMilestoneId ?? null,
        followUpUserId,
        nextAction: dto.nextAction ?? null,
        notes: dto.notes ?? null,
        resolution: null,
        createdById: user.id,
        createdAt: now,
        updatedAt: now,
      });
      await tx.orm.public.Shipment.where({ id: shipment.id }).update({
        updatedAt: now,
      });
      const what =
        dto.type === 'delay'
          ? `Delay recorded: ${words(state.reason!)} (${dto.severity} severity).`
          : `Issue recorded: ${words(dto.type)} (${dto.severity} severity).`;
      await this.audit.record(tx, {
        actorUserId: user.id,
        entityType: 'Shipment',
        entityId: shipment.id,
        action: 'issue_create',
        summary:
          state.affectsEta && state.revisedExpectedAt
            ? `${what} ETA revised to ${nairobiTime(state.revisedExpectedAt)}.`
            : what,
        changes: plainJson({ after: { issueId: issue.id, ...state } }),
      });
    });
    return this.getOne(reference);
  }

  async updateIssue(
    reference: string,
    issueId: number,
    dto: UpdateIssueDto,
    user: Principal,
  ) {
    await this.prisma.client.transaction(async (tx) => {
      const shipment = await this.lock(tx, reference);
      const before = await tx.orm.public.ShipmentIssue.where({
        id: issueId,
        shipmentId: shipment.id,
      }).first();
      if (!before) throw new NotFoundException('Record not found.');
      const now = new Date();
      const status = dto.status ?? before.status;
      const next = {
        severity: dto.severity ?? before.severity,
        reason: pick(dto.reason, before.reason),
        reasonDetail: dto.reasonDetail ?? before.reasonDetail,
        identifiedAt: dto.identifiedAt
          ? new Date(dto.identifiedAt)
          : before.identifiedAt,
        affectedMilestoneId: pick(
          dto.affectedMilestoneId,
          before.affectedMilestoneId,
        ),
        originalExpectedAt:
          dto.originalExpectedAt === undefined
            ? before.originalExpectedAt
            : instant(dto.originalExpectedAt),
        revisedExpectedAt:
          dto.revisedExpectedAt === undefined
            ? before.revisedExpectedAt
            : instant(dto.revisedExpectedAt),
        affectsEta: dto.affectsEta ?? before.affectsEta,
        followUpUserId: pick(dto.followUpUserId, before.followUpUserId),
        status,
        nextAction: pick(dto.nextAction, before.nextAction),
        notes: pick(dto.notes, before.notes),
        // Reopening clears the resolution time.
        resolvedAt:
          status !== 'resolved'
            ? dto.resolvedAt === undefined
              ? null
              : instant(dto.resolvedAt)
            : dto.resolvedAt === undefined
              ? before.resolvedAt
              : instant(dto.resolvedAt),
        resolution: pick(dto.resolution, before.resolution),
        customerNotification:
          dto.customerNotification ?? before.customerNotification,
        customerNotifiedAt:
          dto.customerNotifiedAt === undefined
            ? before.customerNotifiedAt
            : instant(dto.customerNotifiedAt),
      };
      const problems = issueProblems({ type: before.type, ...next }, now);
      if (problems.length) throw validationFailed(problems);
      await this.checkIssueLinks(tx, shipment.id, {
        affectedMilestoneId:
          next.affectedMilestoneId === before.affectedMilestoneId
            ? null
            : next.affectedMilestoneId,
        followUpUserId:
          next.followUpUserId === before.followUpUserId
            ? null
            : next.followUpUserId,
      });
      const changed = (Object.keys(next) as (keyof typeof next)[]).filter(
        (k) => {
          const a = next[k];
          const b = before[k];
          return a instanceof Date || b instanceof Date
            ? !sameTime(a as Date | null, b as Date | null)
            : a !== b;
        },
      );
      if (changed.length === 0) return;
      await tx.orm.public.ShipmentIssue.where({ id: before.id }).update({
        ...next,
        updatedAt: now,
      });
      await tx.orm.public.Shipment.where({ id: shipment.id }).update({
        updatedAt: now,
      });
      await this.audit.record(tx, {
        actorUserId: user.id,
        entityType: 'Shipment',
        entityId: shipment.id,
        action: 'issue_update',
        summary: describeIssueChange(before, next, changed),
        changes: plainJson({
          before: {
            issueId: before.id,
            ...Object.fromEntries(changed.map((k) => [k, before[k]])),
          },
          after: {
            issueId: before.id,
            ...Object.fromEntries(changed.map((k) => [k, next[k]])),
          },
        }),
      });
    });
    return this.getOne(reference);
  }

  async addIssueAction(
    reference: string,
    issueId: number,
    dto: IssueActionDto,
    user: Principal,
  ) {
    await this.prisma.client.transaction(async (tx) => {
      const shipment = await this.lock(tx, reference);
      const issue = await tx.orm.public.ShipmentIssue.where({
        id: issueId,
        shipmentId: shipment.id,
      }).first();
      if (!issue) throw new NotFoundException('Record not found.');
      const now = new Date();
      const at = instant(dto.at) ?? now;
      if (at.getTime() > now.getTime()) {
        throw validationFailed([
          { field: 'at', messages: ['This time cannot be in the future.'] },
        ]);
      }
      await tx.orm.public.Shipment.where({ id: shipment.id }).update({
        updatedAt: now,
      });
      await this.audit.record(tx, {
        actorUserId: user.id,
        entityType: 'Shipment',
        entityId: shipment.id,
        action: 'issue_action',
        summary: `Action recorded on ${issue.type === 'delay' ? 'a delay' : 'an issue'}: ${dto.note}`,
        changes: plainJson({
          after: { issueId: issue.id, note: dto.note, at },
        }),
      });
    });
    return this.getOne(reference);
  }

  // --- Containers ---------------------------------------------------------------------------

  async addContainer(reference: string, dto: AddContainerDto, user: Principal) {
    await this.prisma.client.transaction(async (tx) => {
      const shipment = await this.lock(tx, reference);
      const containers = tx.orm.public.Container;
      if (
        await containers
          .where({
            shipmentId: shipment.id,
            containerNumber: dto.containerNumber,
          })
          .first()
      ) {
        throw new ConflictException({
          message: `Container ${dto.containerNumber} is already on this shipment.`,
          details: [
            {
              field: 'containerNumber',
              messages: ['Already on this shipment.'],
            },
          ],
        });
      }
      const now = new Date();
      const container = await containers.create({
        shipmentId: shipment.id,
        containerNumber: dto.containerNumber,
        type: dto.type,
        sealNumber: dto.sealNumber ?? null,
        grossWeightKg: this.quantity(dto.grossWeightKg),
        packages: dto.packages ?? null,
        createdAt: now,
        updatedAt: now,
      });
      await tx.orm.public.Shipment.where({ id: shipment.id }).update({
        updatedAt: now,
      });
      await this.audit.record(tx, {
        actorUserId: user.id,
        entityType: 'Shipment',
        entityId: shipment.id,
        action: 'container_add',
        summary: `Container ${dto.containerNumber} added.`,
        changes: plainJson({
          after: {
            containerId: container.id,
            containerNumber: container.containerNumber,
            type: container.type,
            sealNumber: container.sealNumber,
          },
        }),
      });
    });
    return this.getOne(reference);
  }

  async removeContainer(
    reference: string,
    containerId: number,
    user: Principal,
  ) {
    await this.prisma.client.transaction(async (tx) => {
      const shipment = await this.lock(tx, reference);
      const container = await tx.orm.public.Container.where({
        id: containerId,
        shipmentId: shipment.id,
      }).first();
      if (!container) throw new NotFoundException('Record not found.');
      await tx.orm.public.Container.where({ id: container.id }).delete();
      await tx.orm.public.Shipment.where({ id: shipment.id }).update({
        updatedAt: new Date(),
      });
      await this.audit.record(tx, {
        actorUserId: user.id,
        entityType: 'Shipment',
        entityId: shipment.id,
        action: 'container_remove',
        summary: `Container ${container.containerNumber} removed.`,
        changes: plainJson({ before: container }),
      });
    });
    return this.getOne(reference);
  }

  // --- Reading ------------------------------------------------------------------------------

  async list(query: ListShipmentsQueryDto) {
    const { client } = this.prisma;
    const view: ShipmentView = query.view ?? 'all';
    const status = query.status ?? '';
    const mode = query.mode ?? '';
    const customerId = query.customerId ?? 0;
    const booking = query.bookingReference ?? '';
    const pattern = query.q ? containsPattern(query.q) : '';
    const now = new Date();
    const from = new Date(now.getTime() - DAY_MS).toISOString();
    const to = new Date(now.getTime() + 7 * DAY_MS).toISOString();
    const plan = client.raw.sql`
      WITH base AS (
        SELECT s.id, s."updatedAt", s.status,
          COALESCE((
            SELECT i."revisedExpectedAt" FROM "ShipmentIssue" i
            WHERE i."shipmentId" = s.id AND i.type = 'delay' AND i.status <> 'resolved'
              AND i."affectsEta" AND i."revisedExpectedAt" IS NOT NULL
            ORDER BY i."identifiedAt" DESC, i.id DESC LIMIT 1
          ), s.eta) AS current_eta,
          EXISTS (SELECT 1 FROM "ShipmentIssue" i
                  WHERE i."shipmentId" = s.id AND i.status <> 'resolved') AS open_issue,
          EXISTS (SELECT 1 FROM "ShipmentIssue" i
                  WHERE i."shipmentId" = s.id AND i.status <> 'resolved'
                    AND i.type = 'delay') AS open_delay,
          (SELECT ce.status FROM "CustomsEntry" ce
           WHERE ce."shipmentId" = s.id ORDER BY ce.id DESC LIMIT 1) AS customs_status
        FROM "Shipment" s
        JOIN "Party" c ON c.id = s."customerId"
        LEFT JOIN "Booking" b ON b.id = s."bookingId"
        WHERE (${status}::text = '' OR s.status = ${status}::text)
          AND (${mode}::text = '' OR s.mode = ${mode}::text)
          AND (${customerId}::int = 0 OR s."customerId" = ${customerId}::int)
          AND (${booking}::text = '' OR b.reference = ${booking}::text)
          AND (${pattern}::text = ''
                OR s.reference ILIKE ${pattern}::text
                OR b.reference ILIKE ${pattern}::text
                OR s.origin ILIKE ${pattern}::text
                OR s.destination ILIKE ${pattern}::text
                OR s."cargoDescription" ILIKE ${pattern}::text
                OR s."transportDocRef" ILIKE ${pattern}::text
                OR c.name ILIKE ${pattern}::text)
      ),
      flagged AS (
        SELECT id, "updatedAt",
          status <> 'delivered' AS active,
          status <> 'delivered' AND (status = 'on_hold' OR open_issue
            OR customs_status = 'query') AS attention,
          status <> 'delivered' AND open_delay AS delayed,
          status IN ('booked', 'in_transit')
            AND current_eta BETWEEN ${from}::timestamptz AND ${to}::timestamptz AS arriving,
          status <> 'delivered' AND (status = 'customs' OR (customs_status IS NOT NULL
            AND customs_status NOT IN ('not_started', 'released'))) AS customs
        FROM base
      ),
      matching AS (
        SELECT id, "updatedAt" FROM flagged
        WHERE CASE ${view}::text
          WHEN 'active' THEN active
          WHEN 'attention' THEN attention
          WHEN 'delayed' THEN delayed
          WHEN 'arriving' THEN arriving
          WHEN 'customs' THEN customs
          ELSE true END
      )
      SELECT
        (SELECT COUNT(*)::int FROM matching) AS "total",
        (SELECT json_build_object(
          'all', COUNT(*), 'active', COUNT(*) FILTER (WHERE active),
          'attention', COUNT(*) FILTER (WHERE attention),
          'delayed', COUNT(*) FILTER (WHERE delayed),
          'arriving', COUNT(*) FILTER (WHERE arriving),
          'customs', COUNT(*) FILTER (WHERE customs))::text FROM flagged) AS "counts",
        COALESCE((
          SELECT json_agg(page.id)::text FROM (
            SELECT id FROM matching
            ORDER BY "updatedAt" DESC, id DESC
            LIMIT ${query.limit}::int OFFSET ${query.offset}::int
          ) page
        ), '[]') AS "ids"
    `
      .returnsRow({
        total: 'pg/int4@1',
        counts: 'pg/text@1',
        ids: 'pg/text@1',
      })
      .build();
    const [row] = await client.runtime().query(plan);
    const ids = JSON.parse(row.ids) as number[];
    return {
      items: await this.views(ids, false),
      total: row.total,
      counts: JSON.parse(row.counts) as Record<ShipmentView, number>,
    };
  }

  async getOne(reference: string) {
    const shipment = await this.prisma.client.orm.public.Shipment.where({
      reference,
    }).first();
    if (!shipment) throw new NotFoundException('Record not found.');
    const [view] = await this.views([shipment.id], true);
    return view;
  }

  /** Active staff who can be assigned to shipments and follow-ups (no customer accounts). */
  async staff() {
    const plan = this.prisma.client.raw.sql`
      SELECT u.id, COALESCE(u.name, u.email) AS name
      FROM "User" u
      WHERE u.status = 'active'
        AND EXISTS (SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r.id = ur."roleId"
                    WHERE ur."userId" = u.id AND r.code <> 'customer')
      ORDER BY 2, 1
    `
      .returnsRow({ id: 'pg/int4@1', name: 'pg/text@1' })
      .build();
    return this.prisma.client.runtime().query(plan);
  }

  /** Shipments made from a booking, for the booking page. */
  async forBooking(bookingId: number) {
    const rows = await this.prisma.client.orm.public.Shipment.where({
      bookingId,
    })
      .orderBy((s) => s.id.asc())
      .all();
    return rows.map((s) => ({ reference: s.reference, status: s.status }));
  }

  // --- Helpers ------------------------------------------------------------------------------

  /**
   * Repository owner, 2026-11-27 (CLAUDE.md §17 question 20): a booking becomes `completed` once
   * every one of its shipments is delivered. Called inside the transaction that delivers a
   * shipment, after that shipment is updated. The booking row is locked first, so two shipments
   * delivered at the same time are checked one after the other: the second sees the first's
   * committed delivery (READ COMMITTED) and completes the booking exactly once. Only a confirmed
   * booking is completed (the only status a booking with shipments can have, since shipments are
   * made from confirmed bookings and such bookings cannot be cancelled).
   */
  private async completeBookingIfDelivered(
    tx: Tx,
    bookingId: number,
    user: Principal,
  ) {
    const [locked] = await tx.query(
      this.prisma.client.raw.sql`
        SELECT id, status FROM "Booking" WHERE id = ${bookingId}::int FOR UPDATE
      `
        .returnsRow({ id: 'pg/int4@1', status: 'pg/text@1' })
        .build(),
    );
    if (!locked || locked.status !== 'confirmed') return;
    const shipments = await tx.orm.public.Shipment.where({ bookingId }).all();
    if (
      shipments.length === 0 ||
      shipments.some((s) => s.status !== 'delivered')
    ) {
      return;
    }
    const booking = (await tx.orm.public.Booking.first({ id: bookingId }))!;
    await tx.orm.public.Booking.where({ id: bookingId }).update({
      status: 'completed',
      updatedAt: new Date(),
    });
    await this.audit.record(tx, {
      actorUserId: user.id,
      entityType: 'Booking',
      entityId: bookingId,
      action: 'complete',
      summary: `${booking.reference} completed: all ${shipments.length} shipment${shipments.length === 1 ? '' : 's'} delivered`,
      changes: plainJson({
        before: { status: 'confirmed' },
        after: {
          status: 'completed',
          shipments: shipments.map((s) => s.reference),
        },
      }),
    });
  }

  private async lock(tx: Tx, reference: string): Promise<ShipmentRow> {
    const [row] = await tx.query(
      this.prisma.client.raw.sql`
        SELECT id FROM "Shipment" WHERE reference = ${reference}::text FOR UPDATE
      `
        .returnsRow({ id: 'pg/int4@1' })
        .build(),
    );
    if (!row) throw new NotFoundException('Record not found.');
    return (await tx.orm.public.Shipment.first({ id: row.id }))!;
  }

  private milestonesOf(tx: Pick<Tx, 'orm'>, shipmentId: number) {
    return tx.orm.public.ShipmentMilestone.where({ shipmentId })
      .orderBy((m) => m.sequence.asc())
      .all();
  }

  /**
   * Keeps the departure, arrival and delivery milestones in step with the shipment's times:
   * a recorded actual time completes the milestone, and estimated dates become planned dates.
   */
  private async syncMilestones(
    tx: Tx,
    shipmentId: number,
    before: ShipmentDates,
    after: ShipmentDates,
    user: Principal,
  ) {
    const milestones = await this.milestonesOf(tx, shipmentId);
    const now = new Date();
    for (const field of Object.keys(ACTUAL_MILESTONE) as ActualField[]) {
      const milestone = milestones.find((m) =>
        ACTUAL_MILESTONE[field].test(m.label),
      );
      if (!milestone) continue;
      const planned = PLANNED_FOR_ACTUAL[field];
      const patch: {
        actualAt?: Date | null;
        plannedAt?: Date | null;
        recordedById?: number;
      } = {};
      if (!sameTime(before[field], after[field])) {
        patch.actualAt = after[field];
        patch.recordedById = user.id;
      }
      if (!sameTime(before[planned], after[planned])) {
        patch.plannedAt = after[planned];
      }
      if (Object.keys(patch).length) {
        await tx.orm.public.ShipmentMilestone.where({
          id: milestone.id,
        }).update({
          ...patch,
          updatedAt: now,
        });
      }
    }
  }

  private routeProblems(origin: string, destination: string): FieldProblem[] {
    return origin.toLowerCase() === destination.toLowerCase()
      ? [
          {
            field: 'destination',
            messages: ['Destination must be different from the origin.'],
          },
        ]
      : [];
  }

  private async checkLinks(
    tx: Tx,
    links: {
      carrierId: number | null;
      agentId: number | null;
      assignedToId: number | null;
    },
  ) {
    if (links.carrierId) {
      await requirePartyWithRole(tx, links.carrierId, 'carrier', 'carrierId');
    }
    if (links.agentId) {
      await requirePartyWithRole(tx, links.agentId, 'agent', 'agentId');
    }
    if (links.assignedToId) {
      await this.requireStaff(tx, links.assignedToId, 'assignedToId');
    }
  }

  private async checkIssueLinks(
    tx: Tx,
    shipmentId: number,
    links: {
      affectedMilestoneId: number | null;
      followUpUserId: number | null;
    },
  ) {
    if (
      links.affectedMilestoneId &&
      !(await tx.orm.public.ShipmentMilestone.where({
        id: links.affectedMilestoneId,
        shipmentId,
      }).first())
    ) {
      throw validationFailed([
        {
          field: 'affectedMilestoneId',
          messages: ['Select a milestone of this shipment.'],
        },
      ]);
    }
    if (links.followUpUserId) {
      await this.requireStaff(tx, links.followUpUserId, 'followUpUserId');
    }
  }

  private async requireStaff(tx: Tx, userId: number, field: string) {
    const [row] = await tx.query(
      this.prisma.client.raw.sql`
        SELECT u.id FROM "User" u
        WHERE u.id = ${userId}::int AND u.status = 'active'
          AND EXISTS (SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r.id = ur."roleId"
                      WHERE ur."userId" = u.id AND r.code <> 'customer')
      `
        .returnsRow({ id: 'pg/int4@1' })
        .build(),
    );
    if (!row) {
      throw validationFailed([
        { field, messages: ['Select an active staff member.'] },
      ]);
    }
  }

  private quantity(value: string | null | undefined): Numeric<12, 3> | null {
    return value ? (normalizeDecimal(value, 3) as Numeric<12, 3>) : null;
  }

  /** What a caller sees. Lists carry milestones and issues too, for the tables' columns. */
  private async views(ids: number[], detail: boolean) {
    if (ids.length === 0) return [];
    const { orm } = this.prisma.client;
    const shipments = await orm.public.Shipment.where((s) =>
      s.id.in(ids),
    ).all();
    const bookingIds = shipments.flatMap((s) =>
      s.bookingId ? [s.bookingId] : [],
    );
    const partyIds = [
      ...new Set(
        shipments.flatMap((s) =>
          [s.customerId, s.carrierId, s.agentId].filter(
            (id): id is number => id !== null,
          ),
        ),
      ),
    ];
    const [
      parties,
      bookings,
      milestones,
      issues,
      containers,
      customs,
      history,
    ] = await Promise.all([
      orm.public.Party.where((p) => p.id.in(partyIds)).all(),
      bookingIds.length
        ? orm.public.Booking.where((b) => b.id.in(bookingIds)).all()
        : Promise.resolve([]),
      orm.public.ShipmentMilestone.where((m) => m.shipmentId.in(ids))
        .orderBy((m) => m.sequence.asc())
        .all(),
      orm.public.ShipmentIssue.where((i) => i.shipmentId.in(ids))
        .orderBy((i) => i.identifiedAt.desc())
        .all(),
      detail
        ? orm.public.Container.where((c) => c.shipmentId.in(ids))
            .orderBy((c) => c.id.asc())
            .all()
        : Promise.resolve([]),
      orm.public.CustomsEntry.where((c) => c.shipmentId.in(ids))
        .orderBy((c) => c.id.desc())
        .all(),
      detail
        ? orm.public.AuditLog.where({ entityType: 'Shipment' })
            .where((a) => a.entityId.in(ids))
            .orderBy((a) => a.id.asc())
            .all()
        : Promise.resolve([]),
    ]);
    const userIds = [
      ...new Set(
        [
          ...shipments.flatMap((s) => [s.assignedToId, s.createdById]),
          ...issues.flatMap((i) => [i.followUpUserId, i.createdById]),
          ...milestones.map((m) => m.recordedById),
          ...history.map((h) => h.actorUserId),
        ].filter((id): id is number => id !== null),
      ),
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
    const byId = new Map(shipments.map((s) => [s.id, s]));

    return ids.map((id) => {
      const s = byId.get(id)!;
      const booking = bookings.find((b) => b.id === s.bookingId);
      const own = milestones.filter((m) => m.shipmentId === id);
      const states = milestoneStates(own.map((m) => m.actualAt));
      const ownIssues = issues.filter((i) => i.shipmentId === id);
      const unresolved = ownIssues.filter((i) => i.status !== 'resolved');
      const entry = customs.find((c) => c.shipmentId === id);
      const active = s.status !== 'delivered';
      const ownHistory = history.filter((h) => h.entityId === id);
      const issueActions = (issueId: number) =>
        ownHistory
          .filter((h) => {
            const after = (h.changes as { after?: { issueId?: number } } | null)
              ?.after;
            return (
              ISSUE_ACTIONS.includes(h.action) && after?.issueId === issueId
            );
          })
          .map((h) => {
            const after = (
              h.changes as { after: { note?: string; at?: string } }
            ).after;
            return {
              at:
                h.action === 'issue_action' && after.at
                  ? after.at
                  : h.occurredAt,
              actor: person(h.actorUserId)?.name ?? 'System',
              note:
                h.action === 'issue_action' ? after.note! : (h.summary ?? ''),
              automatic: h.action !== 'issue_action',
            };
          });
      return {
        id: s.id,
        reference: s.reference,
        status: s.status,
        mode: s.mode,
        direction: s.direction,
        origin: s.origin,
        destination: s.destination,
        booking: booking
          ? {
              id: booking.id,
              reference: booking.reference,
              status: booking.status,
            }
          : null,
        customer: party(s.customerId)!,
        carrier: party(s.carrierId),
        agent: party(s.agentId),
        assignedTo: person(s.assignedToId),
        transportDocRef: s.transportDocRef,
        vesselOrFlight: s.vesselOrFlight,
        voyageNumber: s.voyageNumber,
        equipment: s.equipment,
        cargoDescription: s.cargoDescription,
        packages: s.packages,
        grossWeightKg: s.grossWeightKg,
        volumeCbm: s.volumeCbm,
        etd: s.etd,
        eta: s.eta,
        estimatedDeliveryAt: s.estimatedDeliveryAt,
        atd: s.atd,
        ata: s.ata,
        deliveredAt: s.deliveredAt,
        currentEta: currentEta(s.eta, ownIssues),
        needsAttention:
          active &&
          (s.status === 'on_hold' ||
            unresolved.length > 0 ||
            entry?.status === 'query'),
        customs: entry
          ? {
              reference: entry.reference,
              declarationNumber: entry.declarationNumber,
              regime: entry.regime,
              status: entry.status,
              customsStation: entry.customsStation,
              lodgedAt: entry.lodgedAt,
              assessedAt: entry.assessedAt,
              releasedAt: entry.releasedAt,
              queryDetails: entry.queryDetails,
              updatedAt: entry.updatedAt,
            }
          : null,
        milestones: own.map((m, i) => ({
          id: m.id,
          sequence: m.sequence,
          label: m.label,
          location: m.location,
          plannedAt: m.plannedAt,
          actualAt: m.actualAt,
          note: m.note,
          state: states[i],
          recordedBy: person(m.recordedById),
        })),
        issues: ownIssues.map((i) => ({
          id: i.id,
          type: i.type,
          severity: i.severity,
          reason: i.reason,
          reasonDetail: i.reasonDetail,
          identifiedAt: i.identifiedAt,
          affectedMilestone: (() => {
            const m = own.find((x) => x.id === i.affectedMilestoneId);
            return m ? { id: m.id, label: m.label } : null;
          })(),
          originalExpectedAt: i.originalExpectedAt,
          revisedExpectedAt: i.revisedExpectedAt,
          affectsEta: i.affectsEta,
          followUpUser: person(i.followUpUserId),
          status: i.status,
          nextAction: i.nextAction,
          notes: i.notes,
          resolvedAt: i.resolvedAt,
          resolution: i.resolution,
          customerNotification: i.customerNotification,
          customerNotifiedAt: i.customerNotifiedAt,
          createdBy: person(i.createdById),
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
          ...(detail ? { actions: issueActions(i.id) } : {}),
        })),
        createdBy: person(s.createdById),
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        ...(detail
          ? {
              containers: containers
                .filter((c) => c.shipmentId === id)
                .map((c) => ({
                  id: c.id,
                  containerNumber: c.containerNumber,
                  type: c.type,
                  sealNumber: c.sealNumber,
                  grossWeightKg: c.grossWeightKg,
                  packages: c.packages,
                })),
              history: ownHistory.map((h) => ({
                id: h.id,
                at: h.occurredAt,
                actor: person(h.actorUserId)?.name ?? 'System',
                action: h.action,
                summary: h.summary ?? h.action,
              })),
            }
          : {}),
      };
    });
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Every job has a planned ETA (as in the demo form); a booking without one needs it entered. */
const etaProblems = (eta: Date | null): FieldProblem[] =>
  eta
    ? []
    : [{ field: 'eta', messages: ['Enter the estimated arrival date.'] }];

const pickDates = (s: ShipmentDates): ShipmentDates => ({
  etd: s.etd,
  eta: s.eta,
  estimatedDeliveryAt: s.estimatedDeliveryAt,
  atd: s.atd,
  ata: s.ata,
  deliveredAt: s.deliveredAt,
});

const words = (code: string) => code.replaceAll('_', ' ');

const statusLabel = (status: ShipmentStatus) => {
  const text = words(status);
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const FIELD_LABELS: Record<string, string> = {
  carrierId: 'carrier',
  agentId: 'agent',
  assignedToId: 'assigned to',
  transportDocRef: 'transport document number',
  vesselOrFlight: 'vessel or flight',
  voyageNumber: 'voyage number',
  cargoDescription: 'cargo description',
  grossWeightKg: 'gross weight',
  volumeCbm: 'volume',
  etd: 'ETD',
  eta: 'ETA',
  estimatedDeliveryAt: 'estimated delivery',
  atd: 'actual departure',
  ata: 'actual arrival',
  deliveredAt: 'actual delivery',
};
const fieldLabel = (field: string) => FIELD_LABELS[field] ?? field;

function describeIssueChange(
  before: { status: string; revisedExpectedAt: Date | null; severity: string },
  next: { status: string; revisedExpectedAt: Date | null; severity: string },
  changed: string[],
): string {
  const parts: string[] = [];
  if (changed.includes('status')) {
    parts.push(
      `Status changed from "${words(before.status)}" to "${words(next.status)}".`,
    );
  }
  if (changed.includes('revisedExpectedAt')) {
    parts.push(
      next.revisedExpectedAt
        ? `Revised expected date set to ${nairobiTime(next.revisedExpectedAt)}.`
        : 'Revised expected date cleared.',
    );
  }
  if (changed.includes('severity')) {
    parts.push(`Severity changed from ${before.severity} to ${next.severity}.`);
  }
  const others = changed.filter(
    (c) => !['status', 'revisedExpectedAt', 'severity'].includes(c),
  );
  if (others.length) {
    parts.push(
      `Updated: ${others.map((c) => words(c.replace(/Id$/, ''))).join(', ')}.`,
    );
  }
  return `Delay or issue updated. ${parts.join(' ')}`.trim();
}

const NAIROBI_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Nairobi',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
/** For history summaries, which people read: "26 Nov 2026, 14:30" (Nairobi time). */
const nairobiTime = (value: Date) => NAIROBI_TIME.format(value);
