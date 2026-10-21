// Notifications derived from the current records. Pure functions, no data
// imports, so safe in Client Components.
//
// Nothing here is sent anywhere and nothing is stored: each notification is
// recalculated from shipments, documents, quotations and invoices against the
// reference date, so it disappears once its cause is resolved (for example
// when a missing document is uploaded). With a backend, the same rules should
// run on the server and feed email, SMS or in-app delivery (docs/api-contracts.md).

import { formatDate, formatDateTime, formatKes } from '@/lib/format';
import { delayReasonLabel, documentStatusMeta, documentTypeLabel } from '@/lib/labels';
import { currentEta, invoiceBalance, isActive, isArrivingSoon, unresolvedDelays } from '@/lib/metrics';
import { effectiveQuotationStatus, quotationTotals } from '@/lib/quotations';
import { formatMoney } from '@/lib/money';
import type { Invoice, Quotation, Severity, Shipment, ShipmentDocument } from '@/lib/types';

export type NotificationKind =
  | 'arrival'
  | 'delay'
  | 'document_missing'
  | 'document_expiring'
  | 'quotation_pending'
  | 'invoice_overdue';

export const notificationKindLabel: Record<NotificationKind, string> = {
  arrival: 'Upcoming arrival',
  delay: 'Delayed shipment',
  document_missing: 'Missing document',
  document_expiring: 'Expiring document',
  quotation_pending: 'Pending quotation',
  invoice_overdue: 'Overdue invoice',
};

export const notificationKinds = Object.keys(notificationKindLabel) as NotificationKind[];

/** Links to the record a notification or task concerns. */
export interface RecordLinks {
  shipmentReference?: string;
  quotationReference?: string;
  documentId?: string;
  invoiceNumber?: string;
}

export interface AppNotification {
  /** Stable for the same cause, so read state survives recalculation. */
  id: string;
  kind: NotificationKind;
  severity: Severity;
  title: string;
  detail: string;
  /** The date the notification is about (arrival, expiry, due date…), for sorting. */
  at: string;
  /** Main link: the record to open. */
  href: string;
  links: RecordLinks;
  /** Suggested title when a task is created from this notification. */
  taskTitle: string;
}

/** Days ahead that count as "upcoming" or "expiring soon". */
export const ARRIVAL_WINDOW_DAYS = 7;
export const DOCUMENT_EXPIRY_WINDOW_DAYS = 14;
export const QUOTATION_EXPIRY_WINDOW_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;
const severityRank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
const enc = encodeURIComponent;

export const shipmentHref = (ref: string) => `/shipments/${enc(ref)}`;
export const quotationHref = (ref: string) => `/quotations/${enc(ref)}`;
export const invoiceHref = (number: string) => `/finance#${enc(number)}`;
/** Document rows carry `id="doc-<id>"` on the documents page. */
export const documentHref = (id: string) => `/documents#doc-${enc(id)}`;

const daysUntil = (iso: string, ref: string) => Math.floor((new Date(iso).getTime() - new Date(ref).getTime()) / DAY_MS);

