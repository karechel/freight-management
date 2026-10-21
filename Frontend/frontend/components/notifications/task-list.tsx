'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { inputClass } from '@/components/ui/form';
import { EmptyState } from '@/components/ui/states';
import { useSessionStore } from '@/lib/data/session-store';
import { formatDateTime } from '@/lib/format';
import { taskPriorityMeta, taskStatusMeta } from '@/lib/labels';
import { isOpenTask, isOverdueTask } from '@/lib/task-changes';
import type { Severity, Task } from '@/lib/types';
import { RecordLinks } from './record-links';

type StatusFilter = 'outstanding' | 'overdue' | 'done' | 'cancelled' | 'all';

const statusFilterLabel: Record<StatusFilter, string> = {
  outstanding: 'Outstanding (open or in progress)',
  overdue: 'Overdue',
  done: 'Done',
  cancelled: 'Cancelled',
  all: 'All tasks',
};

export const taskHref = (id: string) => `/notifications/tasks/${encodeURIComponent(id)}`;

/** Due date, flagged when overdue. `bare` omits the word "due" (for use under a "Due" label). */
export function DueText({ task, referenceDate, bare = false }: { task: Task; referenceDate: string; bare?: boolean }) {
  const overdue = isOverdueTask(task, referenceDate);
  return (
    <span className={overdue ? 'font-medium text-red-700' : undefined}>
      {overdue ? 'Overdue · ' : ''}
      {bare ? '' : 'due '}
      {formatDateTime(task.dueAt)}
    </span>
  );
}

export function TaskList({ staff }: { staff: string[] }) {
  const { tasks, referenceDate } = useSessionStore();
  const [status, setStatus] = useState<StatusFilter>('outstanding');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState<'' | Severity>('');

  const matchesStatus = (t: Task) =>
    status === 'all' ||
    (status === 'outstanding' && isOpenTask(t)) ||
    (status === 'overdue' && isOverdueTask(t, referenceDate)) ||
    t.status === status;
  const visible = tasks.filter((t) => matchesStatus(t) && (!assignee || t.assignee === assignee) && (!priority || t.priority === priority));

  return (
    <Card>
      <CardHeader title="Tasks" description="Assigned follow-ups with due dates, priorities and notes">
        <ButtonLink href="/notifications/tasks/new" size="sm">
          New task
        </ButtonLink>
      </CardHeader>
      <CardBody className="grid grid-cols-1 gap-3 border-b border-slate-200 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="task-filter-status" className="text-xs font-medium text-slate-600">
            Show
          </label>
          <select id="task-filter-status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className={`${inputClass} w-full`}>
            {(Object.keys(statusFilterLabel) as StatusFilter[]).map((s) => (
              <option key={s} value={s}>
                {statusFilterLabel[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="task-filter-assignee" className="text-xs font-medium text-slate-600">
            Assigned to
          </label>
          <select id="task-filter-assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)} className={`${inputClass} w-full`}>
            <option value="">Everyone</option>
            {staff.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="task-filter-priority" className="text-xs font-medium text-slate-600">
            Priority
          </label>
          <select id="task-filter-priority" value={priority} onChange={(e) => setPriority(e.target.value as '' | Severity)} className={`${inputClass} w-full`}>
            <option value="">Any priority</option>
            {(Object.keys(taskPriorityMeta) as Severity[]).map((p) => (
              <option key={p} value={p}>
                {taskPriorityMeta[p].label}
              </option>
            ))}
          </select>
        </div>
      </CardBody>
      <p className="sr-only" role="status">
        {visible.length} tasks shown
      </p>
      {visible.length === 0 ? (
        <EmptyState title="No tasks match these filters" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {visible.map((t) => (
            <li key={t.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5">
              <div className="min-w-0">
                <Link href={taskHref(t.id)} className="rounded text-sm font-medium text-slate-900 hover:text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">
                  {t.title}
                </Link>
                <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-slate-600">
                  <span>{t.assignee}</span>
                  <span aria-hidden="true">·</span>
                  <DueText task={t} referenceDate={referenceDate} />
                  {t.notes.length > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        {t.notes.length} note{t.notes.length === 1 ? '' : 's'}
                      </span>
                    </>
                  )}
                </p>
                <div className="mt-1.5">
                  <RecordLinks links={t} />
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5 sm:justify-end">
                <StatusBadge meta={taskStatusMeta[t.status]} />
                <StatusBadge meta={taskPriorityMeta[t.priority]} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
