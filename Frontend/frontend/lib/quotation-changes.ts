// Pure operations producing updated quotation records and their history.
// Used by the session store; with a real backend these rules belong on the server.

import { isBefore } from '@/lib/dates';
import { formatDate, formatDateTime } from '@/lib/format';
import { quotationStatusMeta } from '@/lib/labels';
import { formatMoney } from '@/lib/money';
import type { QuotationInput } from '@/lib/quotation-form';
import { effectiveQuotationStatus, nextQuotationReference, quotationTotals, quotationTransitions } from '@/lib/quotations';
import { newId, type ChangeContext } from '@/lib/shipment-changes';
import type { Quotation, QuotationEvent, QuotationEventKind, QuotationStatus } from '@/lib/types';

function event(kind: QuotationEventKind, message: string, ctx: ChangeContext): QuotationEvent {
  return { id: newId('qe'), at: ctx.now, actor: ctx.actor, kind, message };
}

const totalText = (q: Pick<Quotation, 'lines' | 'currency'>) => formatMoney(quotationTotals(q.lines).totalMinor, q.currency);

export function createQuotation(
  input: QuotationInput,
  existing: Quotation[],
  ctx: ChangeContext,
  duplicatedFrom?: string,
): Quotation {
  const reference = nextQuotationReference(existing, ctx.now);
  const message = duplicatedFrom
    ? `Draft created as a copy of ${duplicatedFrom} (total ${totalText(input)}).`
    : `Draft created (total ${totalText(input)}).`;
  return {
    ...input,
    reference,
    status: 'draft',
    duplicatedFrom,
    events: [event(duplicatedFrom ? 'duplicated' : 'created', message, ctx)],
    updatedAt: ctx.now,
  };
}

/** Only drafts can be edited; sent quotations are changed by duplicating them. */
export const canEditQuotation = (q: Quotation, referenceDate: string) => effectiveQuotationStatus(q, referenceDate) === 'draft';

export function applyQuotationUpdate(q: Quotation, input: QuotationInput, ctx: ChangeContext): Quotation {
  const before = JSON.stringify({ ...q, events: undefined, updatedAt: undefined, status: undefined });
  const merged: Quotation = { ...q, ...input };
  if (JSON.stringify({ ...merged, events: undefined, updatedAt: undefined, status: undefined }) === before) return q;
  const changes: string[] = [];
  if (totalText(q) !== totalText(merged)) changes.push(`total changed from ${totalText(q)} to ${totalText(merged)}`);
  if (q.validUntil !== merged.validUntil) changes.push(`valid until ${formatDate(merged.validUntil)}`);
  if (q.customerId !== merged.customerId) changes.push(`customer changed to ${merged.customerName}`);
  const message = changes.length ? `Draft updated: ${changes.join('; ')}.` : 'Draft details updated.';
  return { ...merged, events: [...q.events, event('updated', message, ctx)], updatedAt: ctx.now };
}

export interface StatusChange {
  status: QuotationStatus;
  /** For "sent": when, and to whom, staff sent it outside the system. */
  sentAt?: string;
  sentTo?: string;
  /** For accepted / declined: when the customer decided. */
  decidedAt?: string;
  note?: string;
}

export type StatusChangeField = 'status' | 'sentAt' | 'sentTo' | 'decidedAt' | 'note';

export function validateQuotationStatusChange(
  q: Quotation,
  change: StatusChange,
  referenceDate: string,
  now: string,
): Partial<Record<StatusChangeField, string>> {
  const errors: Partial<Record<StatusChangeField, string>> = {};
  const current = effectiveQuotationStatus(q, referenceDate);
  if (!quotationTransitions[current].includes(change.status)) {
    errors.status =
      current === 'expired'
        ? 'This quotation has expired. Duplicate it as a new draft to quote again.'
        : `A quotation that is "${quotationStatusMeta[current].label}" cannot be changed to "${quotationStatusMeta[change.status].label}".`;
    return errors;
  }
  const checkDate = (field: 'sentAt' | 'decidedAt', label: string, notBefore?: { at: string; label: string }) => {
    const at = change[field];
    if (!at) errors[field] = `Enter when the quotation was ${label}.`;
    else if (isBefore(now, at)) errors[field] = 'This date cannot be in the future.';
    else if (isBefore(at, q.issuedAt)) errors[field] = `Cannot be before the issue date (${formatDate(q.issuedAt)}).`;
    else if (notBefore && isBefore(at, notBefore.at)) errors[field] = `Cannot be before it was ${notBefore.label} (${formatDateTime(notBefore.at)}).`;
  };
  if (change.status === 'sent') {
    checkDate('sentAt', 'sent');
    if (!change.sentTo?.trim()) errors.sentTo = 'Enter who it was sent to (name or email).';
    else if (change.sentTo.trim().length > 120) errors.sentTo = 'Use 120 characters or fewer.';
  } else {
    checkDate('decidedAt', change.status === 'accepted' ? 'accepted' : 'rejected', q.sentAt ? { at: q.sentAt, label: 'sent' } : undefined);
  }
  if ((change.note ?? '').length > 300) errors.note = 'Use 300 characters or fewer.';
  return errors;
}

export function applyQuotationStatusChange(q: Quotation, change: StatusChange, ctx: ChangeContext): Quotation {
  const label = quotationStatusMeta[change.status].label;
  const note = change.note?.trim() ? ` Note: ${change.note.trim()}` : '';
  const detail =
    change.status === 'sent' && change.sentAt
      ? `Recorded as sent to ${change.sentTo?.trim()} on ${formatDateTime(change.sentAt)} (sent outside this system).`
      : change.decidedAt
        ? `Marked "${label}" (customer decision on ${formatDateTime(change.decidedAt)}).`
        : `Marked "${label}".`;
  return {
    ...q,
    status: change.status,
    ...(change.status === 'sent' ? { sentAt: change.sentAt, sentTo: change.sentTo?.trim() } : { decidedAt: change.decidedAt }),
    events: [...q.events, event('status_changed', detail + note, ctx)],
    updatedAt: ctx.now,
  };
}

/** Links an accepted quotation to a shipment and marks it booked. */
export function linkQuotationToShipment(q: Quotation, shipmentReference: string, ctx: ChangeContext, created: boolean): Quotation {
  if (q.status !== 'accepted') return q;
  return {
    ...q,
    status: 'booked',
    shipmentReference,
    events: [
      ...q.events,
      event('linked', created ? `Converted to new shipment ${shipmentReference}.` : `Linked to existing shipment ${shipmentReference}.`, ctx),
    ],
    updatedAt: ctx.now,
  };
}
