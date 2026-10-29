// Print-friendly quotation. Printing (or "Save as PDF" in the browser's print
// dialog) is the only download path; no file is generated or stored.

import { formatDate } from '@/lib/format';
import { directionLabel, modeLabel, quotationStatusMeta } from '@/lib/labels';
import { formatMoney, lineAmounts } from '@/lib/money';
import { quotationTotals } from '@/lib/quotations';
import type { BillingProfile, Quotation, QuotationStatus } from '@/lib/types';

export function QuotationDocument({
  quotation: q,
  status,
  billing,
}: {
  quotation: Quotation;
  status: QuotationStatus;
  billing?: BillingProfile;
}) {
  const totals = quotationTotals(q.lines);
  return (
    <article
      aria-label={`Quotation ${q.reference}`}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-8 print:rounded-none print:border-0 print:p-0 print:shadow-none"
    >
      <p className="mb-6 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-center text-xs font-semibold tracking-wide text-amber-900 uppercase">
        Demonstration document. Fictional data, not a valid offer.
      </p>

      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:justify-between">
        <div>
          <p className="text-xl font-semibold text-slate-900">Quotation</p>
          <p className="mt-1 font-mono text-sm text-slate-700">{q.reference}</p>
          <p className="mt-2 text-xs text-slate-500">Issuing company details are not configured in this system.</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-500">Issue date</dt>
          <dd className="text-slate-900">{formatDate(q.issuedAt)}</dd>
          <dt className="text-slate-500">Valid until</dt>
          <dd className="text-slate-900">{formatDate(q.validUntil)}</dd>
          <dt className="text-slate-500">Status</dt>
          <dd className="text-slate-900">{quotationStatusMeta[status].label}</dd>
          <dt className="text-slate-500">Currency</dt>
          <dd className="text-slate-900">{q.currency}</dd>
        </dl>
      </header>

      <section className="grid grid-cols-1 gap-5 border-b border-slate-200 py-5 sm:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Prepared for</h3>
          <p className="mt-1 text-sm font-medium text-slate-900">{q.customerName}</p>
          {billing ? (
            <div className="mt-1 text-sm text-slate-700">
              <p>Attn: {billing.contactName}</p>
              {billing.address.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <p>{billing.email}</p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-500">Billing details not recorded.</p>
          )}
        </div>
        <div>
          <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Shipment</h3>
          <p className="mt-1 text-sm text-slate-900">
            {q.origin} → {q.destination}
          </p>
          <p className="text-sm text-slate-700">
            {modeLabel[q.mode]} freight · {directionLabel[q.direction]}
          </p>
          <p className="text-sm text-slate-700">{q.cargoSummary}</p>
        </div>
      </section>

      <div className="overflow-x-auto py-5">
        <table className="w-full min-w-[520px] text-left text-sm">
          <caption className="sr-only">Quotation lines</caption>
          <thead>
            <tr className="border-b border-slate-300 text-xs text-slate-500">
              <th scope="col" className="py-2 pr-3 font-medium">Description</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Qty</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Unit price</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Tax</th>
              <th scope="col" className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {q.lines.map((l) => {
              const a = lineAmounts(l.quantity, l.unitPriceMinor, l.taxRatePercent);
              return (
                <tr key={l.id}>
                  <td className="py-2 pr-3 text-slate-900">{l.description}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{l.quantity}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(l.unitPriceMinor, q.currency)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {l.taxRatePercent}%{a.taxMinor ? <span className="block text-xs text-slate-500">{formatMoney(a.taxMinor, q.currency)}</span> : null}
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatMoney(a.grossMinor, q.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <dl className="mt-4 ml-auto grid max-w-xs grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-600">Subtotal</dt>
          <dd className="text-right tabular-nums">{formatMoney(totals.subtotalMinor, q.currency)}</dd>
          <dt className="text-slate-600">Tax</dt>
          <dd className="text-right tabular-nums">{formatMoney(totals.taxMinor, q.currency)}</dd>
          <dt className="border-t border-slate-300 pt-1 font-semibold">Total ({q.currency})</dt>
          <dd className="border-t border-slate-300 pt-1 text-right font-semibold tabular-nums">{formatMoney(totals.totalMinor, q.currency)}</dd>
        </dl>
      </div>

      <section className="border-t border-slate-200 pt-5">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Terms</h3>
        <p className="mt-1 text-sm whitespace-pre-line text-slate-700">{q.terms || 'No terms recorded.'}</p>
      </section>
    </article>
  );
}
