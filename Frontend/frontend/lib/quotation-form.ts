// Quotation create/edit form: values, validation and conversion to a typed
// input. Pure functions, no React. Amounts are converted to minor units here.

import { fromDateInput, isBefore, toDateInput } from '@/lib/dates';
import { currencyLabel, directionLabel, modeLabel } from '@/lib/labels';
import { minorToInput, parseMoney } from '@/lib/money';
import { quotationTotals } from '@/lib/quotations';
import type { Currency, Quotation, QuotationLine, ShipmentDirection, TransportMode } from '@/lib/types';
import type { FieldErrors } from '@/lib/validation';

export interface QuotationLineValues {
  /** Stable key for React lists and field ids. */
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRatePercent: string;
}

export interface QuotationFormValues {
  customerId: string;
  agentName: string;
  mode: string;
  direction: string;
  origin: string;
  destination: string;
  cargoSummary: string;
  currency: string;
  issuedAt: string;
  validUntil: string;
  terms: string;
  internalNote: string;
  lines: QuotationLineValues[];
}

export type QuotationField = Exclude<keyof QuotationFormValues, 'lines'> | 'lines';
/** Field keys used in errors, including line fields such as `lines.0.quantity`. */
export type QuotationErrorKey = QuotationField | `lines.${number}.${'description' | 'quantity' | 'unitPrice' | 'taxRatePercent'}`;

export type QuotationInput = Omit<
  Quotation,
  'reference' | 'status' | 'sentAt' | 'sentTo' | 'decidedAt' | 'shipmentReference' | 'duplicatedFrom' | 'events' | 'updatedAt'
>;

export const quotationFieldLabel: Record<QuotationField, string> = {
  customerId: 'Customer',
  agentName: 'Overseas / partner agent',
  mode: 'Transport mode',
  direction: 'Direction',
  origin: 'Origin',
  destination: 'Destination',
  cargoSummary: 'Cargo summary',
  currency: 'Currency',
  issuedAt: 'Issue date',
  validUntil: 'Valid until',
  lines: 'Line items',
  terms: 'Terms and conditions',
  internalNote: 'Internal note',
};

const lineFieldLabel = { description: 'description', quantity: 'quantity', unitPrice: 'unit price', taxRatePercent: 'tax rate' };

/** Summary label for dynamic keys like `lines.2.unitPrice` → "Line 3 unit price". */
export function quotationErrorLabel(key: string): string {
  const match = /^lines\.(\d+)\.(\w+)$/.exec(key);
  if (!match) return key;
  return `Line ${Number(match[1]) + 1} ${lineFieldLabel[match[2] as keyof typeof lineFieldLabel] ?? match[2]}`;
}

let lineCounter = 0;
export function emptyLine(): QuotationLineValues {
  lineCounter += 1;
  return { key: `new-${lineCounter}`, description: '', quantity: '1', unitPrice: '', taxRatePercent: '0' };
}

export function emptyQuotationForm(): QuotationFormValues {
  return {
    customerId: '',
    agentName: '',
    mode: '',
    direction: '',
    origin: '',
    destination: '',
    cargoSummary: '',
    currency: 'KES',
    issuedAt: '',
    validUntil: '',
    terms: '',
    internalNote: '',
    lines: [emptyLine()],
  };
}

const lineToValues = (l: QuotationLine): QuotationLineValues => ({
  key: l.id,
  description: l.description,
  quantity: String(l.quantity),
  unitPrice: minorToInput(l.unitPriceMinor),
  taxRatePercent: String(l.taxRatePercent),
});

export function quotationToForm(q: Quotation): QuotationFormValues {
  return {
    customerId: q.customerId,
    agentName: q.agentName ?? '',
    mode: q.mode,
    direction: q.direction,
    origin: q.origin,
    destination: q.destination,
    cargoSummary: q.cargoSummary,
    currency: q.currency,
    issuedAt: toDateInput(q.issuedAt),
    validUntil: toDateInput(q.validUntil),
    terms: q.terms ?? '',
    internalNote: q.internalNote ?? '',
    lines: q.lines.map(lineToValues),
  };
}

/** Copy for "duplicate as draft": same content, new line keys, dates left for the user to set. */
export function duplicateQuotationForm(q: Quotation): QuotationFormValues {
  return {
    ...quotationToForm(q),
    issuedAt: '',
    validUntil: '',
    lines: q.lines.map((l) => ({ ...lineToValues(l), key: emptyLine().key })),
  };
}

export interface QuotationFormContext {
  customers: { id: string; name: string }[];
  agents: string[];
  /** Current time (ISO). The issue date may not be later than today. */
  now: string;
}

const MAX_LINES = 50;

