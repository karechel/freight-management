import {
  effectiveStatus,
  headerProblems,
  isCalendarDate,
  isEditable,
  lineProblems,
  nairobiDate,
  statusChangeProblems,
  totalProblem,
  transitionProblem,
} from './quotation-rules.js';

const fields = (problems: { field: string }[]) => problems.map((p) => p.field);

describe('effectiveStatus', () => {
  it('is still valid on the valid-until day', () => {
    expect(effectiveStatus('sent', '2026-11-20', '2026-11-20')).toBe('sent');
  });

  it('expires draft and sent quotations after the valid-until day', () => {
    expect(effectiveStatus('draft', '2026-11-19', '2026-11-20')).toBe(
      'expired',
    );
    expect(effectiveStatus('sent', '2026-11-19', '2026-11-20')).toBe('expired');
  });

  it('never expires decided quotations', () => {
    expect(effectiveStatus('accepted', '2026-01-01', '2026-11-20')).toBe(
      'accepted',
    );
    expect(effectiveStatus('declined', '2026-01-01', '2026-11-20')).toBe(
      'declined',
    );
  });
});

describe('nairobiDate', () => {
  it('uses the Nairobi calendar (UTC+3)', () => {
    // 21:30 UTC on the 19th is 00:30 on the 20th in Nairobi.
    expect(nairobiDate(new Date('2026-11-19T21:30:00Z'))).toBe('2026-11-20');
    expect(nairobiDate(new Date('2026-11-19T20:59:00Z'))).toBe('2026-11-19');
  });
});

describe('isEditable', () => {
  it('allows draft and sent quotations, as the approved plan says', () => {
    expect(isEditable('draft', false)).toBe(true);
    expect(isEditable('sent', false)).toBe(true);
  });

  it('refuses decided, expired and booked quotations', () => {
    expect(isEditable('accepted', false)).toBe(false);
    expect(isEditable('declined', false)).toBe(false);
    expect(isEditable('expired', false)).toBe(false);
    expect(isEditable('sent', true)).toBe(false);
  });
});

describe('transitionProblem', () => {
  it.each([
    ['draft', 'sent'],
    ['sent', 'accepted'],
    ['sent', 'declined'],
    ['accepted', 'declined'],
  ] as const)('allows %s → %s', (from, to) => {
    expect(transitionProblem(from, to, false)).toBeNull();
  });

  it.each([
    ['draft', 'accepted'],
    ['draft', 'declined'],
    ['sent', 'sent'],
    ['accepted', 'sent'],
    ['declined', 'accepted'],
  ] as const)('refuses %s → %s', (from, to) => {
    expect(transitionProblem(from, to, false)).not.toBeNull();
  });

  it('refuses any change once expired or booked', () => {
    expect(transitionProblem('expired', 'sent', false)).toMatch(/expired/);
    expect(transitionProblem('accepted', 'declined', true)).toMatch(/booking/);
  });
});

describe('statusChangeProblems', () => {
  const now = new Date('2026-11-20T10:00:00+03:00');
  const quotation = {
    issueDate: '2026-11-18',
    sentAt: new Date('2026-11-19T09:00:00+03:00'),
  };

  it('accepts a complete "sent" change', () => {
    expect(
      statusChangeProblems(
        { issueDate: '2026-11-18', sentAt: null },
        {
          status: 'sent',
          sentAt: new Date('2026-11-19T09:00:00+03:00'),
          sentTo: 'buyer@example.com',
        },
        now,
      ),
    ).toEqual([]);
  });

  it('needs the time and recipient when sending', () => {
    expect(
      fields(statusChangeProblems(quotation, { status: 'sent' }, now)),
    ).toEqual(['sentAt', 'sentTo']);
  });

  it('refuses future dates and dates before the issue date', () => {
    const future = statusChangeProblems(
      quotation,
      { status: 'accepted', decidedAt: new Date('2026-11-21T10:00:00+03:00') },
      now,
    );
    expect(future[0].messages[0]).toMatch(/future/);
    const early = statusChangeProblems(
      { issueDate: '2026-11-18', sentAt: null },
      {
        status: 'sent',
        sentAt: new Date('2026-11-17T10:00:00+03:00'),
        sentTo: 'x',
      },
      now,
    );
    expect(early[0].messages[0]).toMatch(/issue date/);
  });

  it('refuses a decision before the quotation was sent', () => {
    const problems = statusChangeProblems(
      quotation,
      { status: 'declined', decidedAt: new Date('2026-11-19T08:00:00+03:00') },
      now,
    );
    expect(problems[0].messages[0]).toMatch(/sent/);
  });
});

describe('headerProblems', () => {
  const ok = {
    origin: 'Shanghai',
    destination: 'Mombasa',
    issueDate: '2026-11-20',
    validUntil: '2026-12-20',
  };

  it('accepts a valid header', () => {
    expect(headerProblems(ok, '2026-11-20')).toEqual([]);
  });

  it('refuses the same origin and destination, ignoring case', () => {
    expect(
      fields(headerProblems({ ...ok, destination: 'shanghai' }, '2026-11-20')),
    ).toEqual(['destination']);
  });

  it('refuses a future issue date and validity before issue', () => {
    expect(
      fields(
        headerProblems(
          { ...ok, issueDate: '2026-11-21', validUntil: '2026-11-20' },
          '2026-11-20',
        ),
      ),
    ).toEqual(['issueDate', 'validUntil']);
  });
});

describe('lineProblems', () => {
  it('accepts lines within range', () => {
    expect(
      lineProblems([
        { quantity: '0.001', unitPrice: '0', taxRate: '0' },
        { quantity: '1000000', unitPrice: '1000000000', taxRate: '100' },
      ]),
    ).toEqual([]);
  });

  it('names each problem by line and field', () => {
    expect(
      fields(
        lineProblems([
          { quantity: '0', unitPrice: '1000000000.01', taxRate: '100.01' },
        ]),
      ),
    ).toEqual(['lines.0.quantity', 'lines.0.unitPrice', 'lines.0.taxRate']);
  });
});

describe('totalProblem', () => {
  it('refuses a zero total and one too large for the money columns', () => {
    expect(totalProblem('0.00')).not.toBeNull();
    expect(totalProblem('1000000000000.00')).not.toBeNull();
    expect(totalProblem('0.01')).toBeNull();
    expect(totalProblem('999999999999.99')).toBeNull();
  });
});

describe('isCalendarDate', () => {
  it('accepts real dates only', () => {
    expect(isCalendarDate('2026-02-28')).toBe(true);
    expect(isCalendarDate('2028-02-29')).toBe(true);
    expect(isCalendarDate('2026-02-29')).toBe(false);
    expect(isCalendarDate('2026-13-01')).toBe(false);
    expect(isCalendarDate('20-11-2026')).toBe(false);
  });
});
