// Pure operations that produce updated shipment records and their change
// history. Used by the in-browser session store (lib/data/session-store.tsx);
// with a real backend these rules belong on the server (docs/api-contracts.md).

import { isBefore } from '@/lib/dates';
import type { DelayInput } from '@/lib/delay-form';
import { formatDate, formatDateTime } from '@/lib/format';
import { customerNotificationMeta, delayReasonLabel, delayStatusMeta, severityMeta, shipmentStatusMeta } from '@/lib/labels';
import type { ShipmentInput } from '@/lib/shipment-form';
import type { FieldErrors } from '@/lib/validation';
import { shipmentFieldLabel } from '@/lib/shipment-form';
import type {
  DelayAction,
  Milestone,
  MilestoneState,
  Shipment,
  ShipmentDelay,
  ShipmentEvent,
  ShipmentEventKind,
  TransportMode,
} from '@/lib/types';

/** Shown as the author of changes, because there is no sign-in yet. */
export const SESSION_ACTOR = 'You (demo session)';

export interface ChangeContext {
  /** Current time (ISO). */
  now: string;
  actor: string;
}

let idCounter = 0;
/** Unique within the browser session; real IDs will come from the backend. */
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

function event(kind: ShipmentEventKind, message: string, ctx: ChangeContext): ShipmentEvent {
  return { id: newId('ev'), at: ctx.now, actor: ctx.actor, kind, message };
}

/** Next reference in the existing `FMS-<MODE>-<YYMM>-<NNNN>` pattern; NNNN continues the highest number in use. */
export function nextShipmentReference(existing: Shipment[], mode: TransportMode, now: string): string {
  const yymm = `${now.slice(2, 4)}${now.slice(5, 7)}`;
  const highest = existing.reduce((max, s) => {
    const n = Number(s.reference.split('-').at(-1));
    return Number.isInteger(n) && n > max ? n : max;
  }, 0);
  return `FMS-${mode.toUpperCase()}-${yymm}-${String(highest + 1).padStart(4, '0')}`;
}

// --- Milestones -------------------------------------------------------------

/**
 * Makes milestone states consistent: everything before the last completed
 * milestone is completed (its date stays unknown if it was not recorded), and
 * exactly one later milestone is current: the first one already marked
 * current, otherwise the one right after the last completed milestone.
 */
export function normalizeMilestones(milestones: Milestone[]): Milestone[] {
  const lastDone = milestones.findLastIndex((m) => m.state === 'done');
  const explicitCurrent = milestones.findIndex((m, i) => i > lastDone && m.state === 'current');
  const currentIndex = explicitCurrent >= 0 ? explicitCurrent : lastDone + 1;
  return milestones.map((m, i): Milestone => {
    if (i < lastDone) return m.state === 'done' ? m : { ...m, state: 'done' };
    if (i === lastDone) return m;
    if (i === currentIndex) return m.state === 'current' ? m : { ...m, state: 'current' };
    return m.state === 'pending' ? m : { ...m, state: 'pending', at: undefined };
  });
}

const DEPARTED = /^departed/i;
const ARRIVED = /^arrived/i;
const DELIVERED = /^delivered/i;

/** Marks the first matching, not-yet-completed milestone as done at `at`. */
function completeMilestone(milestones: Milestone[], pattern: RegExp, at: string | undefined): Milestone[] {
  if (!at) return milestones;
  const index = milestones.findIndex((m) => pattern.test(m.label));
  if (index < 0 || milestones[index].state === 'done') return milestones;
  return milestones.map((m, i) => (i === index ? { ...m, state: 'done', at } : m));
}

function syncActualDates(milestones: Milestone[], input: Pick<ShipmentInput, 'atd' | 'ata' | 'deliveredAt'>) {
  let result = completeMilestone(milestones, DEPARTED, input.atd);
  result = completeMilestone(result, ARRIVED, input.ata);
  result = completeMilestone(result, DELIVERED, input.deliveredAt);
  return normalizeMilestones(result);
}

/** Standard milestones for a new job, with planned dates from the estimates. */
export function defaultMilestones(input: ShipmentInput, now: string): Milestone[] {
  const steps: Milestone[] = [{ label: 'Booking confirmed', state: 'done', at: now }];
  if (input.direction === 'export') steps.push({ label: 'Export customs cleared', state: 'pending' });
  if (input.direction === 'transit') steps.push({ label: 'Transit entry lodged', state: 'pending' });
  steps.push(
    { label: 'Departed origin', state: 'pending', plannedAt: input.etd, location: input.origin },
    { label: `Arrived ${input.destination}`, state: 'pending', plannedAt: input.eta, location: input.destination },
  );
  if (input.direction === 'import') {
    steps.push({ label: 'Customs clearance', state: 'pending' }, { label: 'Released', state: 'pending' });
  }
  steps.push({ label: 'Delivered', state: 'pending', plannedAt: input.estimatedDeliveryAt });
  return syncActualDates(steps, input);
}

export interface MilestoneUpdate {
  state: MilestoneState;
  at?: string;
  location?: string;
}

