// Money helpers. Amounts are integers in minor units (cents) so that sums are
// exact; rounding happens once per line, to the nearest cent (half away from zero).

import type { Currency } from '@/lib/types';

const formatters: Record<Currency, Intl.NumberFormat> = {
  KES: new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 2 }),
  USD: new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }),
};

export const formatMoney = (minor: number, currency: Currency) => formatters[currency].format(minor / 100);

/** Major-unit decimal string ("1234.5") → minor units; undefined if not a valid non-negative amount with ≤ 2 decimals. */
export function parseMoney(value: string): number | undefined {
  const v = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return undefined;
  const [whole, fraction = ''] = v.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/** Minor units → plain decimal string for inputs ("1234.50" → "1234.5"). */
export function minorToInput(minor: number): string {
  const whole = Math.trunc(minor / 100);
  const cents = minor % 100;
  return cents === 0 ? String(whole) : `${whole}.${String(cents).padStart(2, '0').replace(/0$/, '')}`;
}

const roundHalfAway = (n: number) => Math.sign(n) * Math.round(Math.abs(n));

export interface LineAmounts {
  netMinor: number;
  taxMinor: number;
  grossMinor: number;
}

/** quantity × unit price, then tax on the rounded net amount. */
export function lineAmounts(quantity: number, unitPriceMinor: number, taxRatePercent: number): LineAmounts {
  // Quantities have up to 3 decimals: scale to an integer before multiplying to avoid float drift.
  const netMinor = roundHalfAway((Math.round(quantity * 1000) * unitPriceMinor) / 1000);
  const taxMinor = roundHalfAway((netMinor * Math.round(taxRatePercent * 100)) / 10000);
  return { netMinor, taxMinor, grossMinor: netMinor + taxMinor };
}
