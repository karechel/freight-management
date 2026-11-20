// Pure booking rules (no database access), so they can be unit-tested.
// Approved plan (docs/backend-implementation-plan.md §6, Phase 2): bookings are created by
// converting an accepted quotation or on their own, then confirmed, or cancelled with a reason.
// `completed` belongs to Phase 3, once shipments exist.

import type { BookingStatus } from './bookings.dto.js';

export type BookingAction = 'confirm' | 'cancel';

const ALLOWED_FROM: Record<BookingAction, readonly BookingStatus[]> = {
  confirm: ['pending'],
  cancel: ['pending', 'confirmed'],
};

/**
 * Credit approval (2026-11-20, LOG-20261120-1514-credit-approval). A booking created over the
 * credit limit by someone without `credit.override` awaits approval until an override holder
 * approves (a `proceed` decision) or rejects it (`blocked`, which also cancels the booking).
 * Bookings that never needed approval have no approval state.
 */
export type CreditApprovalState = 'awaiting' | 'approved' | 'rejected';

export function creditApprovalState(
  requested: boolean,
  decisions: readonly ('proceed' | 'blocked')[],
): CreditApprovalState | null {
  if (!requested) return null;
  const last = decisions.at(-1);
  if (last === undefined) return 'awaiting';
  return last === 'proceed' ? 'approved' : 'rejected';
}

/** Why an action is not allowed from the current status, or null when it is. */
export function bookingActionProblem(
  status: BookingStatus,
  action: BookingAction,
  approval: CreditApprovalState | null = null,
): string | null {
  if (action === 'confirm' && approval === 'awaiting') {
    return 'This booking is awaiting credit approval. Finance, management or an administrator must approve it before it can be confirmed.';
  }
  if (ALLOWED_FROM[action].includes(status)) return null;
  return action === 'confirm'
    ? `Only pending bookings can be confirmed. This booking is ${status}.`
    : `This booking is ${status} and cannot be cancelled.`;
}

/** A planned arrival cannot be before the planned departure. */
export function plannedDatesProblem(
  plannedEtd: Date | null,
  plannedEta: Date | null,
): string | null {
  if (plannedEtd && plannedEta && plannedEta.getTime() < plannedEtd.getTime()) {
    return 'The planned arrival cannot be before the planned departure.';
  }
  return null;
}
