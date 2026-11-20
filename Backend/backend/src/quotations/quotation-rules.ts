// Pure rules for quotations (no database access), so they can be unit-tested.
// They mirror the frontend rules in Frontend/frontend/lib/quotations.ts and
// lib/quotation-changes.ts, with one difference from the approved backend plan
// (docs/backend-implementation-plan.md §6, Phase 2): a quotation can be edited while
// it is `draft` or `sent`, not only while it is a draft.

import { compareDecimal } from '../common/decimal-fields.js';

export const STORED_STATUSES = [
  'draft',
  'sent',
  'accepted',
  'declined',
  'expired',
] as const;
export type StoredQuotationStatus = (typeof STORED_STATUSES)[number];

/** The status a caller sees: `expired` is derived from the valid-until date. */
export type QuotationStatus = StoredQuotationStatus;

/** Statuses a user may move a quotation to. `expired` is never set by hand. */
export const TARGET_STATUSES = ['sent', 'accepted', 'declined'] as const;
export type TargetStatus = (typeof TARGET_STATUSES)[number];

export const MAX_LINES = 50;

const TRANSITIONS: Record<QuotationStatus, readonly TargetStatus[]> = {
  draft: ['sent'],
  sent: ['accepted', 'declined'],
  accepted: ['declined'],
  declined: [],
  expired: [],
};

/** Today's calendar date in Nairobi, as `YYYY-MM-DD`. */
export function nairobiToday(at: Date = new Date()): string {
  return nairobiDate(at);
}

/** The Nairobi calendar date of an instant, as `YYYY-MM-DD`. */
export function nairobiDate(at: Date): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/**
 * Draft and sent quotations whose last valid day has passed (on the Nairobi calendar) count as
 * expired, whatever their stored status. A quotation is still valid on its valid-until day.
 */
export function effectiveStatus(
  status: StoredQuotationStatus,
  validUntil: string,
  today: string,
): QuotationStatus {
  if ((status === 'draft' || status === 'sent') && validUntil < today) {
    return 'expired';
  }
  return status;
}

/** Header and lines may change only while the quotation is draft or sent (and not expired). */
export function isEditable(status: QuotationStatus, booked: boolean): boolean {
  return !booked && (status === 'draft' || status === 'sent');
}

/** Why a status change is not allowed, or null when it is. */
export function transitionProblem(
  current: QuotationStatus,
  target: TargetStatus,
  booked: boolean,
): string | null {
  if (booked) {
    return 'This quotation has been converted to a booking and can no longer change.';
  }
  if (current === 'expired') {
    return 'This quotation has expired. Duplicate it as a new draft to quote again.';
  }
  if (!TRANSITIONS[current].includes(target)) {
    return `A quotation that is "${current}" cannot be changed to "${target}".`;
  }
  return null;
}

export interface StatusChangeInput {
  status: TargetStatus;
  sentAt?: Date;
  sentTo?: string;
  decidedAt?: Date;
}

export interface QuotationDates {
  issueDate: string;
  sentAt: Date | null;
}

export interface FieldProblem {
  field: string;
  messages: string[];
}

/**
 * Checks the dates and recipient of a status change: dates are required, not in the future, not
 * before the issue date, and a decision is not before the quotation was sent.
 */
export function statusChangeProblems(
  quotation: QuotationDates,
  change: StatusChangeInput,
  now: Date,
): FieldProblem[] {
  const problems: FieldProblem[] = [];
  const checkDate = (
    field: 'sentAt' | 'decidedAt',
    at: Date | undefined,
    notBefore: Date | null,
  ) => {
    if (!at) {
      problems.push({ field, messages: ['Enter when this happened.'] });
    } else if (at.getTime() > now.getTime()) {
      problems.push({
        field,
        messages: ['This date cannot be in the future.'],
      });
    } else if (nairobiDate(at) < quotation.issueDate) {
      problems.push({
        field,
        messages: [`Cannot be before the issue date (${quotation.issueDate}).`],
      });
    } else if (notBefore && at.getTime() < notBefore.getTime()) {
      problems.push({
        field,
        messages: ['Cannot be before the quotation was sent.'],
      });
    }
  };

  if (change.status === 'sent') {
    checkDate('sentAt', change.sentAt, null);
    if (!change.sentTo) {
      problems.push({
        field: 'sentTo',
        messages: ['Enter who it was sent to (name or email).'],
      });
    }
  } else {
    checkDate('decidedAt', change.decidedAt, quotation.sentAt);
  }
  return problems;
}

