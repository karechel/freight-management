// Pure operations on tasks. Used by the in-browser session store; with a real
// backend these rules belong on the server (docs/api-contracts.md).

import { formatDateTime } from '@/lib/format';
import { severityMeta, taskStatusMeta } from '@/lib/labels';
import { newId, type ChangeContext } from '@/lib/shipment-changes';
import type { TaskInput } from '@/lib/task-form';
import type { Task, TaskStatus } from '@/lib/types';

export const isOpenTask = (t: Pick<Task, 'status'>) => t.status === 'open' || t.status === 'in_progress';

export const isOverdueTask = (t: Pick<Task, 'status' | 'dueAt'>, referenceDate: string) =>
  isOpenTask(t) && new Date(t.dueAt).getTime() < new Date(referenceDate).getTime();

/** Open tasks first (overdue, then by due date), then finished ones, newest first. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const open = Number(isOpenTask(b)) - Number(isOpenTask(a));
    if (open) return open;
    return isOpenTask(a) ? a.dueAt.localeCompare(b.dueAt) : (b.completedAt ?? b.dueAt).localeCompare(a.completedAt ?? a.dueAt);
  });
}

const note = (text: string, ctx: ChangeContext, automatic = false) => ({ id: newId('tn'), at: ctx.now, actor: ctx.actor, note: text, automatic });

export function createTask(input: TaskInput, ctx: ChangeContext): Task {
  return {
    id: newId('task'),
    ...input,
    notes: [note(`Task created and assigned to ${input.assignee}.`, ctx, true)],
    createdAt: ctx.now,
    createdBy: ctx.actor,
    completedAt: input.status === 'done' ? ctx.now : undefined,
    updatedAt: ctx.now,
  };
}

const linkLabel = (t: TaskInput) =>
  [t.shipmentReference, t.quotationReference, t.documentId && `document ${t.documentId}`, t.invoiceNumber].filter(Boolean).join(', ') || 'none';

/** Applies an edit and records what changed. Returns the same object when nothing changed. */
export function applyTaskUpdate(t: Task, input: TaskInput, ctx: ChangeContext): Task {
  const changes: string[] = [];
  if (t.title !== input.title) changes.push(`title changed to “${input.title}”`);
  if ((t.details ?? '') !== (input.details ?? '')) changes.push('details updated');
  if (t.assignee !== input.assignee) changes.push(`reassigned from ${t.assignee} to ${input.assignee}`);
  if (t.dueAt !== input.dueAt) changes.push(`due date changed to ${formatDateTime(input.dueAt)}`);
  if (t.priority !== input.priority) changes.push(`priority changed to ${severityMeta[input.priority].label.toLowerCase()}`);
  if (t.status !== input.status) changes.push(`status changed from ${taskStatusMeta[t.status].label} to ${taskStatusMeta[input.status].label}`);
  const before = linkLabel(t);
  const after = linkLabel(input);
  if (before !== after) changes.push(`links changed to ${after}`);
  if (changes.length === 0) return t;
  const text = changes.join('; ');
  return {
    ...t,
    ...input,
    completedAt: input.status === 'done' ? (t.status === 'done' ? t.completedAt : ctx.now) : undefined,
    notes: [...t.notes, note(text.charAt(0).toUpperCase() + text.slice(1) + '.', ctx, true)],
    updatedAt: ctx.now,
  };
}

/** Status changes the task page offers from each status. */
export const taskTransitions: Record<TaskStatus, TaskStatus[]> = {
  open: ['in_progress', 'done', 'cancelled'],
  in_progress: ['done', 'open', 'cancelled'],
  done: ['open'],
  cancelled: ['open'],
};

export function applyTaskStatus(t: Task, status: TaskStatus, ctx: ChangeContext): Task {
  if (t.status === status || !taskTransitions[t.status].includes(status)) return t;
  return {
    ...t,
    status,
    completedAt: status === 'done' ? ctx.now : undefined,
    notes: [...t.notes, note(`Status changed from ${taskStatusMeta[t.status].label} to ${taskStatusMeta[status].label}.`, ctx, true)],
    updatedAt: ctx.now,
  };
}

export function addTaskNote(t: Task, text: string, ctx: ChangeContext): Task {
  return { ...t, notes: [...t.notes, note(text.trim(), ctx)], updatedAt: ctx.now };
}
