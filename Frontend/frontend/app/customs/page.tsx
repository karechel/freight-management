import type { Metadata } from 'next';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { DataSourceNotice, EmptyState, PendingNotice } from '@/components/ui/states';
import { Table, Td, Th } from '@/components/ui/table';
import { getShipments } from '@/lib/data';
import { formatDateTime, formatKes } from '@/lib/format';
import { customsStatusMeta, directionLabel, modeLabel } from '@/lib/labels';
import { isActive } from '@/lib/metrics';
import type { CustomsStatus } from '@/lib/types';

export const metadata: Metadata = { title: 'Customs & duties' };

const pipeline: CustomsStatus[] = ['not_started', 'documents_pending', 'lodged', 'assessed', 'duty_paid', 'query', 'released'];

export default async function CustomsPage() {
  const shipments = await getShipments();
  const active = shipments.data.filter(isActive);
  const counts = Object.fromEntries(
    pipeline.map((status) => [status, active.filter((s) => s.customs.status === status).length]),
  ) as Record<CustomsStatus, number>;
  const assessedUnpaid = active
    .filter((s) => s.customs.status === 'assessed')
    .reduce((sum, s) => sum + (s.customs.dutyKes ?? 0), 0);
  const rows = [...active].sort(
    (a, b) => pipeline.indexOf(a.customs.status) - pipeline.indexOf(b.customs.status),
  );

  return (
    <>
      <PageHeader
        title="Customs & duties"
        description="Clearance status and recorded duty for active shipments."
      />
      <DataSourceNotice source={shipments.source} />
      <div className="mb-6">
        <PendingNotice title="KRA iCMS integration pending">
          Entries are not lodged with, or read from, KRA iCMS. Access and onboarding status are unknown. Statuses and
          duty amounts here are recorded manually and must be checked against the official system.
        </PendingNotice>
      </div>

      <ul className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {pipeline.map((status) => (
          <li key={status} className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
            <p className="text-xs font-medium text-slate-600">{customsStatusMeta[status].label}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900 tabular-nums">{counts[status]}</p>
          </li>
        ))}
      </ul>

      <Card>
        <CardHeader
          title="Active clearance work"
          description={`Duty assessed and awaiting payment: ${formatKes(assessedUnpaid)}`}
        />
        {rows.length === 0 ? (
          <EmptyState title="No active shipments" />
        ) : (
          <Table caption="Customs status by shipment">
            <thead>
              <tr>
                <Th>Shipment</Th>
                <Th>Customer</Th>
                <Th>Customs status</Th>
                <Th>Internal entry ref.</Th>
                <Th className="text-right">Duty (recorded)</Th>
                <Th>Updated</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.reference} className="hover:bg-slate-50">
                  <Td>
                    <Link
                      href={`/shipments/${s.reference}`}
                      className="rounded font-mono text-[13px] font-medium text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
                    >
                      {s.reference}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {modeLabel[s.mode]} {directionLabel[s.direction].toLowerCase()} · {s.destination}
                    </p>
                  </Td>
                  <Td className="font-medium text-slate-900">{s.customerName}</Td>
                  <Td><StatusBadge meta={customsStatusMeta[s.customs.status]} /></Td>
                  <Td className="font-mono text-[13px]">{s.customs.entryReference ?? '—'}</Td>
                  <Td className="text-right tabular-nums">
                    {s.customs.dutyKes !== undefined ? formatKes(s.customs.dutyKes) : '—'}
                  </Td>
                  <Td className="whitespace-nowrap">{formatDateTime(s.customs.updatedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