export type MilestoneField = 'state' | 'at' | 'location';

/** Checks that a milestone update keeps the timeline chronological. */
export function validateMilestoneUpdate(
  s: Shipment,
  index: number,
  update: MilestoneUpdate,
  now: string,
): FieldErrors<MilestoneField> {
  const errors: FieldErrors<MilestoneField> = {};
  const later = s.milestones.slice(index + 1);
  if (update.state !== 'done' && later.some((m) => m.state === 'done')) {
    errors.state = 'A later milestone is already completed. Update the later milestones first.';
  }
  if (update.state === 'done' && !update.at) errors.at = 'Enter when this milestone was completed.';
  if (update.at) {
    if (isBefore(now, update.at)) errors.at = 'An actual date cannot be in the future.';
    const previous = s.milestones.slice(0, index).findLast((m) => m.state === 'done' && m.at);
    const next = later.find((m) => m.state === 'done' && m.at);
    if (!errors.at && previous?.at && isBefore(update.at, previous.at)) {
      errors.at = `Must be on or after the previous milestone (${previous.label}, ${formatDateTime(previous.at)}).`;
    } else if (!errors.at && next?.at && isBefore(next.at, update.at)) {
      errors.at = `Must be on or before the next completed milestone (${next.label}, ${formatDateTime(next.at)}).`;
    }
  }
  if ((update.location ?? '').length > 120) errors.location = 'Use 120 characters or fewer.';
  return errors;
}

const milestoneStateText: Record<MilestoneState, string> = { done: 'completed', current: 'in progress', pending: 'not started' };

export function applyMilestoneUpdate(s: Shipment, index: number, update: MilestoneUpdate, ctx: ChangeContext): Shipment {
  const before = s.milestones[index];
  const at = update.state === 'pending' ? undefined : update.at;
  const updated: Milestone = { ...before, state: update.state, at, location: update.location || undefined };
  // A milestone set to "current" demotes any other current one, so normalisation keeps this choice.
  const milestones = s.milestones.map((m, i) =>
    i === index ? updated : update.state === 'current' && m.state === 'current' ? { ...m, state: 'pending' as const } : m,
  );
  const when = at ? ` (${formatDateTime(at)})` : '';
  return {
    ...s,
    milestones: normalizeMilestones(milestones),
    events: [...s.events, event('milestone_updated', `Milestone "${before.label}" marked ${milestoneStateText[update.state]}${when}.`, ctx)],
    updatedAt: ctx.now,
  };
}

// --- Shipments --------------------------------------------------------------

