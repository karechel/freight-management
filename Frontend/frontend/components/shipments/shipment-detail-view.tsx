'use client';

// Shipment detail page body. The shipment comes from the session store, so
// edits, status changes and delays made in this tab show immediately.

import Link from 'next/link';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { DetailList } from '@/components/ui/detail-list';
import { AlertIcon, ModeIcon } from '@/components/ui/icons';
import { PageHeader } from '@/components/ui/page-header';
import { SessionNotice } from '@/components/ui/session-notice';
import { DataSourceNotice, EmptyState, PendingNotice, RecordNotFound, SESSION_EDIT_NOTE } from '@/components/ui/states';
import type { ShipmentFormOptions } from '@/lib/data';
import { useSessionShipment, useSessionStore } from '@/lib/data/session-store';
import { formatDateTime, formatKes, formatNumber } from '@/lib/format';
import { customsStatusMeta, directionLabel, modeLabel, severityMeta, shipmentStatusMeta } from '@/lib/labels';
import { unresolvedDelays } from '@/lib/metrics';
import type { DataSource } from '@/lib/types';
import { DocumentList } from '@/components/documents/document-list';
import { DelayCard } from './delay-panel';
import { MilestoneTimeline } from './milestone-timeline';
import { MilestoneUpdateForm } from './milestone-update';
import { ShipmentDates } from './shipment-dates';
import { ShipmentHistory } from './shipment-history';
import { shipmentHref } from './shipment-table';
import { StatusChangePanel } from './status-change';

const textLink = 'rounded text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600';

interface ShipmentDetailViewProps {
  reference: string;
  options: ShipmentFormOptions;
  source: DataSource;
  /** Server-rendered billing card for this reference. */
  records: React.ReactNode;
}

