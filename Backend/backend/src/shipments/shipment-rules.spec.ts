import {
  currentEta,
  dateProblems,
  defaultMilestones,
  issueProblems,
  milestoneActualProblem,
  milestoneStates,
  normalizeContainerNumber,
  statusChangeProblem,
  statusProblems,
  type IssueState,
} from './shipment-rules.js';

const at = (iso: string) => new Date(iso);
const NOW = at('2026-11-26T12:00:00Z');
const fields = (problems: { field: string }[]) => problems.map((p) => p.field);

const noDates = {
  etd: null,
  eta: null,
  estimatedDeliveryAt: null,
  atd: null,
  ata: null,
  deliveredAt: null,
};

describe('defaultMilestones', () => {
  const input = {
    origin: 'Shanghai',
    destination: 'Mombasa',
    etd: at('2026-12-01T00:00:00Z'),
    eta: at('2026-12-20T00:00:00Z'),
    estimatedDeliveryAt: at('2026-12-24T00:00:00Z'),
    fromBooking: true,
  };

  it('builds the import sequence with planned dates, the first step done', () => {
    const steps = defaultMilestones({ ...input, direction: 'import' }, NOW);
    expect(steps.map((s) => s.label)).toEqual([
      'Booking confirmed',
      'Departed origin',
      'Arrived Mombasa',
      'Customs clearance',
      'Released',
      'Delivered',
    ]);
    expect(steps[0].actualAt).toEqual(NOW);
    expect(steps[1].plannedAt).toEqual(input.etd);
    expect(steps[2].plannedAt).toEqual(input.eta);
    expect(steps[5].plannedAt).toEqual(input.estimatedDeliveryAt);
  });

  it('adds export and transit steps, and opens standalone jobs differently', () => {
    expect(
      defaultMilestones({ ...input, direction: 'export' }, NOW)[1].label,
    ).toBe('Export customs cleared');
    expect(
      defaultMilestones({ ...input, direction: 'transit' }, NOW)[1].label,
    ).toBe('Transit entry lodged');
    expect(
      defaultMilestones(
        { ...input, direction: 'import', fromBooking: false },
        NOW,
      )[0].label,
    ).toBe('Job opened');
  });
});

describe('milestoneStates', () => {
  it('marks everything up to the last recorded milestone done and the next current', () => {
    expect(milestoneStates([NOW, null, NOW, null, null])).toEqual([
      'done',
      'done',
      'done',
      'current',
      'pending',
    ]);
    expect(milestoneStates([null, null])).toEqual(['current', 'pending']);
    expect(milestoneStates([NOW, NOW])).toEqual(['done', 'done']);
  });
});

describe('milestoneActualProblem', () => {
  const milestones = [
    { label: 'Job opened', actualAt: at('2026-11-25T00:00:00Z') },
    { label: 'Booked', actualAt: at('2026-11-01T00:00:00Z') },
    { label: 'Departed', actualAt: null },
    { label: 'Arrived', actualAt: at('2026-11-20T00:00:00Z') },
  ];

  it('keeps the timeline in order and refuses future times', () => {
    expect(
      milestoneActualProblem(milestones, 2, at('2026-11-10T00:00:00Z'), NOW),
    ).toBeNull();
    expect(
      milestoneActualProblem(milestones, 2, at('2026-10-30T00:00:00Z'), NOW),
    ).toMatch(/previous completed milestone \(Booked\)/);
    expect(
      milestoneActualProblem(milestones, 2, at('2026-11-21T00:00:00Z'), NOW),
    ).toMatch(/next completed milestone \(Arrived\)/);
    expect(
      milestoneActualProblem(milestones, 2, at('2026-11-27T00:00:00Z'), NOW),
    ).toMatch(/future/);
  });

  it('refuses clearing a milestone while a later one is completed', () => {
    expect(milestoneActualProblem(milestones, 1, null, NOW)).toMatch(
      /later milestone/,
    );
    expect(milestoneActualProblem(milestones, 3, null, NOW)).toBeNull();
  });

  it('does not order later milestones by the job-opened milestone', () => {
    // Opened on 25 Nov, departed on 10 Nov: allowed.
    expect(
      milestoneActualProblem(
        [milestones[0], { label: 'Departed', actualAt: null }],
        1,
        at('2026-11-10T00:00:00Z'),
        NOW,
      ),
    ).toBeNull();
  });
});

describe('dateProblems', () => {
  it('accepts consistent dates', () => {
    expect(
      dateProblems(
        {
          etd: at('2026-11-01T00:00:00Z'),
          eta: at('2026-11-10T00:00:00Z'),
          estimatedDeliveryAt: at('2026-11-12T00:00:00Z'),
          atd: at('2026-11-01T06:00:00Z'),
          ata: at('2026-11-10T06:00:00Z'),
          deliveredAt: at('2026-11-12T06:00:00Z'),
        },
        NOW,
      ),
    ).toEqual([]);
  });

  it('rejects estimates and actual times out of order, and future actual times', () => {
    expect(
      fields(
        dateProblems(
          {
            ...noDates,
            etd: at('2026-11-10T00:00:00Z'),
            eta: at('2026-11-01T00:00:00Z'),
            estimatedDeliveryAt: at('2026-10-30T00:00:00Z'),
          },
          NOW,
        ),
      ),
    ).toEqual(['eta', 'estimatedDeliveryAt']);
    expect(
      fields(
        dateProblems(
          {
            ...noDates,
            atd: at('2026-11-10T00:00:00Z'),
            ata: at('2026-11-09T00:00:00Z'),
            deliveredAt: at('2026-11-30T00:00:00Z'),
          },
          NOW,
        ),
      ),
    ).toEqual(['deliveredAt', 'ata']);
    expect(
      fields(
        dateProblems(
          {
            ...noDates,
            atd: at('2026-11-10T00:00:00Z'),
            deliveredAt: at('2026-11-09T00:00:00Z'),
          },
          NOW,
        ),
      ),
    ).toEqual(['deliveredAt']);
  });
});

