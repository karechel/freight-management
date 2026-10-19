// Pure helpers that derive dashboard figures and list views from records.
// No data imports here, so these are safe to use in Client Components.

import type { Invoice, Shipment, ShipmentDocument, ShipmentStatus } from '@/lib/types';

export type ShipmentView = 'all' | 'active' | 'attention' | 'arriving' | 'customs';

export const shipmentViewLabel: Record<ShipmentView, string> = {
  all: 'All shipments',
  active: 'Active (not delivered)',
  attention: 'Needs attention',
  arriving: 'Arriving in 7 days',
  customs: 'In customs clearance',
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const isActive = (s: Shipment) => s.status !== 'delivered';

export const needsAttention = (s: Shipment) =>
  isActive(s) && (s.status === 'on_hold' || s.exceptions.length > 0 || s.customs.status === 'query');

export const isInCustoms = (s: Shipment) =>
  isActive(s) && s.customs.status !== 'not_started' && s.customs.status !== 'released';

export function isArrivingSoon(s: Shipment, referenceDate: string, days = 7): boolean {
  if (s.status !== 'booked' && s.status !== 'in_transit') return false;
  const ref = new Date(referenceDate).getTime();
  const eta = new Date(s.eta).getTime();
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
