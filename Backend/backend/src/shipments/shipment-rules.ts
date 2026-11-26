// Pure shipment rules (no database access), so they can be unit-tested.
// Approved plan (docs/backend-implementation-plan.md §6, Phase 3): shipments from a booking or
// standalone; milestones; delays with notes; containers; customs summary; history; the current
// ETA from open delays; status rules such as "delivered needs a delivery time". The rules mirror
// the frontend demo's (Frontend/frontend/lib/shipment-form.ts, shipment-changes.ts, metrics.ts).

import type { FieldProblem } from '../common/validation-exception.js';

export const SHIPMENT_STATUSES = [
  'booked',
  'in_transit',
  'arrived',
  'customs',
  'released',
  'out_for_delivery',
  'delivered',
  'on_hold',
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const SHIPMENT_VIEWS = [
  'all',
  'active',
  'attention',
  'delayed',
  'arriving',
  'customs',
] as const;
export type ShipmentView = (typeof SHIPMENT_VIEWS)[number];

export const CONTAINER_TYPES = [
  'dry_20',
  'dry_40',
  'high_cube_40',
  'reefer_20',
  'reefer_40',
  'open_top',
  'flat_rack',
  'other',
] as const;

export const ISSUE_TYPES = [
  'delay',
  'damage',
  'documentation',
  'customs_query',
  'other',
] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const SEVERITIES = ['low', 'medium', 'high'] as const;
export const ISSUE_STATUSES = ['open', 'monitoring', 'resolved'] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const DELAY_REASONS = [
  'port_congestion',
  'border_queue',
  'carrier_schedule',
  'customs_query',
  'missing_documents',
  'permit_pending',
  'payment_pending',
  'equipment_shortage',
  'weather',
  'other',
] as const;

export const CUSTOMER_NOTIFICATIONS = [
  'not_notified',
  'informed_manually',
  'not_required',
] as const;

/** Departure, arrival and delivery are both shipment fields and milestones; these labels link them. */
export const ACTUAL_MILESTONE = {
  atd: /^departed/i,
  ata: /^arrived/i,
  deliveredAt: /^delivered/i,
} as const;
export type ActualField = keyof typeof ACTUAL_MILESTONE;

export const PLANNED_FOR_ACTUAL = {
  atd: 'etd',
  ata: 'eta',
  deliveredAt: 'estimatedDeliveryAt',
} as const;

const before = (a: Date, b: Date) => a.getTime() < b.getTime();

// --- Milestones ---------------------------------------------------------------------------

export interface PlannedMilestone {
  label: string;
  location: string | null;
  plannedAt: Date | null;
  actualAt: Date | null;
}

/**
 * Standard milestones for a new job, as the demo creates them. A job from a confirmed booking
 * starts with "Booking confirmed" done; a standalone (for example clearing-only) job with "Job opened".
 */
export function defaultMilestones(
  input: {
    direction: 'import' | 'export' | 'transit';
    origin: string;
    destination: string;
    etd: Date | null;
    eta: Date | null;
    estimatedDeliveryAt: Date | null;
    fromBooking: boolean;
  },
  now: Date,
): PlannedMilestone[] {
  const step = (
    label: string,
    plannedAt: Date | null = null,
    location: string | null = null,
  ): PlannedMilestone => ({ label, location, plannedAt, actualAt: null });
  const steps: PlannedMilestone[] = [
    {
      ...step(input.fromBooking ? 'Booking confirmed' : 'Job opened'),
      actualAt: now,
    },
  ];
  if (input.direction === 'export') steps.push(step('Export customs cleared'));
  if (input.direction === 'transit') steps.push(step('Transit entry lodged'));
  steps.push(
    step('Departed origin', input.etd, input.origin),
    step(`Arrived ${input.destination}`, input.eta, input.destination),
  );
  if (input.direction === 'import') {
    steps.push(step('Customs clearance'), step('Released'));
  }
  steps.push(step('Delivered', input.estimatedDeliveryAt));
  return steps;
}

export type MilestoneState = 'done' | 'current' | 'pending';

/**
 * Done, current or pending, derived from the recorded actual times (the schema stores no state).
 * Everything up to the last milestone with an actual time is done (an earlier one may have no
 * time recorded); the next one is current.
 */
export function milestoneStates(
  actuals: readonly (Date | null)[],
): MilestoneState[] {
  const lastDone = actuals.findLastIndex((a) => a !== null);
  return actuals.map((_, i) =>
    i <= lastDone ? 'done' : i === lastDone + 1 ? 'current' : 'pending',
  );
}

/** Why an actual time cannot be recorded (or cleared) on milestone `index`, or null. */
export function milestoneActualProblem(
  milestones: readonly { label: string; actualAt: Date | null }[],
  index: number,
  actualAt: Date | null,
  now: Date,
): string | null {
  const later = milestones.slice(index + 1);
  if (actualAt === null) {
    return later.some((m) => m.actualAt !== null)
      ? 'A later milestone is already completed. Clear the later milestones first.'
      : null;
  }
  if (before(now, actualAt)) return 'An actual time cannot be in the future.';
  // The first milestone records when the job was opened or its booking confirmed. Jobs are often
  // opened after the cargo has left (clearing-only work), so it does not order the later ones.
  if (index === 0) return null;
  const previous = milestones
    .slice(1, index)
    .findLast((m) => m.actualAt !== null);
  if (previous?.actualAt && before(actualAt, previous.actualAt)) {
    return `Must be on or after the previous completed milestone (${previous.label}).`;
  }
  const next = later.find((m) => m.actualAt !== null);
  if (next?.actualAt && before(next.actualAt, actualAt)) {
    return `Must be on or before the next completed milestone (${next.label}).`;
  }
  return null;
}

// --- Shipment dates and status -------------------------------------------------------------

export interface ShipmentDates {
  etd: Date | null;
  eta: Date | null;
  estimatedDeliveryAt: Date | null;
  atd: Date | null;
  ata: Date | null;
  deliveredAt: Date | null;
}

/** Estimated dates in order; actual dates in order and not in the future. */
export function dateProblems(d: ShipmentDates, now: Date): FieldProblem[] {
  const problems: FieldProblem[] = [];
  const add = (field: string, message: string) =>
    problems.push({ field, messages: [message] });
  if (d.etd && d.eta && before(d.eta, d.etd)) {
    add('eta', 'The ETA cannot be before the ETD.');
  }
  if (d.eta && d.estimatedDeliveryAt && before(d.estimatedDeliveryAt, d.eta)) {
    add('estimatedDeliveryAt', 'Estimated delivery cannot be before the ETA.');
  }
  for (const field of ['atd', 'ata', 'deliveredAt'] as const) {
    const value = d[field];
    if (value && before(now, value)) {
      add(field, 'An actual date cannot be in the future.');
    }
  }
  if (d.atd && d.ata && before(d.ata, d.atd)) {
    add('ata', 'Actual arrival cannot be before actual departure.');
  }
  if (d.deliveredAt) {
    if (d.ata && before(d.deliveredAt, d.ata)) {
      add('deliveredAt', 'Actual delivery cannot be before actual arrival.');
    } else if (d.atd && before(d.deliveredAt, d.atd)) {
      add('deliveredAt', 'Actual delivery cannot be before actual departure.');
    }
  }
  return problems;
}

/** The status and the actual dates must agree ("delivered needs a delivery time"). */
export function statusProblems(
  status: ShipmentStatus,
  d: Pick<ShipmentDates, 'ata' | 'deliveredAt'>,
): FieldProblem[] {
  const problems: FieldProblem[] = [];
  if (status === 'delivered' && !d.deliveredAt) {
    problems.push({
      field: 'deliveredAt',
      messages: [
        'Enter the actual delivery time to mark the shipment as delivered.',
      ],
    });
  }
  if (status !== 'delivered' && d.deliveredAt) {
    problems.push({
      field: 'status',
      messages: [
        'A shipment with an actual delivery time must have the status "delivered".',
      ],
    });
  }
  if (status === 'arrived' && !d.ata) {
    problems.push({
      field: 'ata',
      messages: [
        'Enter the actual arrival time to mark the shipment as arrived.',
      ],
    });
  }
  return problems;
}

/** Delivered is final: a delivered job's status does not change (no reopening in Phase 3). */
export function statusChangeProblem(
  from: ShipmentStatus,
  to: ShipmentStatus,
): string | null {
  if (from === to) return `The shipment is already ${to}.`;
  if (from === 'delivered') {
    return 'This shipment has been delivered. Its status can no longer change.';
  }
  return null;
}

// --- Delays and other issues ---------------------------------------------------------------

export interface IssueForEta {
  type: IssueType;
  status: IssueStatus;
  affectsEta: boolean;
  revisedExpectedAt: Date | null;
  identifiedAt: Date;
}

/**
 * The ETA to plan with (approved plan: "current ETA from open delays"): the revised date of the
 * most recently identified unresolved delay that affects the ETA, otherwise the planned ETA.
 */
export function currentEta(
  plannedEta: Date | null,
  issues: readonly IssueForEta[],
): { at: Date | null; revised: boolean } {
  const revision = issues
    .filter(
      (i) =>
        i.type === 'delay' &&
        i.status !== 'resolved' &&
        i.affectsEta &&
        i.revisedExpectedAt !== null,
    )
    .sort((a, b) => b.identifiedAt.getTime() - a.identifiedAt.getTime())[0];
  return revision
    ? { at: revision.revisedExpectedAt, revised: true }
    : { at: plannedEta, revised: false };
}

export interface IssueState {
  type: IssueType;
  reason: (typeof DELAY_REASONS)[number] | null;
  identifiedAt: Date;
  originalExpectedAt: Date | null;
  revisedExpectedAt: Date | null;
  affectsEta: boolean;
  status: IssueStatus;
  resolvedAt: Date | null;
  customerNotification: (typeof CUSTOMER_NOTIFICATIONS)[number];
  customerNotifiedAt: Date | null;
}

/** Checks a delay or other issue as it would be saved. */
export function issueProblems(i: IssueState, now: Date): FieldProblem[] {
  const problems: FieldProblem[] = [];
  const add = (field: string, message: string) =>
    problems.push({ field, messages: [message] });
  if (i.type === 'delay') {
    if (!i.reason) add('reason', 'Select the delay reason.');
    if (!i.originalExpectedAt) {
      add(
        'originalExpectedAt',
        'Enter the date that was expected before the delay.',
      );
    }
  } else {
    if (i.reason) add('reason', 'A reason is recorded for delays only.');
    if (i.affectsEta) add('affectsEta', 'Only a delay can change the ETA.');
  }
  // affectsEta without a revised date is allowed: the date is often unknown at first, and the
  // ETA stays as planned until it is set.
  if (before(now, i.identifiedAt)) {
    add('identifiedAt', 'The date identified cannot be in the future.');
  }
  if (i.status === 'resolved') {
    if (!i.resolvedAt) add('resolvedAt', 'Enter when the issue was resolved.');
    else if (before(now, i.resolvedAt)) {
      add('resolvedAt', 'The date resolved cannot be in the future.');
    } else if (before(i.resolvedAt, i.identifiedAt)) {
      add(
        'resolvedAt',
        'The date resolved cannot be before the date identified.',
      );
    }
  } else if (i.resolvedAt) {
    add('resolvedAt', 'Only a resolved issue has a date resolved.');
  }
  if (i.customerNotification === 'informed_manually') {
    if (!i.customerNotifiedAt) {
      add('customerNotifiedAt', 'Enter when the customer was informed.');
    } else if (before(now, i.customerNotifiedAt)) {
      add('customerNotifiedAt', 'This date cannot be in the future.');
    }
  } else if (i.customerNotifiedAt) {
    add(
      'customerNotifiedAt',
      'Record a date only when the customer was informed.',
    );
  }
  return problems;
}

// --- Containers ---------------------------------------------------------------------------

/** ISO 6346 shape, as the schema checks it: four letters and seven digits. */
export const CONTAINER_NUMBER = /^[A-Z]{4}[0-9]{7}$/;

export function normalizeContainerNumber(value: string): string {
  return value.replace(/[\s-]/g, '').toUpperCase();
}
