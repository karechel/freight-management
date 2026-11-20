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

/** Why an action is not allowed from the current status, or null when it is. */
export function bookingActionProblem(
  status: BookingStatus,
  action: BookingAction,
): string | null {
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