export function validateQuotationForm(
  values: QuotationFormValues,
  ctx: QuotationFormContext,
): { errors: FieldErrors<QuotationErrorKey>; input?: QuotationInput } {
  const errors: FieldErrors<QuotationErrorKey> = {};
  const t = (v: string) => v.trim();

  const customer = ctx.customers.find((c) => c.id === t(values.customerId));
  if (!t(values.customerId)) errors.customerId = 'Select the customer.';
  else if (!customer) errors.customerId = 'Select a customer from the list.';
  if (t(values.agentName) && !ctx.agents.includes(t(values.agentName))) errors.agentName = 'Select an agent from the list, or leave empty.';

  if (!Object.hasOwn(modeLabel, t(values.mode))) errors.mode = 'Select the transport mode.';
  if (!Object.hasOwn(directionLabel, t(values.direction))) errors.direction = 'Select import, export or transit.';

  for (const field of ['origin', 'destination'] as const) {
    if (!t(values[field])) errors[field] = `Enter the ${field}.`;
    else if (t(values[field]).length > 120) errors[field] = 'Use 120 characters or fewer.';
  }
  if (!errors.origin && !errors.destination && t(values.origin).toLowerCase() === t(values.destination).toLowerCase()) {
    errors.destination = 'Destination must be different from the origin.';
  }
  if (!t(values.cargoSummary)) errors.cargoSummary = 'Summarise the cargo (e.g. "2 × 20ft GP, steel products").';
  else if (t(values.cargoSummary).length > 200) errors.cargoSummary = 'Use 200 characters or fewer.';

  if (!Object.hasOwn(currencyLabel, t(values.currency))) errors.currency = 'Select the currency.';

  const issued = fromDateInput(t(values.issuedAt));
  const validDay = fromDateInput(t(values.validUntil));
  if (!t(values.issuedAt)) errors.issuedAt = 'Enter the issue date.';
  else if (!issued) errors.issuedAt = 'Enter a valid date.';
  else if (toDateInput(ctx.now) < t(values.issuedAt)) errors.issuedAt = 'The issue date cannot be in the future.';
  if (!t(values.validUntil)) errors.validUntil = 'Enter the last day the quotation is valid.';
  else if (!validDay) errors.validUntil = 'Enter a valid date.';
  else if (issued && isBefore(validDay, issued)) errors.validUntil = 'Valid until cannot be before the issue date.';

  if (values.lines.length === 0) errors.lines = 'Add at least one line item.';
  if (values.lines.length > MAX_LINES) errors.lines = `Use ${MAX_LINES} line items or fewer.`;

  const lines: QuotationLine[] = [];
  values.lines.forEach((line, i) => {
    const key = (f: 'description' | 'quantity' | 'unitPrice' | 'taxRatePercent') => `lines.${i}.${f}` as const;
    const description = t(line.description);
    if (!description) errors[key('description')] = 'Describe the charge.';
    else if (description.length > 200) errors[key('description')] = 'Use 200 characters or fewer.';

    let quantity = 0;
    if (!/^\d+(\.\d{1,3})?$/.test(t(line.quantity))) errors[key('quantity')] = 'Enter a number with up to 3 decimal places.';
    else {
      quantity = Number(t(line.quantity));
      if (quantity <= 0 || quantity > 1_000_000) errors[key('quantity')] = 'Enter a quantity above 0 and up to 1,000,000.';
    }

    const unitPriceMinor = parseMoney(line.unitPrice);
    if (!t(line.unitPrice)) errors[key('unitPrice')] = 'Enter the unit price.';
    else if (unitPriceMinor === undefined) errors[key('unitPrice')] = 'Enter an amount with up to 2 decimal places, without commas.';
    else if (unitPriceMinor > 100_000_000_000) errors[key('unitPrice')] = 'Enter a unit price up to 1,000,000,000.';

    let taxRatePercent = 0;
    if (!/^\d+(\.\d{1,2})?$/.test(t(line.taxRatePercent))) errors[key('taxRatePercent')] = 'Enter a rate such as 0 or 16.';
    else {
      taxRatePercent = Number(t(line.taxRatePercent));
      if (taxRatePercent > 100) errors[key('taxRatePercent')] = 'Enter a rate between 0 and 100.';
    }
    lines.push({ id: line.key, description, quantity, unitPriceMinor: unitPriceMinor ?? 0, taxRatePercent });
  });

  if (!errors.lines && values.lines.length > 0 && Object.keys(errors).every((k) => !k.startsWith('lines.'))) {
    if (quotationTotals(lines).totalMinor <= 0) errors.lines = 'The quotation total must be more than zero.';
  }

  if (t(values.terms).length > 2000) errors.terms = 'Use 2,000 characters or fewer.';
  if (t(values.internalNote).length > 1000) errors.internalNote = 'Use 1,000 characters or fewer.';

  if (Object.keys(errors).length > 0 || !customer || !issued || !validDay) return { errors };

  return {
    errors,
    input: {
      customerId: customer.id,
      customerName: customer.name,
      agentName: t(values.agentName) || undefined,
      mode: t(values.mode) as TransportMode,
      direction: t(values.direction) as ShipmentDirection,
      origin: t(values.origin),
      destination: t(values.destination),
      cargoSummary: t(values.cargoSummary),
      currency: t(values.currency) as Currency,
      lines,
      terms: t(values.terms) || undefined,
      internalNote: t(values.internalNote) || undefined,
      issuedAt: issued,
      // Valid to the end of the chosen day, as in the existing records.
      validUntil: `${t(values.validUntil)}T23:59:00+03:00`,
    },
  };
}

/** Live totals for the form, ignoring lines that do not parse yet. */
export function previewTotals(values: QuotationFormValues) {
  return quotationTotals(
    values.lines.map((l) => ({
      quantity: /^\d+(\.\d{1,3})?$/.test(l.quantity.trim()) ? Number(l.quantity.trim()) : 0,
      unitPriceMinor: parseMoney(l.unitPrice) ?? 0,
      taxRatePercent: /^\d+(\.\d{1,2})?$/.test(l.taxRatePercent.trim()) ? Math.min(Number(l.taxRatePercent.trim()), 100) : 0,
    })),
  );
}
