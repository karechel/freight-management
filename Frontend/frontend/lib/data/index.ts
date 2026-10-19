// Data-access layer for the UI. Pages call these functions instead of using
// fetch() or the demo data directly.
//
// The backend has no freight endpoints yet (only GET /health), so every function
// returns demo data tagged `source: 'demo'`. When an endpoint is implemented,
// replace the body with a call through lib/api/client.ts and return
// `source: 'live'`. Expected contracts: docs/api-contracts.md.

import type {
  ActivityItem,
  Expense,
  Invoice,
  Party,
  PartyType,
  Payment,
  Quotation,
  Shipment,
  ShipmentDocument,
  Sourced,
  Task,
} from '@/lib/types';
import {
  demoActivity,
  demoDocuments,
  demoExpenses,
  demoInvoices,
  demoParties,
  demoPayments,
  demoQuotations,
  demoShipments,
  demoTasks,
} from './demo-data';

function demo<T>(data: T): Sourced<T> {
  return { data, source: 'demo' };
}

const byNewest = <T>(get: (item: T) => string) => (a: T, b: T) =>
  get(b).localeCompare(get(a));

export async function getShipments(): Promise<Sourced<Shipment[]>> {
  return demo([...demoShipments].sort(byNewest((s) => s.updatedAt)));
}

export async function getShipment(
  reference: string,
): Promise<Sourced<Shipment | undefined>> {
  return demo(demoShipments.find((s) => s.reference === reference));
}

export async function getDocuments(
  shipmentReference?: string,
): Promise<Sourced<ShipmentDocument[]>> {
  return demo(
    shipmentReference
      ? demoDocuments.filter((d) => d.shipmentReference === shipmentReference)
      : demoDocuments,
  );
}

export async function getQuotations(): Promise<Sourced<Quotation[]>> {
  return demo([...demoQuotations].sort(byNewest((q) => q.createdAt)));
}

// Party totals are derived from the demo shipments and invoices, so they agree
// with the figures shown on the shipment, dashboard and finance pages.
function withDemoTotals(party: (typeof demoParties)[number]): Party {
  const activeShipments = demoShipments.filter(
    (s) =>
      s.status !== 'delivered' &&
      (s.customerId === party.id || s.agentName === party.name || s.carrier === party.name),
  ).length;
  if (party.type !== 'customer') return { ...party, activeShipments };
  const outstandingKes = demoInvoices
    .filter((i) => i.customerName === party.name && i.status !== 'draft' && i.status !== 'paid')
    .reduce((sum, i) => sum + i.amountKes - i.paidKes, 0);
  return { ...party, activeShipments, outstandingKes };
}

export async function getParties(type?: PartyType): Promise<Sourced<Party[]>> {
  const parties = type ? demoParties.filter((p) => p.type === type) : demoParties;
  return demo(parties.map(withDemoTotals));
}

export async function getInvoices(
  shipmentReference?: string,
): Promise<Sourced<Invoice[]>> {
  const invoices = shipmentReference
    ? demoInvoices.filter((i) => i.shipmentReference === shipmentReference)
    : demoInvoices;
  return demo([...invoices].sort(byNewest((i) => i.issuedAt)));
}

export async function getPayments(): Promise<Sourced<Payment[]>> {
  return demo([...demoPayments].sort(byNewest((p) => p.receivedAt)));
}

export async function getExpenses(
  shipmentReference?: string,
): Promise<Sourced<Expense[]>> {
  return demo(
    shipmentReference
      ? demoExpenses.filter((e) => e.shipmentReference === shipmentReference)
      : demoExpenses,
  );
}

export async function getRecentActivity(): Promise<Sourced<ActivityItem[]>> {
  return demo([...demoActivity].sort(byNewest((a) => a.at)));
}

export async function getTasks(): Promise<Sourced<Task[]>> {
  return demo([...demoTasks].sort((a, b) => a.dueAt.localeCompare(b.dueAt)));
}

export { DEMO_REFERENCE_DATE } from './demo-data';
