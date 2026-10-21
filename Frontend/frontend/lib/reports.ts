// Report derivations for the reports and analytics page. Pure functions, no
// data imports, so safe in Client Components. All figures come from the
// records passed in (demo data plus edits made in this browser tab).

import { fromDateInput } from '@/lib/dates';
import { costingFor, type ShipmentCosting } from '@/lib/profitability';
import type {
  CostEstimate,
  CustomsStatus,
  Expense,
  Invoice,
  Quotation,
  Shipment,
  ShipmentStatus,
  TransportMode,
} from '@/lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Arrivals up to this long after the planned ETA count as on time. */
export const ON_TIME_GRACE_HOURS = 24;

export interface ReportFilters {
  /** `YYYY-MM-DD`, inclusive; applied to the planned ETA. Empty means no limit. */
  from: string;
  to: string;
  customerId: string;
  status: '' | ShipmentStatus;
  mode: '' | TransportMode;
}

export const emptyReportFilters: ReportFilters = { from: '', to: '', customerId: '', status: '', mode: '' };

export function filterShipments(shipments: Shipment[], f: ReportFilters): Shipment[] {
  const from = fromDateInput(f.from);
  const toStart = fromDateInput(f.to);
  const to = toStart ? new Date(toStart).getTime() + DAY_MS : undefined;
  return shipments.filter((s) => {
    const eta = new Date(s.eta).getTime();
    return (
      (!from || eta >= new Date(from).getTime()) &&
      (to === undefined || eta < to) &&
      (!f.customerId || s.customerId === f.customerId) &&
      (!f.status || s.status === f.status) &&
      (!f.mode || s.mode === f.mode)
    );
  });
}

/** `YYYY-MM` in Nairobi time. */
export const monthKey = (iso: string) => new Date(new Date(iso).getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 7);

export function countBy<T, K extends string>(items: T[], key: (item: T) => K): Partial<Record<K, number>> {
  const counts: Partial<Record<K, number>> = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return counts;
}

export interface ArrivalPerformance {
  measured: number;
  onTime: number;
  late: number;
  /** Percentage on time, one decimal; undefined when nothing has arrived. */
  onTimePercent?: number;
  /** Average lateness of late arrivals, in hours. */
  averageLateHours?: number;
  rows: { reference: string; customerName: string; mode: TransportMode; eta: string; ata: string; lateHours: number }[];
}

/** Actual arrival against the planned ETA, for shipments that have arrived. */
export function arrivalPerformance(shipments: Shipment[]): ArrivalPerformance {
  const rows = shipments
    .filter((s): s is Shipment & { ata: string } => Boolean(s.ata))
    .map((s) => ({
      reference: s.reference,
      customerName: s.customerName,
      mode: s.mode,
      eta: s.eta,
      ata: s.ata,
      lateHours: Math.round((new Date(s.ata).getTime() - new Date(s.eta).getTime()) / (60 * 60 * 1000)),
    }))
    .sort((a, b) => b.lateHours - a.lateHours);
  const late = rows.filter((r) => r.lateHours > ON_TIME_GRACE_HOURS);
  return {
    measured: rows.length,
    onTime: rows.length - late.length,
    late: late.length,
    onTimePercent: rows.length ? Math.round(((rows.length - late.length) / rows.length) * 1000) / 10 : undefined,
    averageLateHours: late.length ? Math.round(late.reduce((s, r) => s + r.lateHours, 0) / late.length) : undefined,
    rows,
  };
}

const CUSTOMS_ISSUE_STATUSES: CustomsStatus[] = ['query', 'documents_pending'];
const CUSTOMS_DELAY_REASONS = ['customs_query', 'missing_documents', 'permit_pending'];

export interface CustomsDelayRow {
  reference: string;
  customerName: string;
  customsStatus: CustomsStatus;
  /** Days from actual arrival to the reference date, when arrived and not yet released. */
  daysSinceArrival?: number;
  issues: string[];
}

