// Exact decimal values arrive as strings (docs/backend-implementation-plan.md §2), never as
// JavaScript numbers, so no precision is lost before PostgreSQL does the arithmetic.

/** Quantity, Numeric(12, 3): zero or more, up to three decimal places. */
export const QUANTITY_PATTERN = /^\d{1,9}(\.\d{1,3})?$/;

/** Percent, Numeric(5, 2): up to three digits and two decimal places. */
export const PERCENT_PATTERN = /^\d{1,3}(\.\d{1,2})?$/;

/**
 * Writes a non-negative decimal string with exactly `scale` decimal places, without leading
 * zeros, which is the text PostgreSQL returns: "1.5" → "1.50" for scale 2.
 */
export function normalizeDecimal(value: string, scale: number): string {
  const [whole, fraction = ''] = value.split('.');
  return `${whole.replace(/^0+(?=\d)/, '')}.${fraction.padEnd(scale, '0')}`;
}

/**
 * Compares two non-negative decimal strings exactly (no floating point).
 * Returns -1, 0 or 1, like a sort comparator.
 */
export function compareDecimal(a: string, b: string): number {
  const [aWhole, aFraction = ''] = a.split('.');
  const [bWhole, bFraction = ''] = b.split('.');
  const scale = Math.max(aFraction.length, bFraction.length);
  const left = BigInt(aWhole + aFraction.padEnd(scale, '0'));
  const right = BigInt(bWhole + bFraction.padEnd(scale, '0'));
  return left === right ? 0 : left < right ? -1 : 1;
}
