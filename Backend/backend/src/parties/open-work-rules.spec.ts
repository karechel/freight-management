import {
  archiveBlockers,
  NEW_WORK_BLOCK_MESSAGES,
  newWorkBlock,
} from './party-rules.js';

describe('new-work block (repository owner, 2026-11-26)', () => {
  it.each([
    [null, 'active', null],
    [null, 'on_hold', 'on_hold'],
    [null, 'closed', 'closed'],
    [new Date(), 'active', 'archived'],
    [new Date(), 'on_hold', 'archived'],
  ] as const)(
    'archivedAt %s, status %s → %s',
    (archivedAt, accountStatus, expected) => {
      expect(newWorkBlock({ archivedAt, accountStatus })).toBe(expected);
    },
  );

  it('explains every block and who can lift it', () => {
    expect(NEW_WORK_BLOCK_MESSAGES.on_hold).toContain('on hold');
    expect(NEW_WORK_BLOCK_MESSAGES.closed).toContain('closed');
    for (const message of [
      NEW_WORK_BLOCK_MESSAGES.on_hold,
      NEW_WORK_BLOCK_MESSAGES.closed,
    ]) {
      expect(message).toContain('Management or an administrator');
    }
    expect(NEW_WORK_BLOCK_MESSAGES.archived).toContain('Restore');
  });
});

describe('archive blockers (repository owner, 2026-11-26)', () => {
  it('allows archiving without open work', () => {
    expect(
      archiveBlockers({ shipments: [], bookings: [], quotations: [] }),
    ).toBeNull();
  });

  it('names each kind of open work', () => {
    const result = archiveBlockers({
      shipments: ['FMS-S-1'],
      bookings: ['BKG-1', 'BKG-2'],
      quotations: ['QT-1'],
    });
    expect(result!.message).toContain('open work');
    expect(result!.details).toEqual([
      { field: 'shipments', messages: ['1 undelivered shipment: FMS-S-1.'] },
      {
        field: 'bookings',
        messages: ['2 pending or confirmed bookings: BKG-1, BKG-2.'],
      },
      { field: 'quotations', messages: ['1 open quotation: QT-1.'] },
    ]);
  });

  it('lists at most five references per kind', () => {
    const quotations = Array.from({ length: 7 }, (_, i) => `QT-${i + 1}`);
    const result = archiveBlockers({ shipments: [], bookings: [], quotations });
    expect(result!.details).toEqual([
      {
        field: 'quotations',
        messages: [
          '7 open quotations: QT-1, QT-2, QT-3, QT-4, QT-5 and 2 more.',
        ],
      },
    ]);
  });
});