/** Active shipments held up at customs: a query, missing documents, or an open customs-related delay. */
export function customsDelays(shipments: Shipment[], referenceDate: string): CustomsDelayRow[] {
  const ref = new Date(referenceDate).getTime();
  const customsRelatedDelays = (s: Shipment) =>
    s.delays.filter((d) => d.status !== 'resolved' && CUSTOMS_DELAY_REASONS.includes(d.reason));
  return shipments
    .filter((s) => s.status !== 'delivered')
    .filter((s) => CUSTOMS_ISSUE_STATUSES.includes(s.customs.status) || customsRelatedDelays(s).length > 0)
    .map((s) => ({
      reference: s.reference,
      customerName: s.customerName,
      customsStatus: s.customs.status,
      daysSinceArrival:
        s.ata && s.customs.status !== 'released' ? Math.max(0, Math.floor((ref - new Date(s.ata).getTime()) / DAY_MS)) : undefined,
      issues: [...s.exceptions.map((e) => e.message), ...customsRelatedDelays(s).map((d) => d.reasonDetail)],
    }))
    .sort((a, b) => (b.daysSinceArrival ?? -1) - (a.daysSinceArrival ?? -1));
}

export type AgingBucket = 'not_due' | 'd1_30' | 'd31_60' | 'd60_plus';

export const agingBucketLabel: Record<AgingBucket, string> = {
  not_due: 'Not yet due',
  d1_30: '1–30 days overdue',
  d31_60: '31–60 days overdue',
  d60_plus: 'Over 60 days overdue',
};

export interface OutstandingInvoiceRow {
  number: string;
  customerName: string;
  shipmentReference: string;
  balanceKes: number;
  dueAt: string;
  daysOverdue: number;
  bucket: AgingBucket;
}

/** Issued, part-paid and overdue invoices with a balance, aged against the reference date. */
export function outstandingInvoices(invoices: Invoice[], referenceDate: string): OutstandingInvoiceRow[] {
  const ref = new Date(referenceDate).getTime();
  return invoices
    .filter((i) => i.status !== 'draft' && i.status !== 'paid' && i.amountKes > i.paidKes)
    .map((i) => {
      const daysOverdue = Math.max(0, Math.floor((ref - new Date(i.dueAt).getTime()) / DAY_MS));
      const bucket: AgingBucket = daysOverdue === 0 ? 'not_due' : daysOverdue <= 30 ? 'd1_30' : daysOverdue <= 60 ? 'd31_60' : 'd60_plus';
      return {
        number: i.number,
        customerName: i.customerName,
        shipmentReference: i.shipmentReference,
        balanceKes: i.amountKes - i.paidKes,
        dueAt: i.dueAt,
        daysOverdue,
        bucket,
      };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}

export interface MonthlyMoney {
  month: string;
  invoicedKes: number;
  expensesKes: number;
}

/** Invoiced (excluding drafts) by issue month and expenses by incurred month. */
export function revenueAndExpensesByMonth(invoices: Invoice[], expenses: Expense[]): MonthlyMoney[] {
  const months = new Map<string, MonthlyMoney>();
  const row = (month: string) => {
    if (!months.has(month)) months.set(month, { month, invoicedKes: 0, expensesKes: 0 });
    return months.get(month) as MonthlyMoney;
  };
  for (const i of invoices) if (i.status !== 'draft') row(monthKey(i.issuedAt)).invoicedKes += i.amountKes;
  for (const e of expenses) row(monthKey(e.incurredAt)).expensesKes += e.amountKes;
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** Costing rows for the given shipments, most profitable (estimated) first. */
export function profitabilityRows(
  shipments: Shipment[],
  data: { invoices: Invoice[]; quotations: Quotation[]; estimates: CostEstimate[]; expenses: Expense[] },
): ShipmentCosting[] {
  return shipments
    .map((s) => costingFor(s, data))
    .filter((c) => c.estimatedProfitKes !== undefined || c.actualProfitKes !== undefined)
    .sort((a, b) => (b.estimatedProfitKes ?? b.actualProfitKes ?? 0) - (a.estimatedProfitKes ?? a.actualProfitKes ?? 0));
}

/**
 * CSV text (RFC 4180 quoting). Cells that a spreadsheet would treat as a
 * formula (starting with = + - @ or a tab/carriage return) are prefixed with
 * an apostrophe so opening the file cannot run anything.
 */
export function toCsv(rows: (string | number)[][]): string {
  const cell = (value: string | number) => {
    let text = String(value);
    if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return rows.map((r) => r.map(cell).join(',')).join('\r\n');
}
