'use client';

import Link from 'next/link';
import { StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { DetailList } from '@/components/ui/detail-list';
import { PageHeader } from '@/components/ui/page-header';
import { SessionNotice } from '@/components/ui/session-notice';
import { DataSourceNotice, PendingNotice, RecordNotFound, SESSION_EDIT_NOTE } from '@/components/ui/states';
import { useSessionQuotation } from '@/lib/data/session-store';
import { formatDateTime } from '@/lib/format';
import { quotationStatusMeta } from '@/lib/labels';
import { canEditQuotation } from '@/lib/quotation-changes';
import { effectiveQuotationStatus } from '@/lib/quotations';
import type { BillingProfile, DataSource } from '@/lib/types';
import { EventHistory, quotationKindMeta } from '@/components/shipments/shipment-history';
import { QuotationBooking, QuotationStatusForm } from './quotation-actions';
import { QuotationDocument } from './quotation-document';
import { quotationHref } from './quotation-list';

const linkClass = 'rounded font-mono text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600';

export function QuotationDetailView({
  reference,
  referenceDate,
  billingByCustomer,
  source,
}: {
  reference: string;
  referenceDate: string;
  billingByCustomer: Record<string, BillingProfile | undefined>;
  source: DataSource;
}) {
  const q = useSessionQuotation(reference);
  if (!q) {
    return <RecordNotFound title={`Quotation ${reference} was not found`} backHref="/quotations" backLabel="All quotations" />;
  }
  const status = effectiveQuotationStatus(q, referenceDate);
  const billing = billingByCustomer[q.customerId];
  const href = quotationHref(q.reference);

  return (
    <>
      <div className="print:hidden">
        <PageHeader title={q.reference} description={`${q.customerName} · ${q.origin} → ${q.destination}`} back={{ href: '/quotations', label: 'All quotations' }}>
          <StatusBadge meta={quotationStatusMeta[status]} />
          {canEditQuotation(q, referenceDate) && (
            <ButtonLink href={`${href}/edit`} variant="secondary" size="sm">
              Edit draft
            </ButtonLink>
          )}
          <ButtonLink href={`/quotations/new?from=${encodeURIComponent(q.reference)}`} variant="secondary" size="sm">
            Duplicate as draft
          </ButtonLink>
          <Button size="sm" onClick={() => window.print()}>
            Print / save as PDF
          </Button>
        </PageHeader>
        <SessionNotice />
        <DataSourceNotice source={source}>{SESSION_EDIT_NOTE}</DataSourceNotice>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <QuotationDocument quotation={q} status={status} billing={billing} />
        </div>

        <div className="flex flex-col gap-6 print:hidden">
          <Card>
            <CardHeader title="Status" />
            <CardBody className="flex flex-col gap-4">
              <DetailList
                columns={1}
                items={[
                  { label: 'Current status', value: <StatusBadge meta={quotationStatusMeta[status]} /> },
                  ...(status === 'expired' && q.status !== 'expired'
                    ? [{ label: 'Why expired', value: `Validity ended while it was "${quotationStatusMeta[q.status].label}".` }]
                    : []),
                  {
                    label: 'Sent',
                    value: q.sentAt
                      ? `${formatDateTime(q.sentAt)} to ${q.sentTo} (recorded manually)`
                      : q.status === 'draft'
                        ? 'Not sent'
                        : 'Sent; date not recorded in the demo data',
                  },
                  ...(q.decidedAt ? [{ label: 'Customer decision', value: formatDateTime(q.decidedAt) }] : []),
                  {
                    label: 'Shipment',
                    value: q.shipmentReference ? (
                      <Link href={`/shipments/${encodeURIComponent(q.shipmentReference)}`} className={linkClass}>
                        {q.shipmentReference}
                      </Link>
                    ) : (
                      'Not booked'
                    ),
                  },
                  {
                    label: 'Customer',
                    value: (
                      <Link href={`/parties/${encodeURIComponent(q.customerId)}`} className="rounded text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">
                        {q.customerName}
                      </Link>
                    ),
                  },
                  { label: 'Agent', value: q.agentName ?? '—' },
                  ...(q.duplicatedFrom
                    ? [{ label: 'Copied from', value: <Link href={quotationHref(q.duplicatedFrom)} className={linkClass}>{q.duplicatedFrom}</Link> }]
                    : []),
                  ...(q.internalNote ? [{ label: 'Internal note', value: q.internalNote }] : []),
                ]}
              />
              <QuotationStatusForm key={status} quotation={q} status={status} referenceDate={referenceDate} suggestedRecipient={billing?.email} />
              {(status === 'expired' || status === 'declined' || status === 'booked') && (
                <p className="text-xs text-slate-500">No further status changes. Use &quot;Duplicate as draft&quot; to quote again.</p>
              )}
            </CardBody>
          </Card>

          {status === 'accepted' && (
            <Card>
              <CardHeader title="Booking" description="Turn the accepted quotation into a shipment job" />
              <CardBody>
                <QuotationBooking quotation={q} />
              </CardBody>
            </Card>
          )}

          <PendingNotice title="No sending integration">
            Quotations are not emailed from this system. &quot;Sent&quot; only records what staff did. Delivery to the
            customer needs an email or customer-portal integration (see docs/api-contracts.md).
          </PendingNotice>

          <Card>
            <CardHeader title="Change history" description="Oldest first. Only changes made in this browser tab." />
            <EventHistory
              events={q.events}
              kindMeta={quotationKindMeta}
              emptyDescription="Edits and status changes made in this tab appear here. Earlier history is not part of the demo data."
            />
          </Card>
        </div>
      </div>
    </>
  );
}
