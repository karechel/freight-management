// Delay record/edit form: field values, validation and conversion to a typed
// input. Pure functions, no React. The UI never fills in a reason or a revised
// date on the user's behalf.

import { fromDateTimeInput, isBefore, toDateTimeInput } from '@/lib/dates';
import { customerNotificationMeta, delayReasonLabel, delayStatusMeta, severityMeta } from '@/lib/labels';
import { currentEta } from '@/lib/metrics';
import type { FieldErrors } from '@/lib/validation';
import type {
  CustomerNotificationStatus,
  DelayReason,
  DelayStatus,
  Severity,
  Shipment,
  ShipmentDelay,
} from '@/lib/types';

export interface DelayFormValues {
  reason: string;
  reasonDetail: string;
  identifiedAt: string;
  severity: string;
  milestone: string;
  originalExpectedAt: string;
  revisedExpectedAt: string;
  affectsEta: boolean;
  followUpBy: string;
  status: string;
  nextAction: string;
  notes: string;
  resolvedAt: string;
  customerNotification: string;
  customerNotifiedAt: string;
}

export type DelayField = keyof DelayFormValues;

export type DelayInput = Omit<ShipmentDelay, 'id' | 'actions' | 'updatedAt'>;

export const delayFieldLabel: Record<DelayField, string> = {
  reason: 'Delay reason',
  reasonDetail: 'What happened',
  identifiedAt: 'Date identified',
  severity: 'Severity',
  milestone: 'Affected milestone',
  originalExpectedAt: 'Original expected date',
  revisedExpectedAt: 'Revised expected date',
  affectsEta: 'Use revised date as the shipment ETA',
  followUpBy: 'Responsible for follow-up',
  status: 'Delay status',
  nextAction: 'Next action',
  notes: 'Notes',
  resolvedAt: 'Date resolved',
  customerNotification: 'Customer notification',
  customerNotifiedAt: 'Date customer was informed',
};

/** New-delay defaults: current milestone and current ETA, both visible and editable. No reason or revised date. */
export function emptyDelayForm(s: Shipment): DelayFormValues {
  const current = s.milestones.find((m) => m.state === 'current');
  return {
    reason: '',
    reasonDetail: '',
    identifiedAt: '',
    severity: '',
    milestone: current?.label ?? '',
    originalExpectedAt: toDateTimeInput(current?.plannedAt ?? currentEta(s).at),
    revisedExpectedAt: '',
    affectsEta: true,
    followUpBy: s.assignedTo,
    status: 'open',
    nextAction: '',
    notes: '',
    resolvedAt: '',
    customerNotification: 'not_notified',
    customerNotifiedAt: '',
  };
}

export function delayToForm(d: ShipmentDelay): DelayFormValues {
  return {
    reason: d.reason,
    reasonDetail: d.reasonDetail,
    identifiedAt: toDateTimeInput(d.identifiedAt),
    severity: d.severity,
    milestone: d.milestone,
    originalExpectedAt: toDateTimeInput(d.originalExpectedAt),
    revisedExpectedAt: toDateTimeInput(d.revisedExpectedAt),
    affectsEta: d.affectsEta,
    followUpBy: d.followUpBy,
    status: d.status,
    nextAction: d.nextAction ?? '',
    notes: d.notes ?? '',
    resolvedAt: toDateTimeInput(d.resolvedAt),
    customerNotification: d.customerNotification,
    customerNotifiedAt: toDateTimeInput(d.customerNotifiedAt),
  };
}

export interface DelayFormContext {
  milestones: string[];
  staff: string[];
  /** Current time (ISO). Identified, resolved and notified dates may not be later than this. */
  now: string;
}

