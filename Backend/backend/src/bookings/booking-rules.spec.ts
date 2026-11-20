import {
  bookingActionProblem,
  creditApprovalState,
  plannedDatesProblem,
} from './booking-rules.js';

describe('bookingActionProblem', () => {
  it('confirms pending bookings only', () => {
    expect(bookingActionProblem('pending', 'confirm')).toBeNull();
    expect(bookingActionProblem('confirmed', 'confirm')).not.toBeNull();
    expect(bookingActionProblem('cancelled', 'confirm')).not.toBeNull();
  });

  it('cancels pending and confirmed bookings', () => {
    expect(bookingActionProblem('pending', 'cancel')).toBeNull();
    expect(bookingActionProblem('confirmed', 'cancel')).toBeNull();
    expect(bookingActionProblem('cancelled', 'cancel')).not.toBeNull();
    expect(bookingActionProblem('completed', 'cancel')).not.toBeNull();
  });
});

describe('plannedDatesProblem', () => {
  const etd = new Date('2026-11-25T08:00:00+03:00');

  it('accepts missing dates and arrival after departure', () => {
    expect(plannedDatesProblem(null, null)).toBeNull();
    expect(plannedDatesProblem(etd, null)).toBeNull();
    expect(
      plannedDatesProblem(etd, new Date('2026-12-10T08:00:00+03:00')),
    ).toBeNull();
  });

  it('refuses arrival before departure', () => {
    expect(
      plannedDatesProblem(etd, new Date('2026-11-24T08:00:00+03:00')),
    ).not.toBeNull();
  });
});

describe('creditApprovalState', () => {
  it('is empty when no approval was requested', () => {
    expect(creditApprovalState(false, [])).toBeNull();
    expect(creditApprovalState(false, ['proceed'])).toBeNull();
  });

  it('awaits a decision, then follows the latest one', () => {
    expect(creditApprovalState(true, [])).toBe('awaiting');
    expect(creditApprovalState(true, ['proceed'])).toBe('approved');
    expect(creditApprovalState(true, ['blocked'])).toBe('rejected');
  });
});

describe('confirming a booking awaiting credit approval', () => {
  it('is refused until approved', () => {
    expect(bookingActionProblem('pending', 'confirm', 'awaiting')).toMatch(
      /awaiting credit approval/,
    );
    expect(bookingActionProblem('pending', 'confirm', 'approved')).toBeNull();
    expect(bookingActionProblem('pending', 'confirm', null)).toBeNull();
  });

  it('does not stop cancelling', () => {
    expect(bookingActionProblem('pending', 'cancel', 'awaiting')).toBeNull();
  });
});
