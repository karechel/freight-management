'use client';

import { useState } from 'react';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { DetailList } from '@/components/ui/detail-list';
import { TextAreaField } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { SessionNotice } from '@/components/ui/session-notice';
import { DataSourceNotice, RecordNotFound, SESSION_EDIT_NOTE } from '@/components/ui/states';
import { useSessionStore, useSessionTask } from '@/lib/data/session-store';
import { formatDateTime } from '@/lib/format';
import { taskPriorityMeta, taskStatusMeta } from '@/lib/labels';
import { addTaskNote, applyTaskStatus, taskTransitions } from '@/lib/task-changes';
import { TASK_NOTE_MAX, validateTaskNote } from '@/lib/task-form';
import type { DataSource, Task, TaskStatus } from '@/lib/types';
import { RecordLinks } from './record-links';
import { DueText, taskHref } from './task-list';

const transitionLabel: Record<TaskStatus, string> = {
  open: 'Reopen',
  in_progress: 'Start',
  done: 'Mark done',
  cancelled: 'Cancel task',
};

function NoteForm({ task }: { task: Task }) {
  const { updateTask } = useSessionStore();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>();
  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const problem = validateTaskNote(note);
    setError(problem);
    if (problem) return;
    updateTask(task.id, (t, ctx) => addTaskNote(t, note, ctx));
    setNote('');
  }
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2 border-t border-slate-200 px-4 py-4 sm:px-5">
      <TextAreaField id="task-note" label="Follow-up note" required value={note} onChange={setNote} rows={2} maxLength={TASK_NOTE_MAX} error={error} />
      <div className="flex justify-end">
        <Button type="submit" size="sm">
          Add note
        </Button>
      </div>
    </form>
  );
}

export function TaskDetailView({ taskId, source }: { taskId: string; source: DataSource }) {
  const task = useSessionTask(taskId);
  const { updateTask, referenceDate } = useSessionStore();
  if (!task) return <RecordNotFound title={`Task ${taskId} was not found`} backHref="/notifications#tasks" backLabel="All tasks" />;
  const notes = [...task.notes].reverse();

  return (
    <>
      <PageHeader title={task.title} description={`Assigned to ${task.assignee}`} back={{ href: '/notifications#tasks', label: 'Notifications & tasks' }}>
        <StatusBadge meta={taskStatusMeta[task.status]} />
        <StatusBadge meta={taskPriorityMeta[task.priority]} />
        <ButtonLink href={`${taskHref(task.id)}/edit`} variant="secondary" size="sm">
          Edit task
        </ButtonLink>
      </PageHeader>
      <SessionNotice />
      <DataSourceNotice source={source}>{SESSION_EDIT_NOTE} Nobody is notified of changes.</DataSourceNotice>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader title="Task details" />
            <CardBody className="flex flex-col gap-4">
              <DetailList
                columns={2}
                items={[
                  { label: 'Due', value: <DueText task={task} referenceDate={referenceDate} bare /> },
                  { label: 'Assigned to', value: task.assignee },
                  {
                    label: 'Related records',
                    value:
                      task.shipmentReference || task.quotationReference || task.documentId || task.invoiceNumber ? <RecordLinks links={task} /> : 'None',
                  },
                  { label: 'Created', value: task.createdAt ? `${formatDateTime(task.createdAt)}${task.createdBy ? ` · ${task.createdBy}` : ''}` : 'Not recorded' },
                  ...(task.completedAt ? [{ label: 'Completed', value: formatDateTime(task.completedAt) }] : []),
                ]}
              />
              {task.details && <p className="text-sm whitespace-pre-line text-slate-700">{task.details}</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Follow-up notes" description="Newest first. Automatic entries record changes made on this page." />
            {notes.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-500 sm:px-5">No notes yet.</p>
            ) : (
              <ol className="divide-y divide-slate-100">
                {notes.map((n) => (
                  <li key={n.id} className="px-4 py-3 sm:px-5">
                    <p className="text-sm text-slate-800">{n.note}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <time dateTime={n.at}>{formatDateTime(n.at)}</time> · {n.actor}
                      {n.automatic && <Badge tone="neutral">Change</Badge>}
                    </p>
                  </li>
                ))}
              </ol>
            )}
            <NoteForm task={task} />
          </Card>
        </div>

        <Card>
          <CardHeader title="Change status" />
          <CardBody className="flex flex-col gap-2">
            {taskTransitions[task.status].map((status) => (
              <Button
                key={status}
                variant={status === 'done' ? 'primary' : 'secondary'}
                onClick={() => updateTask(task.id, (t, ctx) => applyTaskStatus(t, status, ctx))}
              >
                {transitionLabel[status]}
              </Button>
            ))}
            <p className="mt-2 text-xs text-slate-500">Status changes are added to the notes with the time and who made them.</p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
