// Live quotations and bookings from /api/quotations and /api/bookings (backend Phase 2).
// Money, quantities and rates are exact decimal text from the backend. They are only
// displayed here, never added up; the backend calculates every total.

import { quotationStatusMeta, type StatusMeta } from './labels';
import { minorToInput } from './money';
import type { QuotationInput } from './quotation-form';
import type { QuotationStatus, ShipmentDirection, ShipmentStatus, TransportMode } from './types';

export const QUOTATIONS_VIEW = 'quotations.view';
export const QUOTATIONS_MANAGE = 'quotations.manage';
export const CREDIT_OVERRIDE = 'credit.override';

export type LiveQuotationStatus = Exclude<QuotationStatus, 'booked'>;
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

/** Archived, on-hold and closed customers cannot receive new quotations or bookings (2026-11-26). */
export type CustomerNewWorkBlock = 'archived' | 'on_hold' | 'closed';

export const customerNewWorkBlockText: Record<CustomerNewWorkBlock, string> = {
  archived: 'This customer is archived. Restore the customer before creating new quotations or bookings for them.',
  on_hold:
    'This customer is on hold, so new quotations and bookings are blocked. Management or an administrator must make the account active first.',
  closed:
    "This customer's account is closed, so new quotations and bookings are blocked. Management or an administrator must make the account active first.",
};

export interface PartyRef {
  id: number;
  name: string;
}

export interface Totals {
  subtotal: string;
  tax: string;
  total: string;
}

export interface LiveQuotationLine {
  id: number;
  chargeTypeId: number | null;
  description: string;
  quantity: string;
  unitPrice: string;
  taxCategory: string;
  taxRate: string;
  sortOrder: number;
  amounts: { net: string; tax: string; total: string };
}

export interface LiveQuotation {
  id: number;
  reference: string;
  /** What staff see: `expired` is derived from the valid-until date. */
  status: LiveQuotationStatus;
  storedStatus: LiveQuotationStatus;
  editable: boolean;
  customer: PartyRef;
  /** Why the customer cannot receive new work (archived, on hold, closed), or null when they can. */
  customerNewWorkBlock: CustomerNewWorkBlock | null;
  agent: PartyRef | null;
  mode: TransportMode;
  direction: ShipmentDirection;
  origin: string;
  destination: string;
  incoterm: string | null;
  cargoSummary: string;
  packages: number | null;
  grossWeightKg: string | null;
  volumeCbm: string | null;
  terms: string | null;
  internalNote: string | null;
  currency: 'KES';
  issueDate: string;
  validUntil: string;
  sentAt: string | null;
  sentTo: string | null;
  decidedAt: string | null;
  duplicatedFrom: { id: number; reference: string } | null;
  preparedBy: PartyRef | null;
  booking: { id: number; reference: string; status: BookingStatus } | null;
  totals: Totals;
  /** Detail view only. */
  lines?: LiveQuotationLine[];
  createdAt: string;
  updatedAt: string;
}

export interface CreditCheckView {
  decision: 'proceed' | 'blocked';
  reason: string;
  exposure: string;
  creditLimit: string;
  attemptedAmount: string;
  decidedBy: PartyRef | null;
  decidedAt: string;
}

/**
 * Credit approval (2026-11-20): a booking created over the limit by someone without
 * `credit.override` waits for finance, management or an administrator to approve or reject it.
 * The money figures are present only for users who may view billing.
 */
export interface CreditApprovalView {
  state: 'awaiting' | 'approved' | 'rejected';
  requestedBy: PartyRef | null;
  requestedAt: string;
  reason: string;
  exposure?: string;
  creditLimit?: string;
  attemptedAmount?: string;
}

export const creditApprovalMeta = {
  awaiting: { label: 'Awaiting credit approval', tone: 'warning' },
  approved: { label: 'Credit approved', tone: 'success' },
  rejected: { label: 'Credit rejected', tone: 'danger' },
} as const;

