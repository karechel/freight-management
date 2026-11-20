'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { DateField, SelectField, TextAreaField, TextField } from '@/components/ui/form';
import { ApiError, backend } from '@/lib/api/browser';
import { fromDateTimeInput, nowDateTimeInput } from '@/lib/dates';
import { formatKesExact } from '@/lib/format';
import {
  bookingHref,
  creditWarningOf,
  type CreditWarning,
  type LiveBooking,
  type LiveQuotation,
  type LiveQuotationStatus,
} from '@/lib/live-quotations';

const FORM_ID = 'quotation-status';

type Target = 'sent' | 'accepted' | 'declined';

/** Same transitions as the backend (`src/quotations/quotation-rules.ts`). */
const TRANSITIONS: Record<LiveQuotationStatus, Target[]> = {
  draft: ['sent'],
  sent: ['accepted', 'declined'],
  accepted: ['declined'],
  declined: [],
  expired: [],
};

const targetLabel: Record<Target, string> = {
  sent: 'Sent to customer (outside this system)',
  accepted: 'Accepted by customer',
  declined: 'Rejected by customer',
};

const alertClass = 'rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800';

/** Records a status change. "Sent" records what staff did outside the system; nothing is emailed. */
export function LiveQuotationStatusForm({ quotation }: { quotation: LiveQuotation }) {
  const router = useRouter();
  const targets = quotation.booking ? [] : TRANSITIONS[quotation.status];
  const [target, setTarget] = useState<Target | ''>(targets[0] ?? '');
  const [at, setAt] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (targets.length === 0 || !target) return null;
  const dateField = target === 'sent' ? 'sentAt' : 'decidedAt';

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFailure(undefined);
    const iso = at ? fromDateTimeInput(at) : undefined;
    const found: Record<string, string> = {};
    if (!at) found[dateField] = 'Enter when this happened.';
    else if (!iso) found[dateField] = 'Enter a valid date and time.';
    if (target === 'sent' && !sentTo.trim()) found.sentTo = 'Enter who it was sent to (name or email).';
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      await backend.post(`quotations/${encodeURIComponent(quotation.reference)}/status`, {
        status: target,
        ...(target === 'sent' ? { sentAt: iso, sentTo: sentTo.trim() } : { decidedAt: iso }),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        setFailure(error.message);
      } else {
        setFailure('The status could not be recorded. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {failure && (
        <p role="alert" className={alertClass}>
          {failure}
        </p>
      )}
      <SelectField
        id={`${FORM_ID}-status`}
        label="Record"
        required
        value={target}
        onChange={(v) => {
          setTarget(v as Target);
          setErrors({});
        }}
        error={errors.status}
        options={targets.map((t) => ({ value: t, label: targetLabel[t] }))}
      />
      <DateField
        id={`${FORM_ID}-${dateField}`}
        withTime
        required
        label={target === 'sent' ? 'When it was sent' : 'When the customer decided'}
        value={at}
        onChange={setAt}
        onNow={() => setAt(nowDateTimeInput())}
        error={errors[dateField]}
      />
      {target === 'sent' && (
        <TextField
          id={`${FORM_ID}-sentTo`}
          required
          label="Sent to"
          value={sentTo}
          onChange={setSentTo}
          maxLength={120}
          error={errors.sentTo}
          hint="Name or email address used."
        />
      )}
      <TextAreaField id={`${FORM_ID}-note`} label="Note for the history" value={note} onChange={setNote} rows={2} maxLength={300} error={errors.note} />
      {target === 'sent' && (
        <p className="text-xs text-slate-500">
          No email integration exists. Print or save the quotation as PDF and send it yourself, then record it here.
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? 'Saving…' : 'Record status'}
        </Button>
      </div>
    </form>
  );
}

/**
 * Converts an accepted quotation into its booking. When the booking would take the customer over
 * their credit limit, the backend answers with the figures; staff then proceed (only with
 * `credit.override`) or stop, giving a reason. Both decisions are recorded by the backend.
 */
export function ConvertToBooking({ quotation }: { quotation: LiveQuotation }) {
  const router = useRouter();
  const [warning, setWarning] = useState<CreditWarning>();
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const [stopped, setStopped] = useState(false);
  const [busy, setBusy] = useState(false);

  async function convert(decision?: 'proceed' | 'blocked') {
    setFailure(undefined);
    if (decision && !reason.trim()) {
      setReasonError('Give a reason for this decision.');
      return;
    }
    setReasonError(undefined);
    setBusy(true);
    try {
      const booking = await backend.post<LiveBooking>(
        `quotations/${encodeURIComponent(quotation.reference)}/convert`,
        decision ? { creditDecision: { decision, reason: reason.trim() } } : {},
      );
      router.push(bookingHref(booking.reference));
      router.refresh();
    } catch (error) {
      const found = error instanceof ApiError ? creditWarningOf(error.details) : undefined;
      if (found?.decision === 'blocked') {
        setStopped(true);
        setWarning(undefined);
      } else if (found) {
        setWarning(found);
      } else {
        setFailure(error instanceof ApiError ? error.message : 'The booking could not be created. Try again.');
      }
      setBusy(false);
    }
  }

  if (stopped) {
    return (
      <p role="status" className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        Not booked. Your decision to stop at the credit limit, and your reason, have been recorded.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {failure && (
        <p role="alert" className={alertClass}>
          {failure}
        </p>
      )}
      {!warning ? (
        <>
          <p className="text-sm text-slate-600">
            Creates a pending booking with this quotation&apos;s customer, agent, route and cargo. A quotation can be converted
            once.
          </p>
          <Button onClick={() => convert()} disabled={busy}>
            {busy ? 'Converting…' : 'Convert to booking'}
          </Button>
        </>
      ) : (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Over the credit limit</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            <dt>Outstanding balance</dt>
            <dd className="text-right tabular-nums">{formatKesExact(warning.exposure)}</dd>
            <dt>This booking</dt>
            <dd className="text-right tabular-nums">{formatKesExact(warning.attemptedAmount)}</dd>
            <dt className="font-semibold">Credit limit</dt>
            <dd className="text-right font-semibold tabular-nums">{formatKesExact(warning.creditLimit)}</dd>
          </dl>
          <TextAreaField
            id="credit-decision-reason"
            label="Reason for your decision"
            required
            value={reason}
            onChange={setReason}
            rows={2}
            maxLength={500}
            error={reasonError}
            hint="Recorded with your name and the time."
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => convert('blocked')} disabled={busy}>
              Stop, do not book
            </Button>
            {warning.canOverride ? (
              <Button size="sm" onClick={() => convert('proceed')} disabled={busy}>
                Proceed past the limit
              </Button>
            ) : (
              <p className="text-xs">Only finance, management and administrators can proceed past a credit limit.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
