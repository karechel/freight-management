'use client';

import { useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { DateField, SelectField, TextAreaField, TextField } from '@/components/ui/form';
import { useSessionStore } from '@/lib/data/session-store';
import { fromDateTimeInput, nowDateTimeInput, nowIso } from '@/lib/dates';
import { quotationStatusMeta } from '@/lib/labels';
import {
  applyQuotationStatusChange,
  linkQuotationToShipment,
  validateQuotationStatusChange,
  type StatusChangeField,
} from '@/lib/quotation-changes';
import { quotationTransitions } from '@/lib/quotations';
import type { Quotation, QuotationStatus } from '@/lib/types';
import { quotationHref } from './quotation-list';

const FORM_ID = 'quotation-status';

/** Record a status change. "Sent" records what staff did outside the system; nothing is emailed. */
export function QuotationStatusForm({
  quotation,
  status,
  referenceDate,
  suggestedRecipient,
}: {
  quotation: Quotation;
  /** Effective status (expiry applied). */
  status: QuotationStatus;
  referenceDate: string;
  suggestedRecipient?: string;
}) {
  const store = useSessionStore();
  const targets = quotationTransitions[status];
  const [target, setTarget] = useState<QuotationStatus | ''>(targets[0] ?? '');
  const [at, setAt] = useState('');
  const [sentTo, setSentTo] = useState(suggestedRecipient ?? '');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Partial<Record<StatusChangeField, string>>>({});

  if (targets.length === 0) return null;

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!target) return;
    const iso = at ? fromDateTimeInput(at) : undefined;
    if (at && !iso) {
      setErrors({ [target === 'sent' ? 'sentAt' : 'decidedAt']: 'Enter a valid date and time.' });
      return;
    }
    const change = target === 'sent' ? { status: target, sentAt: iso, sentTo, note } : { status: target, decidedAt: iso, note };
    const found = validateQuotationStatusChange(quotation, change, referenceDate, nowIso());
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    store.updateQuotation(quotation.reference, (q, ctx) => applyQuotationStatusChange(q, change, ctx));
    // The parent remounts this form for the new status, so the confirmation is shown as a page notice.
    store.showNotice(`${quotation.reference} marked "${quotationStatusMeta[target].label}".`, quotationHref(quotation.reference));
  }

  const dateField = target === 'sent' ? 'sentAt' : 'decidedAt';
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <SelectField
        id={`${FORM_ID}-status`}
        label="Record"
        required
        value={target}
        onChange={(v) => {
          setTarget(v as QuotationStatus);
          setErrors({});
        }}
        error={errors.status}
        options={targets.map((t) => ({
          value: t,
          label: t === 'sent' ? 'Sent to customer (outside this system)' : t === 'declined' ? 'Rejected by customer' : 'Accepted by customer',
        }))}
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
          hint="Name or email address used. Prefilled from the billing contact."
        />
      )}
      <TextAreaField id={`${FORM_ID}-note`} label="Note for the history" value={note} onChange={setNote} rows={2} maxLength={300} error={errors.note} />
      {target === 'sent' && (
        <p className="text-xs text-slate-500">
          No email integration exists. Print or save the quotation as PDF and send it yourself, then record it here.
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm">
          Record status
        </Button>
      </div>
    </form>
  );
}

/** For an accepted quotation: convert to a new shipment, or link to an existing one for the same customer. */
export function QuotationBooking({ quotation }: { quotation: Quotation }) {
  const store = useSessionStore();
  const linkedElsewhere = new Set(store.quotations.map((q) => q.shipmentReference).filter(Boolean));
  const candidates = store.shipments.filter((s) => s.customerId === quotation.customerId && !linkedElsewhere.has(s.reference));
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | undefined>();

  function onLink(event: React.FormEvent) {
    event.preventDefault();
    if (!candidates.some((s) => s.reference === reference)) {
      setError('Select one of this customer’s shipments.');
      return;
    }
    setError(undefined);
    store.updateQuotation(quotation.reference, (q, ctx) => linkQuotationToShipment(q, reference, ctx, false));
    store.showNotice(`${quotation.reference} linked to ${reference} and marked booked.`, quotationHref(quotation.reference));
  }

  return (
    <div className="flex flex-col gap-4">
      <ButtonLink href={`/shipments/new?quotation=${encodeURIComponent(quotation.reference)}`}>Create shipment from quotation</ButtonLink>
      <form onSubmit={onLink} noValidate className="flex flex-col gap-3 border-t border-slate-200 pt-4">
        <SelectField
          id="quotation-link-shipment"
          label="Or link an existing shipment"
          value={reference}
          onChange={setReference}
          placeholder={candidates.length ? 'Select a shipment' : 'No unlinked shipments for this customer'}
          options={candidates.map((s) => ({ value: s.reference, label: `${s.reference} · ${s.origin} → ${s.destination}` }))}
          error={error}
        />
        <Button type="submit" variant="secondary" size="sm" disabled={candidates.length === 0}>
          Link shipment
        </Button>
      </form>
    </div>
  );
}
