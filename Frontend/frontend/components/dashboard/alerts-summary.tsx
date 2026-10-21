'use client';

// Dashboard summary of important notifications and outstanding tasks, from the
// session store, so it agrees with the notifications and tasks page.

import Link from 'next/link';
import { StatusBadge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { AlertIcon, ClockIcon } from '@/components/ui/icons';
import { taskHref, DueText } from '@/components/notifications/task-list';
import { useSessionStore } from '@/lib/data/session-store';
import { severityMeta, taskPriorityMeta } from '@/lib/labels';
import { isOpenTask, isOverdueTask } from '@/lib/task-changes';

/** Items listed in each half of the card. */
const LIMIT = 4;

const rowLink = 'rounded text-sm font-medium text-slate-900 hover:text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600';

export function AlertsSummary() {
  const { notifications, readNotificationIds, tasks, referenceDate } = useSessionStore();
  const important = notifications.filter((n) => n.severity !== 'low' && !readNotificationIds.has(n.id));
  const outstanding = tasks.filter(isOpenTask);
  const overdue = outstanding.filter((t) => isOverdueTask(t, referenceDate));

  return (
    <Card>
      <CardHeader
        title="Alerts and tasks"
        description={`${important.length} unread important alerts · ${outstanding.length} outstanding tasks (${overdue.length} overdue)`}
        action={{ href: '/notifications', label: 'Open notifications & tasks' }}
      />
      <div className="grid grid-cols-1 divide-y divide-slate-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <section aria-labelledby="dash-alerts" className="min-w-0">
          <h3 id="dash-alerts" className="px-4 pt-3 text-xs font-semibold tracking-wide text-slate-600 uppercase sm:px-5">
            Important alerts
          </h3>
          {important.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500 sm:px-5">No unread medium or high priority alerts.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {important.slice(0, LIMIT).map((n) => (
                <li key={n.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                  <AlertIcon className={`mt-0.5 size-4 shrink-0 ${n.severity === 'high' ? 'text-red-600' : 'text-amber-600'}`} />
                  <div className="min-w-0 flex-1">
                    <Link href={n.href} className={rowLink}>
                      {n.title}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{n.detail}</p>
                  </div>
                  <StatusBadge meta={severityMeta[n.severity]} />
                </li>
              ))}
            </ul>
          )}
          {important.length > LIMIT && (
            <p className="px-4 pb-3 text-xs sm:px-5">
              <Link href="/notifications#notifications" className="rounded text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">
                {important.length - LIMIT} more alerts
              </Link>
            </p>
          )}
        </section>
        <section aria-labelledby="dash-tasks" className="min-w-0">
          <h3 id="dash-tasks" className="px-4 pt-3 text-xs font-semibold tracking-wide text-slate-600 uppercase sm:px-5">
            Outstanding tasks
          </h3>
          {outstanding.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500 sm:px-5">No outstanding tasks.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {outstanding.slice(0, LIMIT).map((t) => (
                <li key={t.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                  <ClockIcon className={`mt-0.5 size-4 shrink-0 ${isOverdueTask(t, referenceDate) ? 'text-red-600' : 'text-slate-400'}`} />
                  <div className="min-w-0 flex-1">
                    <Link href={taskHref(t.id)} className={rowLink}>
                      {t.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {t.assignee} · <DueText task={t} referenceDate={referenceDate} />
                    </p>
                  </div>
                  <StatusBadge meta={taskPriorityMeta[t.priority]} />
                </li>
              ))}
            </ul>
          )}
          {outstanding.length > LIMIT && (
            <p className="px-4 pb-3 text-xs sm:px-5">
              <Link href="/notifications#tasks" className="rounded text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">
                {outstanding.length - LIMIT} more tasks
              </Link>
            </p>
          )}
        </section>
      </div>
    </Card>
  );
}