export function validateDelayForm(
  values: DelayFormValues,
  ctx: DelayFormContext,
): { errors: FieldErrors<DelayField>; input?: DelayInput } {
  const errors: FieldErrors<DelayField> = {};
  const text = (field: Exclude<DelayField, 'affectsEta'>) => values[field].trim();

  const reason = text('reason');
  if (!reason) errors.reason = 'Select the reason for the delay.';
  else if (!Object.hasOwn(delayReasonLabel, reason)) errors.reason = 'Select a reason from the list.';

  const reasonDetail = text('reasonDetail');
  if (!reasonDetail) errors.reasonDetail = 'Describe what caused the delay.';
  else if (reasonDetail.length > 500) errors.reasonDetail = 'Use 500 characters or fewer.';

  const severity = text('severity');
  if (!severity) errors.severity = 'Select the severity.';
  else if (!Object.hasOwn(severityMeta, severity)) errors.severity = 'Select a severity from the list.';

  const milestone = text('milestone');
  if (!milestone) errors.milestone = 'Select the milestone the delay affects.';
  else if (!ctx.milestones.includes(milestone)) errors.milestone = 'Select a milestone from the list.';

  const followUpBy = text('followUpBy');
  if (!followUpBy) errors.followUpBy = 'Select who will follow up.';
  else if (!ctx.staff.includes(followUpBy)) errors.followUpBy = 'Select a staff member from the list.';

  const status = text('status');
  if (!Object.hasOwn(delayStatusMeta, status)) errors.status = 'Select a status from the list.';

  const customerNotification = text('customerNotification');
  if (!Object.hasOwn(customerNotificationMeta, customerNotification)) {
    errors.customerNotification = 'Select the customer notification status.';
  }

  const nextAction = text('nextAction');
  if (status === 'open' && !nextAction) errors.nextAction = 'Enter the next action for an open delay.';
  else if (nextAction.length > 300) errors.nextAction = 'Use 300 characters or fewer.';

  const notes = text('notes');
  if (notes.length > 1000) errors.notes = 'Use 1,000 characters or fewer.';

  const parse = (field: 'identifiedAt' | 'originalExpectedAt' | 'revisedExpectedAt' | 'resolvedAt' | 'customerNotifiedAt', mustBePast: boolean) => {
    const raw = text(field);
    if (!raw) return undefined;
    const iso = fromDateTimeInput(raw);
    if (!iso) errors[field] = 'Enter a valid date and time.';
    else if (mustBePast && isBefore(ctx.now, iso)) errors[field] = 'This date cannot be in the future.';
    return iso;
  };

  const identifiedAt = parse('identifiedAt', true);
  if (!text('identifiedAt')) errors.identifiedAt = 'Enter when the delay was identified.';

  const originalExpectedAt = parse('originalExpectedAt', false);
  if (!text('originalExpectedAt')) errors.originalExpectedAt = 'Enter the date that was expected before the delay.';

  const revisedExpectedAt = parse('revisedExpectedAt', false);
  if (revisedExpectedAt && originalExpectedAt && !isBefore(originalExpectedAt, revisedExpectedAt)) {
    errors.revisedExpectedAt = 'The revised date must be later than the original expected date.';
  }

  let resolvedAt: string | undefined;
  if (status === 'resolved') {
    resolvedAt = parse('resolvedAt', true);
    if (!text('resolvedAt')) errors.resolvedAt = 'Enter when the delay was resolved.';
    else if (resolvedAt && identifiedAt && isBefore(resolvedAt, identifiedAt)) {
      errors.resolvedAt = 'The resolved date cannot be before the date identified.';
    }
  }

  let customerNotifiedAt: string | undefined;
  if (customerNotification === 'informed_manually') {
    customerNotifiedAt = parse('customerNotifiedAt', true);
    if (!text('customerNotifiedAt')) errors.customerNotifiedAt = 'Enter when the customer was informed.';
    else if (customerNotifiedAt && identifiedAt && isBefore(customerNotifiedAt, identifiedAt)) {
      errors.customerNotifiedAt = 'The customer cannot have been informed before the delay was identified.';
    }
  }

  if (Object.keys(errors).length > 0 || !identifiedAt || !originalExpectedAt) return { errors };

  return {
    errors,
    input: {
      reason: reason as DelayReason,
      reasonDetail,
      identifiedAt,
      severity: severity as Severity,
      milestone,
      originalExpectedAt,
      revisedExpectedAt,
      affectsEta: values.affectsEta,
      followUpBy,
      status: status as DelayStatus,
      nextAction: nextAction || undefined,
      notes: notes || undefined,
      resolvedAt,
      customerNotification: customerNotification as CustomerNotificationStatus,
      customerNotifiedAt,
    },
  };
}