export interface LiveBooking {
  id: number;
  reference: string;
  status: BookingStatus;
  quotation: { id: number; reference: string } | null;
  customer: PartyRef;
  agent: PartyRef | null;
  carrier: PartyRef | null;
  carrierBookingNumber: string | null;
  mode: TransportMode;
  direction: ShipmentDirection;
  origin: string;
  destination: string;
  cargoSummary: string;
  plannedEtd: string | null;
  plannedEta: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdBy: PartyRef | null;
  createdAt: string;
  updatedAt: string;
  /** Present only for users allowed to view billing. */
  creditChecks?: CreditCheckView[];
  /** Null unless approval was requested. */
  creditApproval: CreditApprovalView | null;
  /** Shipments made from this booking (Phase 3). */
  shipments: { reference: string; status: ShipmentStatus }[];
}

export interface ListPage<T> {
  items: T[];
  total: number;
}

/** The figures in a credit-limit warning (409, `details[0]`). */
export interface CreditWarning {
  field: 'creditDecision';
  messages: string[];
  exposure: string;
  creditLimit: string;
  attemptedAmount: string;
  canOverride?: boolean;
  decision?: 'blocked';
}

export function creditWarningOf(details: unknown[]): CreditWarning | undefined {
  const first = details[0] as Partial<CreditWarning> | undefined;
  return first?.field === 'creditDecision' && typeof first.attemptedAmount === 'string'
    ? (first as CreditWarning)
    : undefined;
}

export const bookingStatusMeta = {
  pending: { label: 'Pending', tone: 'info' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
} as const;

/**
 * The status badge for a quotation. "Booked" is shown while its booking stands; once the booking
 * is cancelled, that is shown instead. The quotation itself cannot be converted again (one booking
 * per quotation); what should happen next is a decision for the repository owner.
 */
export function quotationDisplayStatus(q: Pick<LiveQuotation, 'status' | 'booking'>): StatusMeta {
  if (!q.booking) return quotationStatusMeta[q.status];
  return q.booking.status === 'cancelled' ? { label: 'Booking cancelled', tone: 'neutral' } : quotationStatusMeta.booked;
}

export const PAGE_SIZE = 25;

const QUOTATION_STATUSES: readonly string[] = ['draft', 'sent', 'accepted', 'declined', 'expired'];
const BOOKING_STATUSES: readonly string[] = ['pending', 'confirmed', 'completed', 'cancelled'];

export interface ListFilters {
  q: string;
  status: string;
  page: number;
  /** Bookings only: show only those awaiting credit approval. */
  awaitingApproval?: boolean;
  /** Quotations only: one customer's quotations (from the customer page). */
  customerId?: number;
}

const single = (value: string | string[] | undefined) => (typeof value === 'string' ? value : '');

function parseFilters(params: Record<string, string | string[] | undefined>, statuses: readonly string[]): ListFilters {
  const status = single(params.status);
  const page = Number(single(params.page));
  return {
    q: single(params.q).trim().slice(0, 100),
    status: statuses.includes(status) ? status : '',
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1,
  };
}

export function parseQuotationFilters(params: Record<string, string | string[] | undefined>): ListFilters {
  const customerId = Number(single(params.customerId));
  const valid = /^[1-9]d{0,9}$/.test(single(params.customerId)) && customerId <= 2_147_483_647;
  return { ...parseFilters(params, QUOTATION_STATUSES), ...(valid ? { customerId } : {}) };
}
export function parseBookingFilters(params: Record<string, string | string[] | undefined>): ListFilters {
  const awaiting = single(params.creditApproval) === 'awaiting';
  return { ...parseFilters(params, BOOKING_STATUSES), ...(awaiting ? { awaitingApproval: true } : {}) };
}

/** The page URL's query string for these filters, leaving out defaults. */
export function listPageQuery(filters: ListFilters): string {
  const query = new URLSearchParams();
  if (filters.q) query.set('q', filters.q);
  if (filters.status) query.set('status', filters.status);
  if (filters.customerId) query.set('customerId', String(filters.customerId));
  if (filters.awaitingApproval) query.set('creditApproval', 'awaiting');
  if (filters.page > 1) query.set('page', String(filters.page));
  const text = query.toString();
  return text ? `?${text}` : '';
}

/** The backend's query string for these filters. */
export function listApiQuery(filters: ListFilters): string {
  const query = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String((filters.page - 1) * PAGE_SIZE) });
  if (filters.q) query.set('q', filters.q);
  if (filters.status) query.set('status', filters.status);
  if (filters.customerId) query.set('customerId', String(filters.customerId));
  if (filters.awaitingApproval) query.set('creditApproval', 'awaiting');
  return query.toString();
}