describe('status rules', () => {
  it('needs a delivery time to be delivered, and only delivered has one', () => {
    expect(
      fields(statusProblems('delivered', { ata: null, deliveredAt: null })),
    ).toEqual(['deliveredAt']);
    expect(
      fields(statusProblems('released', { ata: null, deliveredAt: NOW })),
    ).toEqual(['status']);
    expect(
      statusProblems('delivered', { ata: null, deliveredAt: NOW }),
    ).toEqual([]);
  });

  it('needs an arrival time to be arrived', () => {
    expect(
      fields(statusProblems('arrived', { ata: null, deliveredAt: null })),
    ).toEqual(['ata']);
    expect(statusProblems('arrived', { ata: NOW, deliveredAt: null })).toEqual(
      [],
    );
  });

  it('treats delivered as final and refuses a change to the same status', () => {
    expect(statusChangeProblem('delivered', 'released')).toMatch(/delivered/);
    expect(statusChangeProblem('booked', 'booked')).toMatch(/already/);
    expect(statusChangeProblem('on_hold', 'in_transit')).toBeNull();
  });
});

describe('currentEta', () => {
  const planned = at('2026-12-01T00:00:00Z');
  const delay = {
    type: 'delay' as const,
    status: 'open' as const,
    affectsEta: true,
    revisedExpectedAt: at('2026-12-05T00:00:00Z'),
    identifiedAt: at('2026-11-20T00:00:00Z'),
  };

  it('uses the latest open delay that affects the ETA', () => {
    expect(
      currentEta(planned, [
        delay,
        {
          ...delay,
          revisedExpectedAt: at('2026-12-08T00:00:00Z'),
          identifiedAt: at('2026-11-22T00:00:00Z'),
        },
      ]),
    ).toEqual({ at: at('2026-12-08T00:00:00Z'), revised: true });
  });

  it('keeps the planned ETA without such a delay', () => {
    for (const issue of [
      { ...delay, status: 'resolved' as const },
      { ...delay, affectsEta: false },
      { ...delay, revisedExpectedAt: null },
      { ...delay, type: 'damage' as const },
    ]) {
      expect(currentEta(planned, [issue])).toEqual({
        at: planned,
        revised: false,
      });
    }
  });
});

describe('issueProblems', () => {
  const delay: IssueState = {
    type: 'delay',
    reason: 'port_congestion',
    identifiedAt: at('2026-11-20T00:00:00Z'),
    originalExpectedAt: at('2026-12-01T00:00:00Z'),
    revisedExpectedAt: null,
    affectsEta: true,
    status: 'open',
    resolvedAt: null,
    customerNotification: 'not_notified',
    customerNotifiedAt: null,
  };

  it('accepts a complete delay', () => {
    expect(issueProblems(delay, NOW)).toEqual([]);
  });

  it('needs a reason and the original date for a delay', () => {
    expect(
      fields(
        issueProblems(
          { ...delay, reason: null, originalExpectedAt: null },
          NOW,
        ),
      ),
    ).toEqual(['reason', 'originalExpectedAt']);
  });

  it('lets only delays change the ETA or carry a reason', () => {
    expect(fields(issueProblems({ ...delay, type: 'damage' }, NOW))).toEqual([
      'reason',
      'affectsEta',
    ]);
  });

  it('checks resolution and notification times', () => {
    expect(
      fields(issueProblems({ ...delay, status: 'resolved' }, NOW)),
    ).toEqual(['resolvedAt']);
    expect(
      fields(
        issueProblems(
          {
            ...delay,
            status: 'resolved',
            resolvedAt: at('2026-11-19T00:00:00Z'),
          },
          NOW,
        ),
      ),
    ).toEqual(['resolvedAt']);
    expect(fields(issueProblems({ ...delay, resolvedAt: NOW }, NOW))).toEqual([
      'resolvedAt',
    ]);
    expect(
      fields(
        issueProblems(
          { ...delay, customerNotification: 'informed_manually' },
          NOW,
        ),
      ),
    ).toEqual(['customerNotifiedAt']);
    expect(
      fields(
        issueProblems(
          { ...delay, identifiedAt: at('2026-11-30T00:00:00Z') },
          NOW,
        ),
      ),
    ).toEqual(['identifiedAt']);
  });
});

describe('normalizeContainerNumber', () => {
  it('removes spaces and dashes and uses capitals', () => {
    expect(normalizeContainerNumber('mscu 123456-7')).toBe('MSCU1234567');
  });
});