export function createShipment(input: ShipmentInput, existing: Shipment[], ctx: ChangeContext): Shipment {
  const reference = nextShipmentReference(existing, input.mode, ctx.now);
  return {
    reference,
    ...input,
    customs: { status: 'not_started', updatedAt: ctx.now },
    milestones: defaultMilestones(input, ctx.now),
    exceptions: [],
    delays: [],
    events: [event('created', `Shipment created with status "${shipmentStatusMeta[input.status].label}".`, ctx)],
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
}

const estimatedDateFields = ['etd', 'eta', 'estimatedDeliveryAt'] as const;
const actualDateFields = ['atd', 'ata', 'deliveredAt'] as const;
const detailFields = [
  'customerId',
  'direction',
  'mode',
  'origin',
  'destination',
  'carrier',
  'transportDocRef',
  'equipment',
  'cargoDescription',
  'packages',
  'weightKg',
  'assignedTo',
  'agentName',
  'agentRouteId',
] as const;

/** Applies validated edits and records what changed. Returns the same object when nothing changed. */
export function applyShipmentUpdate(s: Shipment, input: ShipmentInput, ctx: ChangeContext, note?: string): Shipment {
  const events: ShipmentEvent[] = [];
  const suffix = note ? ` Note: ${note}` : '';

  if (input.status !== s.status) {
    events.push(
      event('status_changed', `Status changed from "${shipmentStatusMeta[s.status].label}" to "${shipmentStatusMeta[input.status].label}".${suffix}`, ctx),
    );
  }
  for (const field of estimatedDateFields) {
    if (input[field] !== s[field]) {
      const label = shipmentFieldLabel[field];
      const to = input[field] ? formatDate(input[field]) : 'not set';
      events.push(event('updated', s[field] ? `${label} changed from ${formatDate(s[field])} to ${to}.` : `${label} set to ${to}.`, ctx));
    }
  }
  for (const field of actualDateFields) {
    if (input[field] !== s[field]) {
      const label = shipmentFieldLabel[field];
      events.push(
        event('updated', input[field] ? `${label} recorded: ${formatDateTime(input[field])}.` : `${label} cleared.`, ctx),
      );
    }
  }
  const changedDetails = detailFields.filter((field) => input[field] !== s[field]);
  if (changedDetails.length > 0) {
    const names = changedDetails.map((f) => shipmentFieldLabel[f].toLowerCase());
    events.push(event('updated', `Details updated: ${names.join(', ')}.`, ctx));
  }

  if (events.length === 0) return s;
  return {
    ...s,
    ...input,
    milestones: syncActualDates(s.milestones, input),
    events: [...s.events, ...events],
    updatedAt: ctx.now,
  };
}

// --- Delays -----------------------------------------------------------------

function action(note: string, ctx: ChangeContext, automatic = true): DelayAction {
  return { id: newId('da'), at: ctx.now, actor: ctx.actor, note, automatic };
}

function describeDelayChanges(before: ShipmentDelay, after: DelayInput): string[] {
  const changes: string[] = [];
  if (before.status !== after.status) {
    changes.push(`Status changed from "${delayStatusMeta[before.status].label}" to "${delayStatusMeta[after.status].label}".`);
  }
  if (before.revisedExpectedAt !== after.revisedExpectedAt) {
    changes.push(
      after.revisedExpectedAt
        ? `Revised expected date ${before.revisedExpectedAt ? `changed from ${formatDateTime(before.revisedExpectedAt)} ` : 'set '}to ${formatDateTime(after.revisedExpectedAt)}.`
        : 'Revised expected date cleared.',
    );
  }
  if (before.originalExpectedAt !== after.originalExpectedAt) {
    changes.push(`Original expected date corrected to ${formatDateTime(after.originalExpectedAt)}.`);
  }
  if (before.severity !== after.severity) {
    changes.push(`Severity changed from ${severityMeta[before.severity].label} to ${severityMeta[after.severity].label}.`);
  }
  if (before.followUpBy !== after.followUpBy) changes.push(`Follow-up reassigned to ${after.followUpBy}.`);
  if (before.customerNotification !== after.customerNotification || before.customerNotifiedAt !== after.customerNotifiedAt) {
    changes.push(`${customerNotificationMeta[after.customerNotification].label}${after.customerNotifiedAt ? ` (${formatDateTime(after.customerNotifiedAt)})` : ''}.`);
  }
  if (before.nextAction !== after.nextAction && after.nextAction) changes.push(`Next action: ${after.nextAction}`);
  const otherChanged =
    before.reason !== after.reason ||
    before.reasonDetail !== after.reasonDetail ||
    before.milestone !== after.milestone ||
    before.identifiedAt !== after.identifiedAt ||
    before.affectsEta !== after.affectsEta ||
    before.notes !== after.notes ||
    before.resolvedAt !== after.resolvedAt;
  if (changes.length === 0 && otherChanged) changes.push('Delay details updated.');
  return changes;
}

/** Records a new delay (no `delayId`) or applies edits to an existing one. Returns the same object when nothing changed. */
export function applyDelay(s: Shipment, input: DelayInput, ctx: ChangeContext, delayId?: string): Shipment {
  const label = `${delayReasonLabel[input.reason]} (${severityMeta[input.severity].label.toLowerCase()} severity)`;

  if (!delayId) {
    const delay: ShipmentDelay = {
      ...input,
      id: newId('dl'),
      actions: [action('Delay recorded.', ctx)],
      updatedAt: ctx.now,
    };
    const events = [event('delay_recorded', `Delay recorded: ${label}, affecting "${input.milestone}".`, ctx)];
    if (input.affectsEta && input.revisedExpectedAt) {
      events.push(event('delay_updated', `ETA revised to ${formatDateTime(input.revisedExpectedAt)} because of this delay.`, ctx));
    }
    return { ...s, delays: [...s.delays, delay], events: [...s.events, ...events], updatedAt: ctx.now };
  }

  const before = s.delays.find((d) => d.id === delayId);
  if (!before) return s;
  const changes = describeDelayChanges(before, input);
  if (changes.length === 0) return s;
  const updated: ShipmentDelay = {
    ...before,
    ...input,
    actions: [...before.actions, ...changes.map((c) => action(c, ctx))],
    updatedAt: ctx.now,
  };
  return {
    ...s,
    delays: s.delays.map((d) => (d.id === delayId ? updated : d)),
    events: [...s.events, event('delay_updated', `Delay updated (${delayReasonLabel[input.reason]}): ${changes.join(' ')}`, ctx)],
    updatedAt: ctx.now,
  };
}

/** Adds a manual "action taken" entry to a delay. */
export function addDelayAction(s: Shipment, delayId: string, note: string, at: string, ctx: ChangeContext): Shipment {
  const entry: DelayAction = { id: newId('da'), at, actor: ctx.actor, note };
  return {
    ...s,
    delays: s.delays.map((d) =>
      d.id === delayId
        ? { ...d, actions: [...d.actions, entry].sort((a, b) => a.at.localeCompare(b.at)), updatedAt: ctx.now }
        : d,
    ),
    events: [...s.events, event('delay_updated', `Delay action recorded: ${note}`, ctx)],
    updatedAt: ctx.now,
  };
}

/** Appends a history event, e.g. for document uploads and reviews. */
export function addShipmentEvent(s: Shipment, kind: ShipmentEventKind, message: string, ctx: ChangeContext): Shipment {
  return { ...s, events: [...s.events, event(kind, message, ctx)], updatedAt: ctx.now };
}
