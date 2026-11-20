'use client';

import Link from 'next/link';
import { StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { DetailList } from '@/components/ui/detail-list';
import { PageHeader } from '@/components/ui/page-header';
import { PendingNotice } from '@/components/ui/states';
import { Table, Td, Th } from '@/components/ui/table';
import { formatDate, formatDateTime, formatKesExact } from '@/lib/format';
import { directionLabel, modeLabel, quotationStatusMeta } from '@/lib/labels';
import {
  bookingHref,
  bookingStatusMeta,
  liveQuotationHref,
  quotationDisplayStatus,
  trimDecimal,
  type LiveQuotation,
  type PartyRef,
} from '@/lib/live-quotations';
import { ConvertToBooking, LiveQuotationStatusForm } from './live-quotation-actions';

const linkClass = 'rounded text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600';

export function LiveQuotationDetail({
  quotation: q,
  canManage,
  carriers = [],
}: {
  quotation: LiveQuotation;
  canManage: boolean;
  /** Offered on the convert form. */
  carriers?: PartyRef[];
}) {
  const href = liveQuotationHref(q.reference);
  // "Booked" is not stored; it is shown while a booking exists (or "Booking cancelled").
  const statusMeta = quotationDisplayStatus(q);
  const finished = q.booking || q.status === 'declined' || q.status === 'expired';

  return (
    <>
      <div className="print:hidden">
        <PageHeader title={q.reference} description={`${q.customer.name} · ${q.origin} → ${q.destination}`} back={{ href: '/quotations', label: 'All quotations' }}>
          <StatusBadge meta={statusMeta} />
          {canManage && q.editable && (
            <ButtonLink href={`${href}/edit`} variant="secondary" size="sm">
              Edit
            </ButtonLink>
          )}
          {canManage && (
            <ButtonLink href={`/quotations/new?from=${encodeURIComponent(q.reference)}`} variant="secondary" size="sm">
              Duplicate as draft
            </ButtonLink>
          )}
          <Button size="sm" onClick={() => window.print()}>
            Print / save as PDF
          </Button>
        </PageHeader>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader title={`Quotation ${q.reference}`} description={`Issued ${formatDate(q.issueDate)} · valid until ${formatDate(q.validUntil)}`} />
            <CardBody>
              <DetailList
                items={[
                  { label: 'Customer', value: q.customer.name },
                  { label: 'Mode and direction', value: `${modeLabel[q.mode]} · ${directionLabel[q.direction]}` },
                  { label: 'Route', value: `${q.origin} → ${q.destination}` },
                  { label: 'Cargo', value: q.cargoSummary },
                  ...(q.incoterm ? [{ label: 'Incoterm', value: q.incoterm }] : []),
                  { label: 'Currency', value: 'Kenyan shilling (KES)' },
                ]}
              />
            </CardBody>
            <Table caption={`Line items of ${q.reference}`}>
              <thead>
                <tr>
                  <Th>Description</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Unit price</Th>
                  <Th className="text-right">Tax</Th>
                  <Th className="text-right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {(q.lines ?? []).map((line) => (
                  <tr key={line.id}>
                    <Td>{line.description}</Td>
                    <Td className="text-right tabular-nums">{trimDecimal(line.quantity)}</Td>
                    <Td className="text-right whitespace-nowrap tabular-nums">{formatKesExact(line.unitPrice)}</Td>
                    <Td className="text-right whitespace-nowrap tabular-nums">
                      {formatKesExact(line.amounts.tax)}
                      <span className="block text-xs text-slate-500">{trimDecimal(line.taxRate)}%</span>
                    </Td>
                    <Td className="text-right whitespace-nowrap tabular-nums">{formatKesExact(line.amounts.total)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <CardBody>
              <dl className="ml-auto grid w-full max-w-xs grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-slate-600">Subtotal</dt>
                <dd className="text-right tabular-nums">{formatKesExact(q.totals.subtotal)}</dd>
                <dt className="text-slate-600">Tax</dt>
                <dd className="text-right tabular-nums">{formatKesExact(q.totals.tax)}</dd>
                <dt className="border-t border-slate-200 pt-1 font-semibold text-slate-900">Total</dt>
                <dd className="border-t border-slate-200 pt-1 text-right font-semibold text-slate-900 tabular-nums">{formatKesExact(q.totals.total)}</dd>
              </dl>
              {q.terms && (
                <div className="mt-6 border-t border-slate-200 pt-4">
                  <h3 className="text-sm font-semibold text-slate-900">Terms and conditions</h3>
                  <p className="mt-1 text-sm whitespace-pre-line text-slate-700">{q.terms}</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-6 print:hidden">
          <Card>
            <CardHeader title="Status" />
            <CardBody className="flex flex-col gap-4">
              <DetailList
                columns={1}
                items={[
                  { label: 'Current status', value: <StatusBadge meta={statusMeta} /> },
                  ...(q.status === 'expired'
                    ? [{ label: 'Why expired', value: `Validity ended while it was "${quotationStatusMeta[q.storedStatus].label}".` }]
                    : []),
                  { label: 'Sent', value: q.sentAt ? `${formatDateTime(q.sentAt)} to ${q.sentTo} (recorded manually)` : 'Not sent' },
                  ...(q.decidedAt ? [{ label: 'Customer decision', value: formatDateTime(q.decidedAt) }] : []),
                  {
                    label: 'Booking',
                    value: q.booking ? (
                      <Link href={bookingHref(q.booking.reference)} className={`${linkClass} font-mono`}>
                        {q.booking.reference}
                      </Link>
                    ) : (
                      'Not booked'
                    ),
                  },
                  {
                    label: 'Customer',
                    value: (
                      <Link href={`/parties/${q.customer.id}`} className={linkClass}>
                        {q.customer.name}
                      </Link>
                    ),
                  },
                  { label: 'Agent', value: q.agent?.name ?? '—' },
                  ...(q.duplicatedFrom
                    ? [
                        {
                          label: 'Copied from',
                          value: (
                            <Link href={liveQuotationHref(q.duplicatedFrom.reference)} className={`${linkClass} font-mono`}>
                              {q.duplicatedFrom.reference}
                            </Link>
                          ),
                        },
                      ]
                    : []),
                  ...(q.preparedBy ? [{ label: 'Prepared by', value: q.preparedBy.name }] : []),
                  ...(q.internalNote ? [{ label: 'Internal note', value: q.internalNote }] : []),
                ]}
              />
              {canManage && <LiveQuotationStatusForm key={`${q.status}-${q.updatedAt}`} quotation={q} />}
              {finished && canManage && <p className="text-xs text-slate-500">No further status changes. Use &quot;Duplicate as draft&quot; to quote again.</p>}
            </CardBody>
          </Card>

          {q.status === 'accepted' && !q.booking && canManage && (
            <Card>
              <CardHeader title="Booking" description="Turn the accepted quotation into a booking" />
              <CardBody>
                <ConvertToBooking quotation={q} carriers={carriers} />
              </CardBody>
            </Card>
          )}
          {q.booking && (
            <Card>
              <CardHeader title="Booking" />
              <CardBody>
                <p className="text-sm text-slate-700">
                  <Link href={bookingHref(q.booking.reference)} className={`${linkClass} font-mono`}>
                    {q.booking.reference}
                  </Link>{' '}
                  · <StatusBadge meta={bookingStatusMeta[q.booking.status]} />
                </p>
                {q.booking.status === 'cancelled' && (
                  <p className="mt-2 text-sm text-slate-600">
                    This booking was cancelled. A quotation can be converted to a booking only once, so this quotation
                    cannot be converted again.
                  </p>
                )}
              </CardBody>
            </Card>
          )}

          <PendingNotice title="No sending integration">
            Quotations are not emailed from this system. &quot;Sent&quot; only records what staff did. Every change is kept in
            the audit log.
          </PendingNotice>
        </div>
      </div>
    </>
  );
}
