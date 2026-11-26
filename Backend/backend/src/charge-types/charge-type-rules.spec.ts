import { ROLE_PERMISSIONS } from '../seed/setup-data.js';
import { taxRateProblem } from './charge-type-rules.js';
import { MANAGE_TAX } from './charge-types.controller.js';

describe('charge-type tax settings', () => {
  it.each(['0', '8.5', '16', '16.00', '100', '100.00'])(
    'accepts the rate %s',
    (rate) => {
      expect(taxRateProblem(rate)).toBeNull();
    },
  );

  it.each(['100.01', '101', '999.99'])('rejects the rate %s', (rate) => {
    expect(taxRateProblem(rate)).toBe('Enter a rate from 0 to 100.');
  });
});

describe('approved permission matrix (repository owner, 2026-11-26)', () => {
  const holds = (role: keyof typeof ROLE_PERMISSIONS, code: string) =>
    ROLE_PERMISSIONS[role].includes(code);

  it.each([
    // role, quotations.view, quotations.manage, credit.override, settings.tax.manage
    ['admin', true, true, true, true],
    ['sales', true, true, false, false],
    ['finance', true, false, true, false],
    ['management', true, false, true, false],
    ['operations', true, false, false, false],
    ['customer', false, false, false, false],
  ] as const)('%s', (role, view, manage, override, tax) => {
    expect([
      holds(role, 'quotations.view'),
      holds(role, 'quotations.manage'),
      holds(role, 'credit.override'),
      holds(role, MANAGE_TAX),
    ]).toEqual([view, manage, override, tax]);
  });

  it('lets only management and admin change customer account status', () => {
    const holders = Object.entries(ROLE_PERMISSIONS)
      .filter(([, codes]) => codes.includes('parties.status.manage'))
      .map(([role]) => role)
      .sort();
    expect(holders).toEqual(['admin', 'management']);
  });
});