export const liveQuotationHref = (reference: string) => `/quotations/${encodeURIComponent(reference)}`;
export const bookingHref = (reference: string) => `/bookings/${encodeURIComponent(reference)}`;

/** Options for the live form: ids come from /api/parties. */
export interface LiveFormOptions {
  customers: PartyRef[];
  /** On-hold and closed customers left out of the list because new work for them is blocked. */
  blockedCustomers: number;
  agents: PartyRef[];
  defaultTerms: string;
}

/** Form values for the existing quotation form (`lib/quotation-form.ts`), filled from a live quotation. */
export function liveQuotationToForm(q: LiveQuotation, forDuplicate = false) {
  let key = 0;
  return {
    customerId: String(q.customer.id),
    agentName: q.agent?.name ?? '',
    mode: q.mode,
    direction: q.direction,
    origin: q.origin,
    destination: q.destination,
    cargoSummary: q.cargoSummary,
    currency: 'KES',
    issuedAt: forDuplicate ? '' : q.issueDate,
    validUntil: forDuplicate ? '' : q.validUntil,
    terms: q.terms ?? '',
    internalNote: q.internalNote ?? '',
    lines: (q.lines ?? []).map((line) => ({
      key: `live-${(key += 1)}`,
      description: line.description,
      // The backend sends fixed decimals ("1.000", "16.00"); show them without trailing zeros.
      quantity: trimDecimal(line.quantity),
      unitPrice: line.unitPrice,
      taxRatePercent: trimDecimal(line.taxRate),
    })),
  };
}

export function trimDecimal(value: string): string {
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value;
}

/**
 * The request body for POST/PATCH /api/quotations, from the validated form input.
 * Amounts go back to exact decimal text; nothing is calculated here.
 */
export function quotationRequestBody(input: QuotationInput, agents: PartyRef[]) {
  const agent = input.agentName ? agents.find((a) => a.name === input.agentName) : undefined;
  return {
    customerId: Number(input.customerId),
    agentId: agent ? agent.id : null,
    mode: input.mode,
    direction: input.direction,
    origin: input.origin,
    destination: input.destination,
    cargoSummary: input.cargoSummary,
    // The form produces Nairobi instants; the backend stores calendar dates.
    issueDate: nairobiDate(input.issuedAt),
    validUntil: nairobiDate(input.validUntil),
    terms: input.terms ?? null,
    internalNote: input.internalNote ?? null,
    lines: input.lines.map((line) => ({
      description: line.description,
      quantity: String(line.quantity),
      unitPrice: minorToInput(line.unitPriceMinor),
      taxRate: String(line.taxRatePercent),
    })),
  };
}

const nairobiDate = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(iso),
  );

/** Backend field names → the existing form's field names, for showing server errors. */
export function formFieldOf(field: string): string {
  if (field === 'issueDate') return 'issuedAt';
  if (field === 'agentId') return 'agentName';
  return field.replace(/^lines\.(\d+)\.taxRate$/, 'lines.$1.taxRatePercent');
}
