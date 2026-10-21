// Shipment costing: estimated and actual costs against what the customer is
// charged. Pure functions, no data imports, so safe in Client Components.
//
// Definitions (also shown on the expenses page):
// - Customer charge, estimated: the linked KES quotation total; otherwise the
//   invoiced total including drafts.
// - Customer charge, invoiced: issued, part-paid, paid and overdue invoices.
// - Estimated cost: job-costing estimates. Actual cost: supplier expenses
//   recorded so far, in any status.
// - Estimated profit = estimated charge − estimated cost.
// - Actual profit to date = invoiced − actual cost. It is provisional until
//   the job is closed and every supplier charge is in.

import { quotationTotals } from '@/lib/quotations';
import type { CostEstimate, Expense, ExpenseCategory, Invoice, Quotation, Shipment } from '@/lib/types';

export interface ShipmentCosting {
  reference: string;
  customerId: string;
  customerName: string;
  shipment: Pick<Shipment, 'mode' | 'status'>;
  quotedKes?: number;
  invoicedKes: number;
  draftInvoicedKes: number;
  estimatedChargeKes?: number;
  estimatedCostKes?: number;
  actualCostKes: number;
  estimatedProfitKes?: number;
  /** Undefined until something has been invoiced. */
  actualProfitKes?: number;
  /** Actual cost minus estimated cost; positive means over the estimate. */
  costVarianceKes?: number;
  expenseCount: number;
}

const sum = (values: number[]) => values.reduce((total, v) => total + v, 0);

/** Profit as a percentage of the charge, rounded to one decimal; undefined when there is no charge. */
export function marginPercent(profitKes: number | undefined, chargeKes: number | undefined): number | undefined {
  if (profitKes === undefined || !chargeKes) return undefined;
  return Math.round((profitKes / chargeKes) * 1000) / 10;
}

/** Linked quotation total in KES (whole shillings), when the quotation is in KES. */
function quotedKes(reference: string, quotations: Quotation[]): number | undefined {
  const linked = quotations.filter((q) => q.shipmentReference === reference && q.currency === 'KES');
  if (linked.length === 0) return undefined;
  return Math.round(sum(linked.map((q) => quotationTotals(q.lines).totalMinor)) / 100);
}

export function costingFor(
  shipment: Shipment,
  data: { invoices: Invoice[]; quotations: Quotation[]; estimates: CostEstimate[]; expenses: Expense[] },
): ShipmentCosting {
  const ref = shipment.reference;
  const invoices = data.invoices.filter((i) => i.shipmentReference === ref);
  const invoicedKes = sum(invoices.filter((i) => i.status !== 'draft').map((i) => i.amountKes));
  const draftInvoicedKes = sum(invoices.filter((i) => i.status === 'draft').map((i) => i.amountKes));
  const estimates = data.estimates.filter((e) => e.shipmentReference === ref);
  const expenses = data.expenses.filter((e) => e.shipmentReference === ref);
  const quoted = quotedKes(ref, data.quotations);
  const estimatedChargeKes = quoted ?? (invoicedKes + draftInvoicedKes || undefined);
  const estimatedCostKes = estimates.length ? sum(estimates.map((e) => e.estimatedKes)) : undefined;
  const actualCostKes = sum(expenses.map((e) => e.amountKes));
  return {
    reference: ref,
    customerId: shipment.customerId,
    customerName: shipment.customerName,
    shipment: { mode: shipment.mode, status: shipment.status },
    quotedKes: quoted,
    invoicedKes,
    draftInvoicedKes,
    estimatedChargeKes,
    estimatedCostKes,
    actualCostKes,
    estimatedProfitKes:
      estimatedChargeKes !== undefined && estimatedCostKes !== undefined ? estimatedChargeKes - estimatedCostKes : undefined,
    actualProfitKes: invoicedKes > 0 ? invoicedKes - actualCostKes : undefined,
    costVarianceKes: estimatedCostKes !== undefined && expenses.length ? actualCostKes - estimatedCostKes : undefined,
    expenseCount: expenses.length,
  };
}

/** Costing for every shipment that has a charge, an estimate or an expense. */
export function shipmentCostings(
  shipments: Shipment[],
  data: { invoices: Invoice[]; quotations: Quotation[]; estimates: CostEstimate[]; expenses: Expense[] },
): ShipmentCosting[] {
  return shipments
    .map((s) => costingFor(s, data))
    .filter((c) => c.estimatedChargeKes !== undefined || c.estimatedCostKes !== undefined || c.expenseCount > 0);
}

export interface CostingTotals {
  estimatedChargeKes: number;
  invoicedKes: number;
  estimatedCostKes: number;
  actualCostKes: number;
  estimatedProfitKes: number;
  actualProfitKes: number;
}

/** Totals across rows; profit totals include only rows where that profit is known. */
export function costingTotals(rows: ShipmentCosting[]): CostingTotals {
  return {
    estimatedChargeKes: sum(rows.map((r) => r.estimatedChargeKes ?? 0)),
    invoicedKes: sum(rows.map((r) => r.invoicedKes)),
    estimatedCostKes: sum(rows.map((r) => r.estimatedCostKes ?? 0)),
    actualCostKes: sum(rows.map((r) => r.actualCostKes)),
    estimatedProfitKes: sum(rows.map((r) => r.estimatedProfitKes ?? 0)),
    actualProfitKes: sum(rows.map((r) => r.actualProfitKes ?? 0)),
  };
}

/** Estimated and actual cost per category for one shipment (or all, when no reference is given). */
export function costsByCategory(
  estimates: CostEstimate[],
  expenses: Expense[],
  reference?: string,
): { category: ExpenseCategory; estimatedKes: number; actualKes: number }[] {
  const order: ExpenseCategory[] = ['carrier', 'transport', 'handling', 'storage', 'customs', 'agent_fees', 'other'];
  const match = (r: string) => reference === undefined || r === reference;
  return order
    .map((category) => ({
      category,
      estimatedKes: sum(estimates.filter((e) => e.category === category && match(e.shipmentReference)).map((e) => e.estimatedKes)),
      actualKes: sum(expenses.filter((e) => e.category === category && match(e.shipmentReference)).map((e) => e.amountKes)),
    }))
    .filter((row) => row.estimatedKes > 0 || row.actualKes > 0);
}
