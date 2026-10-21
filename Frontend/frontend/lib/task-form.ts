// Task create/edit form: field values, validation and conversion to a typed
// input. Pure functions, no React.

import { fromDateTimeInput, toDateTimeInput } from '@/lib/dates';
import { severityMeta, taskStatusMeta } from '@/lib/labels';
import type { FieldErrors } from '@/lib/validation';
import type { Severity, Task, TaskStatus } from '@/lib/types';

export interface TaskFormValues {
  title: string;
  details: string;
  assignee: string;
  dueAt: string;
  priority: string;
  status: string;
  shipmentReference: string;
  quotationReference: string;
  documentId: string;
  invoiceNumber: string;
}

export type TaskField = keyof TaskFormValues;

export type TaskInput = Pick<Task, 'title' | 'details' | 'assignee' | 'dueAt' | 'priority' | 'status' | 'shipmentReference' | 'quotationReference' | 'documentId' | 'invoiceNumber'>;

export const taskFieldLabel: Record<TaskField, string> = {
  title: 'Task',
  details: 'Details',
  assignee: 'Assigned to',
  dueAt: 'Due',
  priority: 'Priority',
  status: 'Status',
  shipmentReference: 'Shipment',
  quotationReference: 'Quotation',
  documentId: 'Document',
  invoiceNumber: 'Invoice',
};

export const TASK_TITLE_MAX = 160;
export const TASK_DETAILS_MAX = 1000;
export const TASK_NOTE_MAX = 300;

/** Prefill from a notification or a record page (`?title=&shipment=&quotation=&document=&invoice=`). */
export interface TaskPrefill {
  title?: string;
  shipmentReference?: string;
  quotationReference?: string;
  documentId?: string;
  invoiceNumber?: string;
}

export function emptyTaskForm(prefill: TaskPrefill = {}): TaskFormValues {
  return {
    title: prefill.title ?? '',
    details: '',
    assignee: '',
    dueAt: '',
    priority: 'medium',
    status: 'open',
    shipmentReference: prefill.shipmentReference ?? '',
    quotationReference: prefill.quotationReference ?? '',
    documentId: prefill.documentId ?? '',
    invoiceNumber: prefill.invoiceNumber ?? '',
  };
}

export function taskToForm(t: Task): TaskFormValues {
  return {
    title: t.title,
    details: t.details ?? '',
    assignee: t.assignee,
    dueAt: toDateTimeInput(t.dueAt),
    priority: t.priority,
    status: t.status,
    shipmentReference: t.shipmentReference ?? '',
    quotationReference: t.quotationReference ?? '',
    documentId: t.documentId ?? '',
    invoiceNumber: t.invoiceNumber ?? '',
  };
}

export interface TaskFormContext {
  staff: string[];
  shipments: string[];
  quotations: string[];
  /** Document id → shipment it belongs to. */
  documents: Record<string, string>;
  invoices: string[];
}

export function validateTaskForm(values: TaskFormValues, ctx: TaskFormContext): { errors: FieldErrors<TaskField>; input?: TaskInput } {
  const errors: FieldErrors<TaskField> = {};
  const title = values.title.trim();
  if (!title) errors.title = 'Describe the task, e.g. “Chase certificate of origin from shipper”.';
  else if (title.length > TASK_TITLE_MAX) errors.title = `Use ${TASK_TITLE_MAX} characters or fewer.`;
  if (values.details.trim().length > TASK_DETAILS_MAX) errors.details = `Use ${TASK_DETAILS_MAX} characters or fewer.`;
  if (!values.assignee) errors.assignee = 'Select who is responsible.';
  else if (!ctx.staff.includes(values.assignee)) errors.assignee = 'Select a staff member from the list.';
  const dueAt = fromDateTimeInput(values.dueAt);
  if (!values.dueAt) errors.dueAt = 'Enter when the task is due.';
  else if (!dueAt) errors.dueAt = 'Enter a valid date and time.';
  if (!Object.hasOwn(severityMeta, values.priority)) errors.priority = 'Select a priority.';
  if (!Object.hasOwn(taskStatusMeta, values.status)) errors.status = 'Select a status.';
  if (values.shipmentReference && !ctx.shipments.includes(values.shipmentReference)) errors.shipmentReference = 'Select a shipment from the list.';
  if (values.quotationReference && !ctx.quotations.includes(values.quotationReference)) errors.quotationReference = 'Select a quotation from the list.';
  if (values.documentId) {
    const docShipment = ctx.documents[values.documentId];
    if (!docShipment) errors.documentId = 'Select a document from the list.';
    else if (values.shipmentReference && docShipment !== values.shipmentReference) {
      errors.documentId = `This document belongs to ${docShipment}, not the selected shipment.`;
    }
  }
  if (values.invoiceNumber && !ctx.invoices.includes(values.invoiceNumber)) errors.invoiceNumber = 'Select an invoice from the list.';

  if (Object.keys(errors).length > 0) return { errors };
  const optional = (v: string) => v || undefined;
  return {
    errors,
    input: {
      title,
      details: values.details.trim() || undefined,
      assignee: values.assignee,
      dueAt: dueAt as string,
      priority: values.priority as Severity,
      status: values.status as TaskStatus,
      // A document implies its shipment.
      shipmentReference: optional(values.shipmentReference) ?? (values.documentId ? ctx.documents[values.documentId] : undefined),
      quotationReference: optional(values.quotationReference),
      documentId: optional(values.documentId),
      invoiceNumber: optional(values.invoiceNumber),
    },
  };
}

export function validateTaskNote(note: string): string | undefined {
  if (!note.trim()) return 'Enter the follow-up note.';
  if (note.trim().length > TASK_NOTE_MAX) return `Use ${TASK_NOTE_MAX} characters or fewer.`;
  return undefined;
}