export function ShipmentDetailView({ reference, options, source, records }: ShipmentDetailViewProps) {
  const s = useSessionShipment(reference);
  const { quotations } = useSessionStore();
  if (!s) {
    return <RecordNotFound title={`Shipment ${reference} was not found`} backHref="/shipments" backLabel="All shipments" />;
  }
  const openDelays = unresolvedDelays(s);
  const linkedQuotations = quotations.filter((q) => q.shipmentReference === s.reference);
  const delays = [...s.delays].sort((a, b) => {
    // Unresolved first, then newest.
    const resolved = Number(a.status === 'resolved') - Number(b.status === 'resolved');
    return resolved || b.identifiedAt.localeCompare(a.identifiedAt);
  });
  const docLabel = s.mode === 'air' ? 'Air waybill' : s.mode === 'sea' ? 'Bill of lading' : 'Consignment note';

  return (
    <>
      <PageHeader title={s.reference} description={`${s.customerName} · ${s.cargoDescription}`} back={{ href: '/shipments', label: 'All shipments' }}>
        <Badge tone="neutral">
          <ModeIcon mode={s.mode} className="size-3.5" />
          {modeLabel[s.mode]} · {directionLabel[s.direction]}
        </Badge>
        <StatusBadge meta={shipmentStatusMeta[s.status]} />
        <ButtonLink href={`${shipmentHref(s.reference)}/edit`} variant="secondary" size="sm">
          Edit shipment
        </ButtonLink>
        <ButtonLink href={`${shipmentHref(s.reference)}/delays/new`} size="sm">
          Record delay
        </ButtonLink>
      </PageHeader>

      <SessionNotice />
      <DataSourceNotice source={source}>{SESSION_EDIT_NOTE}</DataSourceNotice>

      {s.exceptions.length > 0 && (
        <section aria-labelledby="exceptions-heading" className="mb-6 rounded-xl border border-red-200 bg-red-50/60 px-4 py-3 sm:px-5">
          <h2 id="exceptions-heading" className="flex items-center gap-2 text-sm font-semibold text-red-900">
            <AlertIcon className="size-4" /> Open exceptions
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {s.exceptions.map((ex) => (
              <li key={ex.id} className="flex flex-col gap-1 text-sm text-red-950 sm:flex-row sm:items-start sm:gap-3">
                <StatusBadge meta={severityMeta[ex.severity]} />
                <span className="flex-1">{ex.message}</span>
                <span className="text-xs whitespace-nowrap text-red-800">{formatDateTime(ex.raisedAt)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-red-900">
            To track follow-up, revised dates and customer notification, record this as a delay.
          </p>
        </section>
      )}

      {delays.length > 0 && (
        <section aria-labelledby="delays-heading" className="mb-6">
          <h2 id="delays-heading" className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            Delays
            <span className="font-normal text-slate-500">
              {openDelays.length} unresolved · {delays.length - openDelays.length} resolved
            </span>
          </h2>
          <div className="flex flex-col gap-4">
            {delays.map((d) => (
              <DelayCard key={d.id} shipment={s} delay={d} />
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader title="Shipment details" />
            <CardBody>
              <DetailList
                columns={3}
                items={[
                  { label: 'Origin', value: s.origin },
                  { label: 'Destination', value: s.destination },
                  { label: 'Carrier', value: s.carrier },
                  { label: docLabel, value: <span className="font-mono text-[13px]">{s.transportDocRef}</span> },
                  { label: 'Equipment', value: s.equipment },
                  { label: 'Packages / weight', value: `${formatNumber(s.packages)} pkgs · ${formatNumber(s.weightKg)} kg` },
                  {
                    label: 'Customer',
                    value: (
                      <Link href={`/parties/${encodeURIComponent(s.customerId)}`} className={textLink}>
                        {s.customerName}
                      </Link>
                    ),
                  },
                  {
                    label: 'Overseas / partner agent',
                    value:
                      s.agentName && options.agentIds[s.agentName] ? (
                        <Link href={`/parties/${encodeURIComponent(options.agentIds[s.agentName])}`} className={textLink}>
                          {s.agentName}
                        </Link>
                      ) : (
                        (s.agentName ?? '—')
                      ),
                  },
                  {
                    label: 'Agent route',
                    value: (s.agentName && options.agentRoutes[s.agentName]?.find((r) => r.id === s.agentRouteId)?.label) ?? '—',
                  },
                  {
                    label: 'From quotation',
                    value: linkedQuotations.length
                      ? linkedQuotations.map((q) => (
                          <Link key={q.reference} href={`/quotations/${encodeURIComponent(q.reference)}`} className={`${textLink} mr-2 font-mono text-[13px]`}>
                            {q.reference}
                          </Link>
                        ))
                      : '—',
                  },
                  { label: 'Assigned to', value: s.assignedTo },
                  { label: 'Last update', value: formatDateTime(s.updatedAt) },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Dates" description="Estimated (planned) dates compared with what actually happened" />
            <CardBody>
              <ShipmentDates shipment={s} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Documents" description="Required shipping and clearing documents for this job">
              <ButtonLink href={`/documents/upload?shipment=${encodeURIComponent(s.reference)}`} size="sm" variant="secondary">
                Upload documents
              </ButtonLink>
            </CardHeader>
            <DocumentList shipmentReference={s.reference} />
            <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500 sm:px-5">
              Files added here stay in this browser tab only. Permanent storage needs private, access-controlled storage, which is not built yet.
            </p>
          </Card>

          {records}

          <Card>
            <CardHeader title="Change history" description="Oldest first. Includes only changes made in this browser tab." />
            <ShipmentHistory events={s.events} />
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Change status" description={`Current: ${shipmentStatusMeta[s.status].label}`} />
            <CardBody>
              <StatusChangePanel shipment={s} options={options} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Tracking milestones" description="Chronological; planned dates shown until the actual date is recorded" />
            <CardBody className="flex flex-col gap-5">
              <MilestoneTimeline milestones={s.milestones} />
              {s.milestones.length > 0 ? (
                <details className="group rounded-lg border border-slate-200">
                  <summary className="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-blue-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600">
                    Update a milestone
                  </summary>
                  <div className="border-t border-slate-200 p-3">
                    <MilestoneUpdateForm shipment={s} />
                  </div>
                </details>
              ) : (
                <EmptyState title="No milestones recorded" />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Customs" />
            <CardBody className="flex flex-col gap-4">
              <DetailList
                columns={1}
                items={[
                  { label: 'Status', value: <StatusBadge meta={customsStatusMeta[s.customs.status]} /> },
                  { label: 'Internal entry reference', value: s.customs.entryReference ?? '—' },
                  { label: 'Duty and taxes (recorded)', value: s.customs.dutyKes !== undefined ? formatKes(s.customs.dutyKes) : '—' },
                  { label: 'Last update', value: formatDateTime(s.customs.updatedAt) },
                ]}
              />
              <PendingNotice title="KRA iCMS integration pending">
                Customs status here is recorded manually. It is not synchronised with KRA iCMS.
              </PendingNotice>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
