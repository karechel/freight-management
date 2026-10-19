import type { Metadata } from 'next';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { ModeIcon } from '@/components/ui/icons';
import { PageHeader } from '@/components/ui/page-header';
import { DataSourceNotice, EmptyState } from '@/components/ui/states';
import { Table, Td, Th } from '@/components/ui/table';
import { DEMO_REFERENCE_DATE, getQuotations } from '@/lib/data';
import { daysBetween, formatDate, formatKes } from '@/lib/format';
import { directionLabel, modeLabel, quotationStatusMeta } from '@/lib/labels';
import type { QuotationStatus } from '@/lib/types';

export const metadata: Metadata = { title: 'Quotations & bookings' };

const openStatuses: QuotationStatus[] = ['draft', 'sent', 'accepted'];

export default async function QuotationsPage() {
  const quotations = await getQuotations();
  const all = quotations.data;
  const open = all.filter((q) => openStatuses.includes(q.status));
  const booked = all.filter((q) => q.status === 'booked');
  const decided = all.filter((q) => ['booked', 'accepted', 'declined'].includes(q.status));
  const winRate = decided.length
    ? Math.round((decided.filter((q) => q.status !== 'declined').length / decided.length) * 100)
    : 0;

  const summary = [
    { label: 'Open quotations', value: String(open.length), detail: formatKes(open.reduce((s, q) => s + q.amountKes, 0)) + ' quoted' },
    { label: 'Converted to bookings', value: String(booked.length), detail: 'Linked to a shipment job' },
    { label: 'Acceptance rate', value: `${winRate}%`, detail: `Of ${decided.length} decided quotations` },
  ];

  return (
    <>
      <PageHeader
        title="Quotations & bookings"
        description="Freight quotations for sea, air, road and rail, and the bookings they turn into."
      />
      <DataSourceNotice source={quotations.source}>
        Creating, sending or converting quotations needs backend support that does not exist yet.
      </DataSourceNotice>

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
        <CardHeader title="All quotations" description="Newest first" />
        {all.length === 0 ? (
          <EmptyState title="No quotations yet" />
        ) : (
          <Table caption="Quotations">
            <thead>
              <tr>
                <Th>Quotation</Th>
                <Th>Customer</Th>
                <Th>Route and cargo</Th>
                <Th className="text-right">Amount</Th>
                <Th>Status</Th>
                <Th>Valid until</Th>
              </tr>
            </thead>
            <tbody>
              {all.map((q) => {
                const daysLeft = daysBetween(DEMO_REFERENCE_DATE, q.validUntil);
                const expiringSoon = openStatuses.includes(q.status) && daysLeft >= 0 && daysLeft <= 2;
                return (
                  <tr key={q.reference} className="hover:bg-slate-50">
                    <Td>
                      <p className="font-mono text-[13px] font-medium text-slate-900">{q.reference}</p>
                      <p className="flex items-center gap-1 text-xs text-slate-500">
                        <ModeIcon mode={q.mode} className="size-3.5" />
                        {modeLabel[q.mode]} · {directionLabel[q.direction]}
                      </p>
                    </Td>
                    <Td className="font-medium text-slate-900">{q.customerName}</Td>
                    <Td>
                      <p>{q.origin} → {q.destination}</p>
                      <p className="text-xs text-slate-500">{q.cargoSummary}</p>
                    </Td>
                    <Td className="text-right whitespace-nowrap tabular-nums">{formatKes(q.amountKes)}</Td>
                    <Td>
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge meta={quotationStatusMeta[q.status]} />
                        {q.shipmentReference && (
                          <Link
                            href={`/shipments/${q.shipmentReference}`}
                            className="rounded font-mono text-xs text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
                          >
                            {q.shipmentReference}
                          </Link>
                        )}
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {formatDate(q.validUntil)}
                      {expiringSoon && <p className="text-xs font-medium text-amber-800">Expires soon</p>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
