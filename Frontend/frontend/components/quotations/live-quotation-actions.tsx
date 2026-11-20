'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { CreditWarningPanel } from './credit-warning-panel';
import { DateField, SelectField, TextAreaField, TextField } from '@/components/ui/form';
import { ApiError, backend } from '@/lib/api/browser';
import { fromDateTimeInput, nowDateTimeInput } from '@/lib/dates';
import {
  bookingHref,
  creditWarningOf,
  type CreditWarning,
  type LiveBooking,
  type LiveQuotation,
  type LiveQuotationStatus,
  type PartyRef,
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
export function ConvertToBooking({ quotation, carriers = [] }: { quotation: LiveQuotation; carriers?: PartyRef[] }) {
  const router = useRouter();
  const [warning, setWarning] = useState<CreditWarning>();
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const [stopped, setStopped] = useState(false);
  const [busy, setBusy] = useState(false);
  // Optional booking details, sent with the conversion (POST /api/quotations/:reference/convert).
  const [carrierId, setCarrierId] = useState('');
  const [carrierBookingNumber, setCarrierBookingNumber] = useState('');
  const [plannedEtd, setPlannedEtd] = useState('');
  const [plannedEta, setPlannedEta] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  /** Updates a field and clears its error, so a corrected value no longer shows the old message. */
  const change = (field: string, set: (value: string) => void) => (value: string) => {
    set(value);
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  /** The optional details as request fields, or field errors when a date is not valid. */
  function details(): { body?: Record<string, string | number>; errors: Record<string, string> } {
    const errors: Record<string, string> = {};
    const etd = plannedEtd ? fromDateTimeInput(plannedEtd) : undefined;
    const eta = plannedEta ? fromDateTimeInput(plannedEta) : undefined;
    if (plannedEtd && !etd) errors.plannedEtd = 'Enter a valid date and time.';
    if (plannedEta && !eta) errors.plannedEta = 'Enter a valid date and time.';
    if (etd && eta && new Date(eta).getTime() < new Date(etd).getTime()) {
      errors.plannedEta = 'The planned arrival cannot be before the planned departure.';
    }
    if (Object.keys(errors).length > 0) return { errors };
    return {
      errors,
      body: {
        ...(carrierId ? { carrierId: Number(carrierId) } : {}),
        ...(carrierBookingNumber.trim() ? { carrierBookingNumber: carrierBookingNumber.trim() } : {}),
        ...(etd ? { plannedEtd: etd } : {}),
        ...(eta ? { plannedEta: eta } : {}),
      },
    };
  }

  async function convert(decision?: 'proceed' | 'blocked' | 'request_approval') {
    setFailure(undefined);
    const { body, errors } = details();
    setFieldErrors(errors);
    if (!body) {
      setWarning(undefined);
      return;
    }
    if (decision && !reason.trim()) {
      setReasonError('Give a reason for this decision.');
      return;
    }
    setReasonError(undefined);
    setBusy(true);
    try {
      const booking = await backend.post<LiveBooking>(
        `quotations/${encodeURIComponent(quotation.reference)}/convert`,
        decision ? { ...body, creditDecision: { decision, reason: reason.trim() } } : body,
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
        if (error instanceof ApiError) setFieldErrors(error.fieldErrors);
        setWarning(undefined);
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
            once. The details below are optional and cannot be changed after conversion.
          </p>
          <SelectField
            id="convert-carrierId"
            label="Carrier"
            value={carrierId}
            onChange={change('carrierId', setCarrierId)}
            placeholder={carriers.length ? 'Not recorded' : 'No carriers recorded'}
            options={carriers.map((c) => ({ value: String(c.id), label: c.name }))}
            error={fieldErrors.carrierId}
          />
          <TextField
            id="convert-carrierBookingNumber"
            label="Carrier booking number"
            value={carrierBookingNumber}
            onChange={change('carrierBookingNumber', setCarrierBookingNumber)}
            maxLength={60}
            error={fieldErrors.carrierBookingNumber}
          />
          <DateField
            id="convert-plannedEtd"
            withTime
            label="Planned departure"
            value={plannedEtd}
            onChange={change('plannedEtd', setPlannedEtd)}
            error={fieldErrors.plannedEtd}
            hint="Nairobi time."
          />
          <DateField
            id="convert-plannedEta"
            withTime
            label="Planned arrival"
            value={plannedEta}
            onChange={change('plannedEta', setPlannedEta)}
            error={fieldErrors.plannedEta}
            hint="Nairobi time."
          />
          <Button onClick={() => convert()} disabled={busy}>
            {busy ? 'Converting…' : 'Convert to booking'}
          </Button>
        </>
      ) : (
        <CreditWarningPanel
          warning={warning}
          reason={reason}
          onReasonChange={setReason}
          reasonError={reasonError}
          busy={busy}
          onChoose={(choice) => convert(choice)}
        />
      )}
    </div>
  );
}
