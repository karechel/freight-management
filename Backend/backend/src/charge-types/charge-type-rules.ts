import { compareDecimal, normalizeDecimal } from '../common/decimal-fields.js';

/**
 * Tax settings on charge types are provisional: the company accountant has not reviewed the seeded
 * categories and rates (repository owner, 2026-11-26), so an administrator can change them.
 * Changes apply to new quotation lines only; saved lines keep their own category and rate.
 */
export const MAX_TAX_RATE = '100';

/** A problem with a tax rate already shaped like a percentage, or null when it is acceptable. */
export function taxRateProblem(rate: string): string | null {
  return compareDecimal(normalizeDecimal(rate, 2), MAX_TAX_RATE) > 0
    ? 'Enter a rate from 0 to 100.'
    : null;
}
