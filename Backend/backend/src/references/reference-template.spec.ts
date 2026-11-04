import {
  counterPeriod,
  nairobiDateParts,
  renderReference,
  validateTemplate,
} from './reference-template.js';

describe('renderReference', () => {
  const october = { year: 2026, month: 10 };

  it('reproduces the existing frontend formats', () => {
    expect(
      renderReference('FMS-{MODE}-{YYMM}-{SEQ:4}', {
        ...october,
        mode: 'sea',
        sequence: 41,
      }),
    ).toBe('FMS-SEA-2610-0041');
    expect(
      renderReference('QT-{YYMM}-{SEQ:4}', { ...october, sequence: 57 }),
    ).toBe('QT-2610-0057');
    expect(
      renderReference('INV-{YYMM}-{SEQ:4}', { ...october, sequence: 112 }),
    ).toBe('INV-2610-0112');
  });

  it('supports the other date placeholders', () => {
    expect(
      renderReference('X{YYYY}{YY}{MM}-{SEQ:2}', {
        year: 2027,
        month: 3,
        sequence: 5,
      }),
    ).toBe('X20272703-05');
  });

  it('grows past the padding instead of cutting the number off', () => {
    expect(renderReference('QT-{SEQ:4}', { ...october, sequence: 12345 })).toBe(
      'QT-12345',
    );
  });
});

describe('validateTemplate', () => {
  it('accepts the default formats', () => {
    expect(
      validateTemplate('shipment', 'FMS-{MODE}-{YYMM}-{SEQ:4}', 'never'),
    ).toEqual([]);
    expect(
      validateTemplate('invoice', 'INV-{YYMM}-{SEQ:4}', 'monthly'),
    ).toEqual([]);
  });

  it.each([
    ['no running number', 'QT-{YYMM}'],
    ['two running numbers', 'QT-{SEQ:4}-{SEQ:4}'],
    ['zero padding', 'QT-{SEQ:0}'],
    ['too much padding', 'QT-{SEQ:11}'],
    ['an unknown placeholder', 'QT-{CUSTOMER}-{SEQ:4}'],
    ['a slash, which would break URLs', 'QT/{SEQ:4}'],
    ['a space', 'QT {SEQ:4}'],
    ['lower-case text', 'qt-{SEQ:4}'],
    ['an unclosed brace', 'QT-{SEQ:4'],
    ['{MODE} outside shipments', 'QT-{MODE}-{SEQ:4}'],
    ['too long a result', `${'A'.repeat(40)}-{SEQ:4}`],
  ])('rejects %s', (_name, template) => {
    expect(validateTemplate('quotation', template, 'never')).not.toEqual([]);
  });

  it('requires date placeholders that match the restart policy', () => {
    expect(validateTemplate('quotation', 'QT-{SEQ:4}', 'yearly')).not.toEqual(
      [],
    );
    expect(validateTemplate('quotation', 'QT-{YY}-{SEQ:4}', 'yearly')).toEqual(
      [],
    );
    expect(
      validateTemplate('quotation', 'QT-{YY}-{SEQ:4}', 'monthly'),
    ).not.toEqual([]);
    expect(
      validateTemplate('quotation', 'QT-{YYMM}-{SEQ:4}', 'monthly'),
    ).toEqual([]);
  });
});

describe('dates and counter periods', () => {
  it('uses the Nairobi calendar, not UTC', () => {
    // 22:30 UTC on 31 October is already 1 November in Nairobi.
    expect(nairobiDateParts(new Date('2026-10-31T22:30:00Z'))).toEqual({
      year: 2026,
      month: 11,
    });
  });

  it('derives the period from the restart policy', () => {
    const parts = { year: 2026, month: 3 };
    expect(counterPeriod('never', parts)).toBe(0);
    expect(counterPeriod('yearly', parts)).toBe(2026);
    expect(counterPeriod('monthly', parts)).toBe(202603);
  });
});
