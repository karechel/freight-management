// Pure derivations for quotations: totals, effective status and references.
// No data imports, so these are safe in Client Components.

import { lineAmounts } from '@/lib/money';
import type { Currency, Quotation, QuotationLine, QuotationStatus } from '@/lib/types';

export interface QuotationTotals {
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
}

export function quotationTotals(lines: Pick<QuotationLine, 'quantity' | 'unitPriceMinor' | 'taxRatePercent'>[]): QuotationTotals {
  return lines.reduce(
    (t, l) => {
      const a = lineAmounts(l.quantity, l.unitPriceMinor, l.taxRatePercent);
      return { subtotalMinor: t.subtotalMinor + a.netMinor, taxMinor: t.taxMinor + a.taxMinor, totalMinor: t.totalMinor + a.grossMinor };
    },
    { subtotalMinor: 0, taxMinor: 0, totalMinor: 0 },
  );
}

/** Draft and sent quotations whose validity has passed count as expired, whatever their stored status. */
export function effectiveQuotationStatus(q: Pick<Quotation, 'status' | 'validUntil'>, referenceDate: string): QuotationStatus {
  if ((q.status === 'draft' || q.status === 'sent') && new Date(q.validUntil).getTime() < new Date(referenceDate).getTime()) {
    return 'expired';
  }
  return q.status;
}

/** Quotations still awaiting a decision. */
export const isOpenQuotation = (status: QuotationStatus) => status === 'draft' || status === 'sent' || status === 'accepted';

/** Next reference in the existing `QT-<YYMM>-<NNNN>` pattern; NNNN continues the highest number in use. */
export function nextQuotationReference(existing: Pick<Quotation, 'reference'>[], now: string): string {
  const yymm = `${now.slice(2, 4)}${now.slice(5, 7)}`;
  const highest = existing.reduce((max, q) => {
    const n = Number(q.reference.split('-').at(-1));
    return Number.isInteger(n) && n > max ? n : max;
  }, 0);
  return `QT-${yymm}-${String(highest + 1).padStart(4, '0')}`;
}

/** Sum of totals per currency, e.g. for "open quotations" figures that mix KES and USD. */
export function totalsByCurrency(quotations: Quotation[]): Partial<Record<Currency, number>> {
  const sums: Partial<Record<Currency, number>> = {};
  for (const q of quotations) sums[q.currency] = (sums[q.currency] ?? 0) + quotationTotals(q.lines).totalMinor;
  return sums;
}

/** Status changes the UI offers from each status. Booking happens by converting or linking a shipment. */
export const quotationTransitions: Record<QuotationStatus, QuotationStatus[]> = {
  draft: ['sent'],
  sent: ['accepted', 'declined'],
  accepted: ['declined'],
  booked: [],
  declined: [],
  expired: [],
};