export interface QuotationRoute {
  origin: string;
  destination: string;
  issueDate: string;
  validUntil: string;
}

/** Cross-field checks on a quotation header (single fields are checked by the DTO). */
export function headerProblems(
  route: QuotationRoute,
  today: string,
): FieldProblem[] {
  const problems: FieldProblem[] = [];
  if (route.origin.toLowerCase() === route.destination.toLowerCase()) {
    problems.push({
      field: 'destination',
      messages: ['Destination must be different from the origin.'],
    });
  }
  if (route.issueDate > today) {
    problems.push({
      field: 'issueDate',
      messages: ['The issue date cannot be in the future.'],
    });
  }
  if (route.validUntil < route.issueDate) {
    problems.push({
      field: 'validUntil',
      messages: ['Valid until cannot be before the issue date.'],
    });
  }
  return problems;
}

/**
 * Editing a sent quotation must not move its issue date after the day it was sent (on the
 * Nairobi calendar), or the record would say it was sent before it was issued.
 */
export function issueAfterSentProblem(
  issueDate: string,
  sentAt: Date | null,
): FieldProblem | null {
  if (!sentAt) return null;
  const sentDay = nairobiDate(sentAt);
  return issueDate > sentDay
    ? {
        field: 'issueDate',
        messages: [
          `The issue date cannot be after the day the quotation was sent (${sentDay}).`,
        ],
      }
    : null;
}

/** Largest total that fits the `Money` column, Numeric(14, 2). */
export const MAX_TOTAL = '999999999999.99';
const MAX_QUANTITY = '1000000';
const MAX_UNIT_PRICE = '1000000000';

export interface LineAmountsInput {
  quantity: string;
  unitPrice: string;
  taxRate: string;
}

/**
 * Range checks on line values that already match their decimal patterns (the DTO checks those),
 * matching the frontend form: quantity above 0 and up to 1,000,000; unit price up to
 * 1,000,000,000; tax rate from 0 to 100.
 */
export function lineProblems(
  lines: readonly LineAmountsInput[],
  field = 'lines',
): FieldProblem[] {
  const problems: FieldProblem[] = [];
  lines.forEach((line, index) => {
    const at = (name: string) => `${field}.${index}.${name}`;
    if (
      compareDecimal(line.quantity, '0') <= 0 ||
      compareDecimal(line.quantity, MAX_QUANTITY) > 0
    ) {
      problems.push({
        field: at('quantity'),
        messages: ['Enter a quantity above 0 and up to 1,000,000.'],
      });
    }
    if (compareDecimal(line.unitPrice, MAX_UNIT_PRICE) > 0) {
      problems.push({
        field: at('unitPrice'),
        messages: ['Enter a unit price up to 1,000,000,000.'],
      });
    }
    if (compareDecimal(line.taxRate, '100') > 0) {
      problems.push({
        field: at('taxRate'),
        messages: ['Enter a rate between 0 and 100.'],
      });
    }
  });
  return problems;
}

/** The total must be above zero and fit the money columns used later (bookings, invoices). */
export function totalProblem(total: string): FieldProblem | null {
  if (compareDecimal(total, '0') <= 0) {
    return {
      field: 'lines',
      messages: ['The quotation total must be more than zero.'],
    };
  }
  if (compareDecimal(total, MAX_TOTAL) > 0) {
    return {
      field: 'lines',
      messages: ['The quotation total is too large.'],
    };
  }
  return null;
}

/** True when `value` is a real calendar date written as YYYY-MM-DD. */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}
