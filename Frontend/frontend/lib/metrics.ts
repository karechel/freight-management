// Pure helpers that derive dashboard figures and list views from records.
// No data imports here, so these are safe to use in Client Components.

import type { DocumentStatus, Invoice, Shipment, ShipmentDelay, ShipmentDocument, ShipmentStatus } from '@/lib/types';

export type ShipmentView = 'all' | 'active' | 'attention' | 'delayed' | 'arriving' | 'customs';

export const shipmentViewLabel: Record<ShipmentView, string> = {
  all: 'All shipments',
  active: 'Active (not delivered)',
  attention: 'Needs attention',
  delayed: 'Delayed (open delays)',
  arriving: 'Arriving in 7 days',
  customs: 'In customs clearance',
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const isActive = (s: Shipment) => s.status !== 'delivered';

/** Delays that are still open or being monitored, newest first. */
export const unresolvedDelays = (s: Shipment): ShipmentDelay[] =>
  s.delays
    .filter((d) => d.status !== 'resolved')
    .sort((a, b) => b.identifiedAt.localeCompare(a.identifiedAt));

export const isDelayed = (s: Shipment) => isActive(s) && unresolvedDelays(s).length > 0;

/** Revised minus original expected date, in milliseconds; undefined until a revised date is recorded. */
export function delayDurationMs(d: ShipmentDelay): number | undefined {
  if (!d.revisedExpectedAt) return undefined;
  return new Date(d.revisedExpectedAt).getTime() - new Date(d.originalExpectedAt).getTime();
}

/**
 * The ETA to plan with: the revised date of the most recently identified delay
 * that affects the ETA (including resolved ones, whose revision still stands),
 * otherwise the planned ETA.
 */
export function currentEta(s: Shipment): { at: string; revised: boolean } {
  const revision = s.delays
    .filter((d) => d.affectsEta && d.revisedExpectedAt)
    .sort((a, b) => b.identifiedAt.localeCompare(a.identifiedAt))[0];
  return revision?.revisedExpectedAt ? { at: revision.revisedExpectedAt, revised: true } : { at: s.eta, revised: false };
}

export const needsAttention = (s: Shipment) =>
  isActive(s) &&
  (s.status === 'on_hold' || s.exceptions.length > 0 || s.customs.status === 'query' || isDelayed(s));

export const isInCustoms = (s: Shipment) =>
  isActive(s) && s.customs.status !== 'not_started' && s.customs.status !== 'released';

export function isArrivingSoon(s: Shipment, referenceDate: string, days = 7): boolean {
  if (s.status !== 'booked' && s.status !== 'in_transit') return false;
  const ref = new Date(referenceDate).getTime();
  const eta = new Date(currentEta(s).at).getTime();
  return eta >= ref - DAY_MS && eta <= ref + days * DAY_MS;
}

export function matchesView(s: Shipment, view: ShipmentView, referenceDate: string): boolean {
  switch (view) {
    case 'all':
      return true;
    case 'active':
      return isActive(s);
    case 'attention':
      return needsAttention(s);
    case 'delayed':
      return isDelayed(s);
    case 'arriving':
      return isArrivingSoon(s, referenceDate);
    case 'customs':
      return isInCustoms(s);
  }
}

export function countByStatus(shipments: Shipment[]): Record<ShipmentStatus, number> {
  const counts: Record<ShipmentStatus, number> = {
    booked: 0,
    in_transit: 0,
    arrived: 0,
    customs: 0,
    released: 0,
    out_for_delivery: 0,
    delivered: 0,
    on_hold: 0,
  };
  for (const s of shipments) counts[s.status] += 1;
  return counts;
}

export const outstandingDocuments = (docs: ShipmentDocument[]) =>
  docs.filter((d) => d.status === 'missing' || d.status === 'rejected');

export const invoiceBalance = (i: Invoice) => i.amountKes - i.paidKes;

export function receivablesSummary(invoices: Invoice[]) {
  const open = invoices.filter((i) => i.status !== 'draft' && i.status !== 'paid');
  const overdue = open.filter((i) => i.status === 'overdue');
  return {
    outstandingKes: open.reduce((sum, i) => sum + invoiceBalance(i), 0),
    openCount: open.length,
    overdueKes: overdue.reduce((sum, i) => sum + invoiceBalance(i), 0),
    overdueCount: overdue.length,
  };
}

export type DocumentFilter = 'all' | 'outstanding' | DocumentStatus | 'session_files';

export const documentFilterLabel: Record<DocumentFilter, string> = {
  all: 'All',
  outstanding: 'Outstanding',
  missing: 'Missing',
  rejected: 'Rejected',
  received: 'Received',
  verified: 'Verified',
  session_files: 'With file (this tab)',
};

export const documentFilters = Object.keys(documentFilterLabel) as DocumentFilter[];

export function matchesDocumentFilter(doc: ShipmentDocument, filter: DocumentFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'outstanding') return doc.status === 'missing' || doc.status === 'rejected';
  if (filter === 'session_files') return Boolean(doc.file);
  return doc.status === filter;
}
