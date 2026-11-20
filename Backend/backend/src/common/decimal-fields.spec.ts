import {
  compareDecimal,
  normalizeDecimal,
  PERCENT_PATTERN,
  QUANTITY_PATTERN,
} from './decimal-fields.js';

describe('normalizeDecimal', () => {
  it('pads to the scale and drops leading zeros', () => {
    expect(normalizeDecimal('1.5', 2)).toBe('1.50');
    expect(normalizeDecimal('007', 3)).toBe('7.000');
    expect(normalizeDecimal('0.25', 3)).toBe('0.250');
  });
});

describe('compareDecimal', () => {
  it('compares exactly, whatever the number of decimals', () => {
    expect(compareDecimal('0.1', '0.10')).toBe(0);
    expect(compareDecimal('999999999999.99', '1000000000000')).toBe(-1);
    expect(compareDecimal('100.001', '100')).toBe(1);
  });
});

describe('patterns', () => {
  it('limit quantities to three decimals and rates to two', () => {
    expect(QUANTITY_PATTERN.test('12.345')).toBe(true);
    expect(QUANTITY_PATTERN.test('12.3456')).toBe(false);
    expect(QUANTITY_PATTERN.test('-1')).toBe(false);
    expect(PERCENT_PATTERN.test('16')).toBe(true);
    expect(PERCENT_PATTERN.test('16.125')).toBe(false);
  });
});
