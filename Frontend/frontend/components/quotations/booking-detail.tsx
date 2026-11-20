'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { DetailList } from '@/components/ui/detail-list';
import { TextAreaField } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { PendingNotice } from '@/components/ui/states';
import { ApiError, backend } from '@/lib/api/browser';
import { formatDateTime, formatKesExact } from '@/lib/format';
import { directionLabel, modeLabel } from '@/lib/labels';
import { bookingStatusMeta, liveQuotationHref, type LiveBooking } from '@/lib/live-quotations';

const linkClass = 'rounded text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600';

function BookingActions({ booking }: { booking: LiveBooking }) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);
  const path = `bookings/${encodeURIComponent(booking.reference)}`;

  async function run(action: 'confirm' | 'cancel') {
    setFailure(undefined);
    if (action === 'cancel' && !reason.trim()) {
      setReasonError('Give the reason for cancelling.');
      return;
    }
    setReasonError(undefined);
    setBusy(true);
    try {
      await backend.post(`${path}/${action}`, action === 'cancel' ? { reason: reason.trim() } : {});
      router.refresh();
      setCancelling(false);
    } catch (error) {
      setFailure(error instanceof ApiError ? error.message : 'The booking could not be updated. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const canConfirm = booking.status === 'pending';
  const canCancel = booking.status === 'pending' || booking.status === 'confirmed';
  if (!canConfirm && !canCancel) return null;

  return (
    <div className="flex flex-col gap-3">
      {failure && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {failure}
        </p>
      )}
      {cancelling ? (
        <>
          <TextAreaField id="booking-cancel-reason" label="Reason for cancelling" required value={reason} onChange={setReason} rows={2} maxLength={500} error={reasonError} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCancelling(false)} disabled={busy}>
              Keep booking
            </Button>
            <Button size="sm" onClick={() => run('cancel')} disabled={busy}>
              {busy ? 'Cancelling…' : 'Cancel booking'}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          {canConfirm && (
            <Button size="sm" onClick={() => run('confirm')} disabled={busy}>
              {busy ? 'Saving…' : 'Confirm booking'}
            </Button>
          )}
          {canCancel && (
            <Button variant="secondary" size="sm" onClick={() => setCancelling(true)} disabled={busy}>
              Cancel booking…
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function BookingDetail({ booking: b, canManage }: { booking: LiveBooking; canManage: boolean }) {
  return (
    <>
      <PageHeader title={b.reference} description={`${b.customer.name} · ${b.origin} → ${b.destination}`} back={{ href: '/bookings', label: 'All bookings' }}>
        <StatusBadge meta={bookingStatusMeta[b.status]} />
      </PageHeader>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader title="Booking details" />
            <CardBody>
              <DetailList
                items={[
                  {
                    label: 'Customer',
                    value: (
                      <Link href={`/parties/${b.customer.id}`} className={linkClass}>
                        {b.customer.name}
                      </Link>
                    ),
                  },
                  {
                    label: 'Quotation',
                    value: b.quotation ? (
                      <Link href={liveQuotationHref(b.quotation.reference)} className={`${linkClass} font-mono`}>
                        {b.quotation.reference}
                      </Link>
                    ) : (
                      'Booked without a quotation'
                    ),
                  },
                  { label: 'Mode and direction', value: `${modeLabel[b.mode]} · ${directionLabel[b.direction]}` },
                  { label: 'Route', value: `${b.origin} → ${b.destination}` },
                  { label: 'Cargo', value: b.cargoSummary },
                  { label: 'Agent', value: b.agent?.name ?? '—' },
                  { label: 'Carrier', value: b.carrier?.name ?? 'Not recorded' },
                  { label: 'Carrier booking number', value: b.carrierBookingNumber ?? 'Not recorded' },
                  { label: 'Planned departure', value: b.plannedEtd ? formatDateTime(b.plannedEtd) : 'Not recorded' },
                  { label: 'Planned arrival', value: b.plannedEta ? formatDateTime(b.plannedEta) : 'Not recorded' },
                ]}
              />
            </CardBody>
          </Card>

          {b.creditChecks && b.creditChecks.length > 0 && (
            <Card>
              <CardHeader title="Credit-limit decisions" description="Recorded when this booking was created over the customer's credit limit." />
              <CardBody className="flex flex-col gap-4">
                {b.creditChecks.map((c) => (
                  <div key={c.decidedAt} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <p className="font-medium text-slate-900">
                      <Badge tone={c.decision === 'proceed' ? 'warning' : 'neutral'}>{c.decision === 'proceed' ? 'Proceeded past the limit' : 'Stopped'}</Badge>{' '}
                      by {c.decidedBy?.name ?? 'unknown'} on {formatDateTime(c.decidedAt)}
                    </p>
                    <p className="mt-1 text-slate-700">Reason: {c.reason}</p>
                    <p className="mt-1 text-xs text-slate-500 tabular-nums">
                      Outstanding {formatKesExact(c.exposure)} · booking {formatKesExact(c.attemptedAmount)} · limit {formatKesExact(c.creditLimit)}
                    </p>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Status" />
            <CardBody className="flex flex-col gap-4">
              <DetailList
                columns={1}
                items={[
                  { label: 'Current status', value: <StatusBadge meta={bookingStatusMeta[b.status]} /> },
                  { label: 'Created', value: `${formatDateTime(b.createdAt)}${b.createdBy ? ` by ${b.createdBy.name}` : ''}` },
                  ...(b.confirmedAt ? [{ label: 'Confirmed', value: formatDateTime(b.confirmedAt) }] : []),
                  ...(b.cancelledAt ? [{ label: 'Cancelled', value: `${formatDateTime(b.cancelledAt)}: ${b.cancellationReason}` }] : []),
                ]}
              />
              {canManage && <BookingActions key={`${b.status}-${b.updatedAt}`} booking={b} />}
            </CardBody>
          </Card>
          <PendingNotice title="Shipments come next">
            Shipment jobs created from this booking arrive with the shipments phase. Until then, shipments stay on demo data.
          </PendingNotice>
        </div>
      </div>
    </>
  );
}