export function buildNotifications(input: {
  shipments: Shipment[];
  documents: ShipmentDocument[];
  quotations: Quotation[];
  invoices: Invoice[];
  referenceDate: string;
}): AppNotification[] {
  const { shipments, documents, quotations, invoices, referenceDate: ref } = input;
  const active = new Map(shipments.filter(isActive).map((s) => [s.reference, s]));
  // Documents are urgent once the cargo is at destination and waiting on clearance.
  const atDestination = (ref: string) => ['arrived', 'customs', 'on_hold'].includes(active.get(ref)?.status ?? '');
  const out: AppNotification[] = [];

  for (const s of shipments) {
    if (isArrivingSoon(s, ref, ARRIVAL_WINDOW_DAYS)) {
      const eta = currentEta(s);
      out.push({
        id: `arrival:${s.reference}`,
        kind: 'arrival',
        severity: 'low',
        title: `${s.reference} arriving ${formatDate(eta.at)}`,
        detail: `${s.customerName} · ${s.origin} → ${s.destination}${eta.revised ? ' · revised ETA' : ''}. Prepare documents and clearance.`,
        at: eta.at,
        href: shipmentHref(s.reference),
        links: { shipmentReference: s.reference },
        taskTitle: `Prepare clearance for ${s.reference} arrival`,
      });
    }
    if (!isActive(s)) continue;
    for (const d of unresolvedDelays(s)) {
      out.push({
        id: `delay:${s.reference}:${d.id}`,
        kind: 'delay',
        severity: d.severity,
        title: `${s.reference} delayed: ${delayReasonLabel[d.reason]}`,
        detail: `${d.reasonDetail}${d.nextAction ? ` Next action: ${d.nextAction}` : ''}`,
        at: d.identifiedAt,
        href: shipmentHref(s.reference),
        links: { shipmentReference: s.reference },
        taskTitle: `Follow up delay on ${s.reference}`,
      });
    }
  }

  for (const d of documents) {
    if (!active.has(d.shipmentReference)) continue;
    const type = documentTypeLabel[d.type];
    if (d.status === 'missing' || d.status === 'rejected') {
      out.push({
        id: `document:${d.id}:${d.status}`,
        kind: 'document_missing',
        severity: atDestination(d.shipmentReference) ? 'high' : 'medium',
        title: `${type} ${d.status === 'missing' ? 'missing' : 'rejected'} for ${d.shipmentReference}`,
        detail: `${d.customerName}${d.note ? ` · ${d.note}` : ''}`,
        at: d.reviewedAt ?? d.receivedAt ?? ref,
        href: documentHref(d.id),
        links: { shipmentReference: d.shipmentReference, documentId: d.id },
        taskTitle: `Obtain ${type.toLowerCase()} for ${d.shipmentReference}`,
      });
    }
    if (d.expiresAt && (d.status === 'received' || d.status === 'verified')) {
      const days = daysUntil(d.expiresAt, ref);
      if (days <= DOCUMENT_EXPIRY_WINDOW_DAYS) {
        out.push({
          id: `expiry:${d.id}:${d.expiresAt}`,
          kind: 'document_expiring',
          severity: days <= 3 ? 'high' : 'medium',
          title: `${type} for ${d.shipmentReference} ${days < 0 ? 'expired' : 'expires'} ${formatDate(d.expiresAt)}`,
          detail: `${d.customerName} · ${documentStatusMeta[d.status].label}. ${days < 0 ? 'Renew or replace it before clearance.' : `${days === 0 ? 'Expires today' : `${days} day${days === 1 ? '' : 's'} left`}.`}`,
          at: d.expiresAt,
          href: documentHref(d.id),
          links: { shipmentReference: d.shipmentReference, documentId: d.id },
          taskTitle: `Renew ${type.toLowerCase()} for ${d.shipmentReference}`,
        });
      }
    }
  }

  for (const q of quotations) {
    const status = effectiveQuotationStatus(q, ref);
    const total = formatMoney(quotationTotals(q.lines).totalMinor, q.currency);
    if (status === 'sent') {
      const days = daysUntil(q.validUntil, ref);
      out.push({
        id: `quotation:${q.reference}:sent`,
        kind: 'quotation_pending',
        severity: days <= QUOTATION_EXPIRY_WINDOW_DAYS ? 'medium' : 'low',
        title: `${q.reference} awaiting ${q.customerName}'s decision`,
        detail: `${total} · valid until ${formatDate(q.validUntil)}${q.sentAt ? ` · sent ${formatDateTime(q.sentAt)}` : ''}.`,
        at: q.validUntil,
        href: quotationHref(q.reference),
        links: { quotationReference: q.reference },
        taskTitle: `Ask ${q.customerName} for a decision on ${q.reference}`,
      });
    } else if (status === 'accepted' && !q.shipmentReference) {
      out.push({
        id: `quotation:${q.reference}:accepted`,
        kind: 'quotation_pending',
        severity: 'medium',
        title: `${q.reference} accepted but not booked`,
        detail: `${q.customerName} · ${total}. Create or link the shipment.`,
        at: q.decidedAt ?? q.updatedAt,
        href: quotationHref(q.reference),
        links: { quotationReference: q.reference },
        taskTitle: `Book shipment for ${q.reference}`,
      });
    } else if (status === 'draft') {
      out.push({
        id: `quotation:${q.reference}:draft`,
        kind: 'quotation_pending',
        severity: 'low',
        title: `${q.reference} is a draft not yet sent`,
        detail: `${q.customerName} · ${total} · valid until ${formatDate(q.validUntil)}.`,
        at: q.issuedAt,
        href: quotationHref(q.reference),
        links: { quotationReference: q.reference },
        taskTitle: `Finalise and send ${q.reference}`,
      });
    }
  }

  for (const i of invoices) {
    if (i.status === 'draft' || i.status === 'paid' || invoiceBalance(i) <= 0) continue;
    // Same count as the reports page (whole days past the due date).
    const days = Math.floor((new Date(ref).getTime() - new Date(i.dueAt).getTime()) / DAY_MS);
    if (days <= 0) continue;
    out.push({
      id: `invoice:${i.number}`,
      kind: 'invoice_overdue',
      severity: days > 30 ? 'high' : 'medium',
      title: `${i.number} overdue by ${days} day${days === 1 ? '' : 's'}`,
      detail: `${i.customerName} · balance ${formatKes(invoiceBalance(i))} · due ${formatDate(i.dueAt)}.`,
      at: i.dueAt,
      href: invoiceHref(i.number),
      links: { invoiceNumber: i.number, shipmentReference: i.shipmentReference },
      taskTitle: `Follow up overdue invoice ${i.number}`,
    });
  }

  return out.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.at.localeCompare(b.at));
}

/** Query string for "create task from this notification". */
export function taskPrefillQuery(n: Pick<AppNotification, 'links' | 'taskTitle'>): string {
  const params = new URLSearchParams({ title: n.taskTitle });
  if (n.links.shipmentReference) params.set('shipment', n.links.shipmentReference);
  if (n.links.quotationReference) params.set('quotation', n.links.quotationReference);
  if (n.links.documentId) params.set('document', n.links.documentId);
  if (n.links.invoiceNumber) params.set('invoice', n.links.invoiceNumber);
  return params.toString();
}
