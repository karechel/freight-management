// Data-access layer for the UI. Pages call these functions instead of using
// fetch() or the demo data directly.
//
// The backend has no freight endpoints yet (only GET /health), so every function
// returns demo data tagged `source: 'demo'`. When an endpoint is implemented,
// replace the body with a call through lib/api/client.ts and return
// `source: 'live'`. Expected contracts: docs/api-contracts.md.

import { routeLabel } from '@/lib/labels';
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
  demoAgentRoutes,
  demoBilling,
  DEMO_QUOTATION_TERMS,
  demoDocuments,
  demoExpenses,
  demoInvoices,
  demoParties,
  demoPayments,
  demoQuotations,
  demoShipments,
  demoStaff,
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
  return demo([...demoQuotations].sort(byNewest((q) => q.issuedAt)));
}

// Party totals are derived from the demo shipments and invoices, so they agree
// with the figures shown on the shipment, dashboard and finance pages.
function withDemoTotals(party: (typeof demoParties)[number]): Party {
  const activeShipments = demoShipments.filter(
    (s) =>
      s.status !== 'delivered' &&
      (s.customerId === party.id || s.agentName === party.name || s.carrier === party.name),
  ).length;
  if (party.type === 'agent') return { ...party, activeShipments, routes: demoAgentRoutes[party.id] ?? [] };
  if (party.type !== 'customer') return { ...party, activeShipments };
  const outstandingKes = demoInvoices
    .filter((i) => i.customerName === party.name && i.status !== 'draft' && i.status !== 'paid')
    .reduce((sum, i) => sum + i.amountKes - i.paidKes, 0);
  return { ...party, activeShipments, outstandingKes, billing: demoBilling[party.id] };
}

export async function getParties(type?: PartyType): Promise<Sourced<Party[]>> {
  const parties = type ? demoParties.filter((p) => p.type === type) : demoParties;
  return demo(parties.map(withDemoTotals));
}

export async function getParty(id: string): Promise<Sourced<Party | undefined>> {
  const party = demoParties.find((p) => p.id === id);
  return demo(party ? withDemoTotals(party) : undefined);
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

/** Staff who can be assigned to shipments and delay follow-ups. */
export async function getStaff(): Promise<Sourced<string[]>> {
  return demo([...demoStaff]);
}

export { DEMO_REFERENCE_DATE } from './demo-data';

export interface ShipmentFormOptions {
  customers: { id: string; name: string }[];
  agents: string[];
  staff: string[];
  /** Suggestions for the free-text carrier field. */
  carriers: string[];
  /** Routes per agent name, for the optional agent-route field. */
  agentRoutes: Record<string, { id: string; label: string }[]>;
  /** Party id per agent name, for links to the agent page. */
  agentIds: Record<string, string>;
}

/** Choices for the shipment, delay and quotation forms. */
export async function getShipmentFormOptions(): Promise<Sourced<ShipmentFormOptions>> {
  const parties = demoParties;
  return demo({
    customers: parties.filter((p) => p.type === 'customer').map((p) => ({ id: p.id, name: p.name })),
    agents: parties.filter((p) => p.type === 'agent').map((p) => p.name),
    staff: [...demoStaff],
    carriers: [
      ...parties.filter((p) => p.type === 'supplier' || p.type === 'transporter').map((p) => p.name),
      // Carriers that appear on demo shipments without a party record.
      ...new Set(demoShipments.map((s) => s.carrier).filter((c) => !parties.some((p) => p.name === c))),
    ],
    agentIds: Object.fromEntries(parties.filter((p) => p.type === 'agent').map((p) => [p.name, p.id])),
    agentRoutes: Object.fromEntries(
      parties
        .filter((p) => p.type === 'agent')
        .map((p) => [p.name, (demoAgentRoutes[p.id] ?? []).map((r) => ({ id: r.id, label: routeLabel(r) }))]),
    ),
  });
}

/** Choices for the quotation form. */
export async function getQuotationFormOptions(): Promise<
  Sourced<{ customers: { id: string; name: string }[]; agents: string[]; defaultTerms: string }>
> {
  return demo({
    customers: demoParties.filter((p) => p.type === 'customer').map((p) => ({ id: p.id, name: p.name })),
    agents: demoParties.filter((p) => p.type === 'agent').map((p) => p.name),
    defaultTerms: DEMO_QUOTATION_TERMS,
  });
}
