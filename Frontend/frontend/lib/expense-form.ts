// Record-expense form: field values, validation and conversion to a typed
// input. Pure functions, no React.

import { fromDateInput, isBefore } from '@/lib/dates';
import { expenseCategoryLabel, expenseStatusMeta } from '@/lib/labels';
import type { FieldErrors } from '@/lib/validation';
import type { Expense, ExpenseCategory, ExpenseStatus } from '@/lib/types';

export interface ExpenseFormValues {
  shipmentReference: string;
  category: string;
  description: string;
  payee: string;
  amountKes: string;
  incurredAt: string;
  status: string;
}

export type ExpenseField = keyof ExpenseFormValues;

export type ExpenseInput = Omit<Expense, 'id' | 'recordedBy' | 'recordedAt'>;

export const expenseFieldLabel: Record<ExpenseField, string> = {
  shipmentReference: 'Shipment',
  category: 'Cost category',
  description: 'Description',
  payee: 'Supplier / payee',
  amountKes: 'Amount (KES)',
  incurredAt: 'Date incurred',
  status: 'Status',
};

/** Largest amount accepted, to catch typing mistakes (KES 100 million). */
export const MAX_EXPENSE_KES = 100_000_000;

export const emptyExpenseForm = (shipmentReference = ''): ExpenseFormValues => ({
  shipmentReference,
  category: '',
  description: '',
  payee: '',
  amountKes: '',
  incurredAt: '',
  status: 'pending_approval',
});

/** Whole shillings, digits only (thousands separators allowed); undefined otherwise. */
export function parseKes(value: string): number | undefined {
  const v = value.trim().replace(/,/g, '');
  return /^\d+$/.test(v) ? Number(v) : undefined;
}

export function validateExpenseForm(
  values: ExpenseFormValues,
  ctx: { shipmentReferences: string[]; now: string },
): { errors: FieldErrors<ExpenseField>; input?: ExpenseInput } {
  const errors: FieldErrors<ExpenseField> = {};
  if (!values.shipmentReference) errors.shipmentReference = 'Select the shipment this cost belongs to.';
  else if (!ctx.shipmentReferences.includes(values.shipmentReference)) errors.shipmentReference = 'Select a shipment from the list.';
  if (!values.category) errors.category = 'Select a cost category.';
  else if (!Object.hasOwn(expenseCategoryLabel, values.category)) errors.category = 'Select a category from the list.';
  if (!values.description.trim()) errors.description = 'Describe the cost, e.g. “Port handling charges”.';
  if (!values.payee.trim()) errors.payee = 'Enter who charged this cost.';
  const amount = parseKes(values.amountKes);
  if (!values.amountKes.trim()) errors.amountKes = 'Enter the amount in Kenya shillings.';
  else if (amount === undefined) errors.amountKes = 'Enter whole shillings using digits only, e.g. 48500.';
  else if (amount === 0) errors.amountKes = 'The amount must be more than zero.';
  else if (amount > MAX_EXPENSE_KES) errors.amountKes = 'The amount is over KES 100,000,000. Check it was typed correctly.';
  const incurredAt = fromDateInput(values.incurredAt);
  if (!values.incurredAt) errors.incurredAt = 'Enter the date the cost was incurred.';
  else if (!incurredAt) errors.incurredAt = 'Enter a valid date.';
  else if (!isBefore(incurredAt, ctx.now)) errors.incurredAt = 'The date cannot be in the future.';
  if (!Object.hasOwn(expenseStatusMeta, values.status)) errors.status = 'Select a status.';

  if (Object.keys(errors).length > 0) return { errors };
  return {
    errors,
    input: {
      shipmentReference: values.shipmentReference,
      category: values.category as ExpenseCategory,
      description: values.description.trim(),
      payee: values.payee.trim(),
      amountKes: amount as number,
      incurredAt: incurredAt as string,
      status: values.status as ExpenseStatus,
    },
  };
}
