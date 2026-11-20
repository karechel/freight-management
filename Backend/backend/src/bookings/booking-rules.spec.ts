import { bookingActionProblem, plannedDatesProblem } from './booking-rules.js';

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
