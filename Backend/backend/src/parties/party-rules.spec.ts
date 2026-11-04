import { NotFoundException } from '@nestjs/common';
import { ParseIdPipe } from '../common/parse-id.pipe.js';
import {
  containsPattern,
  MONEY_PATTERN,
  normalizeMoney,
  PHONE_PATTERN,
} from './party-rules.js';

describe('party rules', () => {
  it.each(['0', '1250', '1250.5', '1250.50', '999999999999.99'])(
    'accepts the amount %s',
    (amount) => {
      expect(MONEY_PATTERN.test(amount)).toBe(true);
    },
  );

  it.each(['-1', '1.234', '1e5', '1,000', '', '.5', '1000000000000'])(
    'rejects the amount "%s"',
    (amount) => {
      expect(MONEY_PATTERN.test(amount)).toBe(false);
    },
  );

  it.each([
    ['0', '0.00'],
    ['1250', '1250.00'],
    ['1250.5', '1250.50'],
    ['007.10', '7.10'],
    ['000', '0.00'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeMoney(input)).toBe(expected);
  });

  it.each(['+254 700 000 000', '0700-000-000', '(020) 123456'])(
    'accepts the phone number %s',
    (phone) => {
      expect(PHONE_PATTERN.test(phone)).toBe(true);
    },
  );

  it.each(['12345', 'call me', '+254 700 000 000 000 000 00'])(
    'rejects the phone number "%s"',
    (phone) => {
      expect(PHONE_PATTERN.test(phone)).toBe(false);
    },
  );

  it('escapes wildcards so search terms match literally', () => {
    expect(containsPattern('kamau')).toBe('%kamau%');
    expect(containsPattern('100%_a\\b')).toBe('%100\\%\\_a\\\\b%');
  });
});

describe('ParseIdPipe', () => {
  const pipe = new ParseIdPipe();

  it('reads valid ids', () => {
    expect(pipe.transform('1')).toBe(1);
    expect(pipe.transform('2147483647')).toBe(2147483647);
  });

  it.each(['0', '-1', 'abc', '1.5', '01', '2147483648', '99999999999', ''])(
    'treats "%s" as not found',
    (value) => {
      expect(() => pipe.transform(value)).toThrow(NotFoundException);
    },
  );
});
