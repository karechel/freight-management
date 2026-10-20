'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { inputClass } from '@/components/ui/form';
import { ModeIcon, SearchIcon } from '@/components/ui/icons';
import { EmptyState } from '@/components/ui/states';
import { Table, Td, Th } from '@/components/ui/table';
import { useSessionStore } from '@/lib/data/session-store';
import { daysBetween, formatDate } from '@/lib/format';
import { directionLabel, modeLabel, quotationStatusMeta } from '@/lib/labels';
import { formatMoney } from '@/lib/money';
import { effectiveQuotationStatus, isOpenQuotation, quotationTotals, totalsByCurrency } from '@/lib/quotations';
import type { Currency, QuotationStatus } from '@/lib/types';

export const quotationHref = (reference: string) => `/quotations/${encodeURIComponent(reference)}`;

const statusFilters: (QuotationStatus | 'all' | 'open')[] = ['open', 'all', 'draft', 'sent', 'accepted', 'booked', 'declined', 'expired'];
const filterLabel = (f: (typeof statusFilters)[number]) =>
  f === 'all' ? 'All statuses' : f === 'open' ? 'Open (draft, sent, accepted)' : quotationStatusMeta[f].label;

const shipmentLink =
  'rounded font-mono text-xs text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600';

function moneySummary(sums: Partial<Record<Currency, number>>) {
  const parts = (Object.entries(sums) as [Currency, number][]).map(([c, v]) => formatMoney(v, c));
  return parts.length ? parts.join(' + ') : formatMoney(0, 'KES');
}

export function QuotationList({ referenceDate }: { referenceDate: string }) {
  const { quotations } = useSessionStore();
  const router = useRouter();
  const [status, setStatus] = useState<(typeof statusFilters)[number]>('all');
  const [query, setQuery] = useState('');

  const rows = useMemo(
    () => quotations.map((q) => ({ q, status: effectiveQuotationStatus(q, referenceDate), totals: quotationTotals(q.lines) })),
    [quotations, referenceDate],
  );
  const open = rows.filter((r) => isOpenQuotation(r.status));
  const booked = rows.filter((r) => r.status === 'booked');
  const decided = rows.filter((r) => ['booked', 'accepted', 'declined'].includes(r.status));
  const winRate = decided.length ? Math.round((decided.filter((r) => r.status !== 'declined').length / decided.length) * 100) : 0;

  const q = query.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      (status === 'all' || (status === 'open' ? isOpenQuotation(r.status) : r.status === status)) &&
      (!q || [r.q.reference, r.q.customerName, r.q.origin, r.q.destination, r.q.cargoSummary, r.q.shipmentReference ?? ''].join(' ').toLowerCase().includes(q)),
  );

  const summary = [
    { label: 'Open quotations', value: String(open.length), detail: `${moneySummary(totalsByCurrency(open.map((r) => r.q)))} quoted` },
    { label: 'Converted to bookings', value: String(booked.length), detail: 'Linked to a shipment job' },
    { label: 'Acceptance rate', value: `${winRate}%`, detail: `Of ${decided.length} decided quotations` },
  ];

  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summary.map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <p className="text-sm font-medium text-slate-600">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">{item.value}</p>
            <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader title="Quotations" description="Newest issue date first. Expired is worked out from the validity date." />
        <form role="search" onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:px-5">
          <label className="relative flex-1">
            <span className="sr-only">Search quotations</span>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search reference, customer, route, cargo…"
              className={`${inputClass} w-full pl-8`}
            />
          </label>
          <label>
            <span className="sr-only">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={`${inputClass} w-full`}>
              {statusFilters.map((f) => (
                <option key={f} value={f}>
                  {filterLabel(f)}
                </option>
              ))}
            </select>
          </label>
        </form>
        {visible.length === 0 ? (
          <EmptyState title="No quotations match these filters" description="Try another status or search term.">
            <button
              type="button"
              onClick={() => {
                setStatus('all');
                setQuery('');
              }}
              className="mt-1 rounded text-sm font-medium text-blue-700 hover:text-blue-900 focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              Clear filters
            </button>
          </EmptyState>
        ) : (
          <Table caption="Quotations">
            <thead>
              <tr>
                <Th>Quotation</Th>
                <Th>Customer</Th>
                <Th>Route and cargo</Th>
                <Th className="text-right">Total</Th>
                <Th>Status</Th>
                <Th>Valid until</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ q: quote, status: s, totals }) => {
                const daysLeft = daysBetween(referenceDate, quote.validUntil);
                const expiringSoon = isOpenQuotation(s) && s !== 'accepted' && daysLeft >= 0 && daysLeft <= 2;
                return (
                  <tr
                    key={quote.reference}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('a, button') || window.getSelection()?.toString()) return;
                      router.push(quotationHref(quote.reference));
                    }}
                  >
                    <Td>
                      <Link
                        href={quotationHref(quote.reference)}
                        className="rounded font-mono text-[13px] font-medium text-blue-700 hover:text-blue-900 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
                      >
                        {quote.reference}
                      </Link>
                      <p className="flex items-center gap-1 text-xs text-slate-500">
                        <ModeIcon mode={quote.mode} className="size-3.5" />
                        {modeLabel[quote.mode]} · {directionLabel[quote.direction]}
                      </p>
                    </Td>
                    <Td className="font-medium text-slate-900">{quote.customerName}</Td>
                    <Td>
                      <p>
                        {quote.origin} → {quote.destination}
                      </p>
                      <p className="text-xs text-slate-500">{quote.cargoSummary}</p>
                    </Td>
                    <Td className="text-right whitespace-nowrap tabular-nums">{formatMoney(totals.totalMinor, quote.currency)}</Td>
                    <Td>
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge meta={quotationStatusMeta[s]} />
                        {quote.shipmentReference && (
                          <Link href={`/shipments/${encodeURIComponent(quote.shipmentReference)}`} className={shipmentLink}>
                            {quote.shipmentReference}
                          </Link>
                        )}
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {formatDate(quote.validUntil)}
                      {expiringSoon && <p className="text-xs font-medium text-amber-800">Expires soon</p>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <p className="px-4 py-2.5 text-xs text-slate-500 sm:px-5" aria-live="polite">
          Showing {visible.length} of {rows.length} quotations
        </p>
      </Card>
    </>
  );
}
