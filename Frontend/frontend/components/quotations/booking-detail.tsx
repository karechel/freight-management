'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { DetailList } from '@/components/ui/detail-list';
import { TextAreaField } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { ApiError, backend } from '@/lib/api/browser';
import { formatDateTime, formatKesExact } from '@/lib/format';
import { directionLabel, modeLabel, shipmentStatusMeta } from '@/lib/labels';
import { liveShipmentHref } from '@/lib/live-shipments';
import { bookingStatusMeta, creditApprovalMeta, liveQuotationHref, type LiveBooking } from '@/lib/live-quotations';

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

  // A booking awaiting credit approval cannot be confirmed (the backend refuses it too).
  const canConfirm = booking.status === 'pending' && booking.creditApproval?.state !== 'awaiting';
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

/**
 * Credit approval for a booking created over the limit (2026-11-20). Finance, management and
 * administrators (`credit.override`) approve or reject it with a reason; rejecting cancels it.
 */
function CreditApprovalCard({ booking, canApprove }: { booking: LiveBooking; canApprove: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);
  const approval = booking.creditApproval!;
  const decidable = canApprove && approval.state === 'awaiting' && booking.status === 'pending';

  async function decide(decision: 'approve' | 'reject') {
    setFailure(undefined);
    if (!reason.trim()) {
      setReasonError('Give a reason for your decision.');
      return;
    }
    setReasonError(undefined);
    setBusy(true);
    try {
      await backend.post(`bookings/${encodeURIComponent(booking.reference)}/credit-approval`, { decision, reason: reason.trim() });
      router.refresh();
    } catch (error) {
      setFailure(error instanceof ApiError ? error.message : 'The decision could not be recorded. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Credit approval" description="This booking was created over the customer's credit limit." />
      <CardBody className="flex flex-col gap-4">
        <DetailList
          items={[
            { label: 'Status', value: <StatusBadge meta={creditApprovalMeta[approval.state]} /> },
            {
              label: 'Requested',
              value: `${formatDateTime(approval.requestedAt)}${approval.requestedBy ? ` by ${approval.requestedBy.name}` : ''}`,
            },
            { label: 'Reason given', value: approval.reason },
            ...(approval.attemptedAmount
              ? [
                  {
                    label: 'Figures at request',
                    value: `Outstanding ${formatKesExact(approval.exposure!)} · booking ${formatKesExact(approval.attemptedAmount)} · limit ${formatKesExact(approval.creditLimit!)}`,
                  },
                ]
              : []),
          ]}
        />
        {approval.state === 'awaiting' && !decidable && (
          <p className="text-sm text-slate-600">Waiting for finance, management or an administrator to approve or reject it.</p>
        )}
        {decidable && (
          <div className="flex flex-col gap-3 border-t border-slate-200 pt-4">
            {failure && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                {failure}
              </p>
            )}
            <TextAreaField
              id="credit-approval-reason"
              label="Reason for your decision"
              required
              value={reason}
              onChange={(value) => {
                setReason(value);
                setReasonError(undefined);
              }}
              rows={2}
              maxLength={500}
              error={reasonError}
              hint="Recorded with your name and the time. Rejecting cancels the booking."
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => decide('reject')} disabled={busy}>
                Reject and cancel booking
              </Button>
              <Button size="sm" onClick={() => decide('approve')} disabled={busy}>
                {busy ? 'Saving…' : 'Approve'}
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export function BookingDetail({
  booking: b,
  canManage,
  canApprove = false,
  canCreateShipment = false,
}: {
  booking: LiveBooking;
  canManage: boolean;
  /** Holds `credit.override`: may approve or reject bookings awaiting credit approval. */
  canApprove?: boolean;
  /** Holds `shipments.manage`: may create shipments from a confirmed booking. */
  canCreateShipment?: boolean;
}) {
  return (
    <>
      <PageHeader title={b.reference} description={`${b.customer.name} · ${b.origin} → ${b.destination}`} back={{ href: '/bookings', label: 'All bookings' }}>
        <StatusBadge meta={bookingStatusMeta[b.status]} />
        {b.creditApproval?.state === 'awaiting' && <StatusBadge meta={creditApprovalMeta.awaiting} />}
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

          {b.creditApproval && <CreditApprovalCard key={`${b.creditApproval.state}-${b.updatedAt}`} booking={b} canApprove={canApprove} />}

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
              {b.creditApproval?.state === 'awaiting' && b.status === 'pending' && (
                <p className="text-sm text-slate-600">It can be confirmed once its credit approval is given.</p>
              )}
              {canManage && <BookingActions key={`${b.status}-${b.updatedAt}`} booking={b} />}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Shipments" description="Jobs created from this booking. A booking may have several." />
            <CardBody className="flex flex-col gap-3">
              {b.shipments.length === 0 ? (
                <p className="text-sm text-slate-600">
                  {b.status === 'confirmed' ? 'No shipments yet.' : 'Shipments can be created once the booking is confirmed.'}
                </p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {b.shipments.map((s) => (
                    <li key={s.reference} className="flex items-center justify-between gap-2">
                      <Link href={liveShipmentHref(s.reference)} className={`${linkClass} font-mono`}>
                        {s.reference}
                      </Link>
                      <StatusBadge meta={shipmentStatusMeta[s.status]} />
                    </li>
                  ))}
                </ul>
              )}
              {canCreateShipment && b.status === 'confirmed' && (
                <ButtonLink href={`/shipments/new?booking=${encodeURIComponent(b.reference)}`} size="sm">
                  Create shipment
                </ButtonLink>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
