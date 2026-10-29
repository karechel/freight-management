'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DateField, ErrorSummary, FormSection, SelectField, TextAreaField, TextField } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { SessionNotice } from '@/components/ui/session-notice';
import { DataSourceNotice, RecordNotFound, SESSION_EDIT_NOTE } from '@/components/ui/states';
import { useValidatedForm } from '@/components/ui/use-validated-form';
import { useSessionStore, useSessionTask } from '@/lib/data/session-store';
import { nowDateTimeInput } from '@/lib/dates';
import { documentTypeLabel, taskPriorityMeta, taskStatusMeta } from '@/lib/labels';
import { applyTaskUpdate } from '@/lib/task-changes';
import {
  emptyTaskForm,
  TASK_DETAILS_MAX,
  TASK_TITLE_MAX,
  taskFieldLabel,
  taskToForm,
  validateTaskForm,
  type TaskFormValues,
  type TaskPrefill,
} from '@/lib/task-form';
import type { DataSource, Task } from '@/lib/types';
import { taskHref } from './task-list';

function TaskForm({ task, staff, prefill }: { task?: Task; staff: string[]; prefill?: TaskPrefill }) {
  const router = useRouter();
  const store = useSessionStore();
  const [unchanged, setUnchanged] = useState(false);
  const ctx = {
    staff,
    shipments: store.shipments.map((s) => s.reference),
    quotations: store.quotations.map((q) => q.reference),
    documents: Object.fromEntries(store.documents.map((d) => [d.id, d.shipmentReference])),
    invoices: store.invoices.map((i) => i.number),
  };
  const form = useValidatedForm('task', task ? taskToForm(task) : emptyTaskForm(prefill), (values: TaskFormValues) => validateTaskForm(values, ctx), taskFieldLabel);
  const { values, set, field } = form;
  const documentOptions = store.documents
    .filter((d) => !values.shipmentReference || d.shipmentReference === values.shipmentReference)
    .map((d) => ({ value: d.id, label: `${documentTypeLabel[d.type]} · ${d.shipmentReference} (${d.status})` }));

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setUnchanged(false);
    const input = form.submit();
    if (!input) return;
    if (task) {
      const changed = store.updateTask(task.id, (t, c) => applyTaskUpdate(t, input, c));
      if (!changed) {
        setUnchanged(true);
        return;
      }
      store.showNotice('Task updated.', taskHref(task.id));
      router.push(taskHref(task.id));
    } else {
      const created = store.createTask(input);
      store.showNotice(`Task created and assigned to ${created.assignee}.`, taskHref(created.id));
      router.push(taskHref(created.id));
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <ErrorSummary id={form.summaryId} errors={form.summary} />
      {unchanged && (
        <p role="status" className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          No changes to save.
        </p>
      )}
      <Card>
        <FormSection title="Task">
          <TextField
            {...field('title')}
            label={taskFieldLabel.title}
            required
            maxLength={TASK_TITLE_MAX}
            value={values.title}
            onChange={(v) => set('title', v)}
            className="sm:col-span-2 lg:col-span-3"
          />
          <TextAreaField
            {...field('details')}
            label={taskFieldLabel.details}
            maxLength={TASK_DETAILS_MAX}
            value={values.details}
            onChange={(v) => set('details', v)}
            className="sm:col-span-2 lg:col-span-3"
          />
          <SelectField
            {...field('assignee')}
            label={taskFieldLabel.assignee}
            required
            placeholder="Select a staff member"
            value={values.assignee}
            onChange={(v) => set('assignee', v)}
            options={staff.map((s) => ({ value: s, label: s }))}
          />
          <DateField
            {...field('dueAt')}
            withTime
            label={taskFieldLabel.dueAt}
            required
            value={values.dueAt}
            onChange={(v) => set('dueAt', v)}
            onNow={() => set('dueAt', nowDateTimeInput())}
          />
          <SelectField
            {...field('priority')}
            label={taskFieldLabel.priority}
            required
            value={values.priority}
            onChange={(v) => set('priority', v)}
            options={Object.entries(taskPriorityMeta).map(([value, m]) => ({ value, label: m.label }))}
          />
          <SelectField
            {...field('status')}
            label={taskFieldLabel.status}
            required
            value={values.status}
            onChange={(v) => set('status', v)}
            options={Object.entries(taskStatusMeta).map(([value, m]) => ({ value, label: m.label }))}
          />
        </FormSection>
        <FormSection title="Related records" description="Optional. Link the task to what it concerns; links open the record.">
          <SelectField
            {...field('shipmentReference')}
            label={taskFieldLabel.shipmentReference}
            placeholder="None"
            value={values.shipmentReference}
            onChange={(v) =>
              form.update((current) => ({
                ...current,
                shipmentReference: v,
                // Drop a document that belongs to another shipment.
                documentId: v && current.documentId && ctx.documents[current.documentId] !== v ? '' : current.documentId,
              }))
            }
            options={store.shipments.map((s) => ({ value: s.reference, label: `${s.reference} · ${s.customerName}` }))}
          />
          <SelectField
            {...field('documentId')}
            label={taskFieldLabel.documentId}
            placeholder="None"
            hint={values.shipmentReference ? 'Documents of the selected shipment' : 'Select a shipment to narrow the list'}
            value={values.documentId}
            onChange={(v) => set('documentId', v)}
            options={documentOptions}
          />
          <SelectField
            {...field('quotationReference')}
            label={taskFieldLabel.quotationReference}
            placeholder="None"
            value={values.quotationReference}
            onChange={(v) => set('quotationReference', v)}
            options={store.quotations.map((q) => ({ value: q.reference, label: `${q.reference} · ${q.customerName}` }))}
          />
          <SelectField
            {...field('invoiceNumber')}
            label={taskFieldLabel.invoiceNumber}
            placeholder="None"
            value={values.invoiceNumber}
            onChange={(v) => set('invoiceNumber', v)}
            options={store.invoices.map((i) => ({ value: i.number, label: `${i.number} · ${i.customerName}` }))}
          />
        </FormSection>
      </Card>
      <div className="flex flex-wrap justify-end gap-2">
        <ButtonLink href={task ? taskHref(task.id) : '/notifications#tasks'} variant="secondary">
          Cancel
        </ButtonLink>
        <Button type="submit">{task ? 'Save task' : 'Create task'}</Button>
      </div>
    </form>
  );
}

export function TaskFormView({ taskId, staff, prefill, source }: { taskId?: string; staff: string[]; prefill?: TaskPrefill; source: DataSource }) {
  const task = useSessionTask(taskId ?? '');
  if (taskId && !task) {
    return <RecordNotFound title={`Task ${taskId} was not found`} backHref="/notifications#tasks" backLabel="All tasks" />;
  }
  return (
    <>
      <PageHeader
        title={task ? 'Edit task' : 'New task'}
        description="Assign a follow-up to a staff member. Fields marked * are required."
        back={task ? { href: taskHref(task.id), label: 'Back to task' } : { href: '/notifications#tasks', label: 'Notifications & tasks' }}
      />
      <SessionNotice />
      <DataSourceNotice source={source}>{SESSION_EDIT_NOTE} Assigning a task does not notify anyone.</DataSourceNotice>
      <TaskForm task={task} staff={staff} prefill={prefill} />
    </>
  );
}
