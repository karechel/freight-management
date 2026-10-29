// Builds a customer's service history (account history) from the records that
// mention them. Pure function; only events with a recorded date are listed.

import { formatKes } from '@/lib/format';
import {
  delayReasonLabel,
  documentStatusMeta,
  documentTypeLabel,
  invoiceStatusMeta,
  paymentMethodLabel,
  quotationStatusMeta,
  shipmentStatusMeta,
  type StatusMeta,
} from '@/lib/labels';
import { formatMoney } from '@/lib/money';
import { effectiveQuotationStatus, quotationTotals } from '@/lib/quotations';
import type { Invoice, Payment, Quotation, Shipment, ShipmentDocument } from '@/lib/types';

export type HistoryKind = 'shipment' | 'quotation' | 'document' | 'invoice' | 'payment';

export interface HistoryEntry {
  id: string;
  at: string;
  kind: HistoryKind;
  title: string;
  detail?: string;
  href?: string;
  linkLabel?: string;
  status?: StatusMeta;
}

export const historyKindLabel: Record<HistoryKind, string> = {
  shipment: 'Shipment',
  quotation: 'Quotation',
  document: 'Document',
  invoice: 'Invoice',
  payment: 'Payment',
};

const shipmentHref = (ref: string) => `/shipments/${encodeURIComponent(ref)}`;
const quotationHref = (ref: string) => `/quotations/${encodeURIComponent(ref)}`;
export const invoiceHref = (number: string) => `/finance#${encodeURIComponent(number)}`;

export interface CustomerRecords {
  shipments: Shipment[];
  quotations: Quotation[];
  documents: ShipmentDocument[];
  invoices: Invoice[];
  payments: Payment[];
}

export function buildCustomerHistory(records: CustomerRecords, referenceDate: string): HistoryEntry[] {
  const entries: HistoryEntry[] = [];

  for (const s of records.shipments) {
    const link = { href: shipmentHref(s.reference), linkLabel: s.reference };
    const firstRecorded = s.milestones.find((m) => m.state === 'done' && m.at)?.at;
    const opened = s.createdAt ?? firstRecorded;
    if (opened) {
      entries.push({
        id: `${s.reference}-opened`,
        at: opened,
        kind: 'shipment',
        title: s.createdAt ? 'Shipment job opened' : 'Shipment job: first recorded milestone',
        detail: `${s.origin} → ${s.destination} · ${s.cargoDescription}`,
        status: shipmentStatusMeta[s.status],
        ...link,
      });
    }
    if (s.deliveredAt) {
      entries.push({ id: `${s.reference}-delivered`, at: s.deliveredAt, kind: 'shipment', title: 'Shipment delivered', ...link });
    }
    for (const d of s.delays) {
      entries.push({
        id: `${s.reference}-${d.id}`,
        at: d.identifiedAt,
        kind: 'shipment',
        title: `Delay recorded: ${delayReasonLabel[d.reason]}`,
        detail: d.reasonDetail,
        ...link,
      });
    }
    // Session changes (status, dates, milestones). Creation, delays and documents are covered elsewhere.
    for (const e of s.events) {
      if (e.kind === 'created' || e.kind === 'delay_recorded' || e.kind === 'document') continue;
      entries.push({ id: e.id, at: e.at, kind: 'shipment', title: e.message, detail: `By ${e.actor}`, ...link });
    }
  }

  for (const q of records.quotations) {
    const link = { href: quotationHref(q.reference), linkLabel: q.reference };
    const total = formatMoney(quotationTotals(q.lines).totalMinor, q.currency);
    entries.push({
      id: `${q.reference}-issued`,
      at: q.issuedAt,
      kind: 'quotation',
      title: 'Quotation issued',
      detail: `${q.origin} → ${q.destination} · ${total}`,
      status: quotationStatusMeta[effectiveQuotationStatus(q, referenceDate)],
      ...link,
    });
    if (q.sentAt) entries.push({ id: `${q.reference}-sent`, at: q.sentAt, kind: 'quotation', title: `Quotation sent to ${q.sentTo}`, ...link });
    if (q.decidedAt) {
      entries.push({
        id: `${q.reference}-decided`,
        at: q.decidedAt,
        kind: 'quotation',
        title: q.status === 'declined' ? 'Quotation rejected by customer' : 'Quotation accepted by customer',
        ...link,
      });
    }
    for (const e of q.events) {
      if (e.kind === 'linked') entries.push({ id: e.id, at: e.at, kind: 'quotation', title: e.message, ...link });
    }
  }

  for (const d of records.documents) {
    if (!d.receivedAt) continue;
    entries.push({
      id: d.id,
      at: d.receivedAt,
      kind: 'document',
      title: `${documentTypeLabel[d.type]} received`,
      detail: d.note,
      status: documentStatusMeta[d.status],
      href: shipmentHref(d.shipmentReference),
      linkLabel: d.shipmentReference,
    });
  }

  for (const i of records.invoices) {
    entries.push({
      id: i.number,
      at: i.issuedAt,
      kind: 'invoice',
      title: i.status === 'draft' ? `Invoice ${i.number} drafted` : `Invoice ${i.number} issued`,
      detail: `${formatKes(i.amountKes)} for ${i.shipmentReference}`,
      status: invoiceStatusMeta[i.status],
      href: invoiceHref(i.number),
      linkLabel: i.number,
    });
  }

  for (const p of records.payments) {
    entries.push({
      id: p.id,
      at: p.receivedAt,
      kind: 'payment',
      title: `Payment received: ${formatKes(p.amountKes)}`,
      detail: `${paymentMethodLabel[p.method]} · ${p.reference} · for ${p.invoiceNumber}${p.reconciled ? '' : ' · not reconciled'}`,
      href: records.invoices.some((i) => i.number === p.invoiceNumber) ? invoiceHref(p.invoiceNumber) : undefined,
      linkLabel: p.invoiceNumber,
    });
  }

  return entries.sort((a, b) => b.at.localeCompare(a.at));
}

export interface AccountSummary {
  invoicedKes: number;
  paidKes: number;
  outstandingKes: number;
  overdueKes: number;
  overdueCount: number;
  openCount: number;
}

/** Balances from issued (non-draft) invoices. Indicative only: not a ledger. */
export function accountSummary(invoices: Invoice[]): AccountSummary {
  const issued = invoices.filter((i) => i.status !== 'draft');
  const open = issued.filter((i) => i.status !== 'paid');
  const overdue = open.filter((i) => i.status === 'overdue');
  return {
    invoicedKes: issued.reduce((s, i) => s + i.amountKes, 0),
    paidKes: issued.reduce((s, i) => s + i.paidKes, 0),
    outstandingKes: open.reduce((s, i) => s + i.amountKes - i.paidKes, 0),
    overdueKes: overdue.reduce((s, i) => s + i.amountKes - i.paidKes, 0),
    overdueCount: overdue.length,
    openCount: open.length,
  };
}
