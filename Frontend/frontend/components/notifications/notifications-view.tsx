'use client';

import { ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { SessionNotice } from '@/components/ui/session-notice';
import { DataSourceNotice, PendingNotice } from '@/components/ui/states';
import { useSessionStore } from '@/lib/data/session-store';
import { formatDate } from '@/lib/format';
import { isOpenTask, isOverdueTask } from '@/lib/task-changes';
import type { DataSource } from '@/lib/types';
import { NotificationList } from './notification-list';
import { TaskList } from './task-list';

export function NotificationsView({ staff, source }: { staff: string[]; source: DataSource }) {
  const { notifications, readNotificationIds, tasks, referenceDate } = useSessionStore();
  const unread = notifications.filter((n) => !readNotificationIds.has(n.id));
  const openTasks = tasks.filter(isOpenTask);
  const overdue = tasks.filter((t) => isOverdueTask(t, referenceDate));

  const summary = [
    { label: 'Unread notifications', value: unread.length, detail: `${notifications.length} in total`, href: '#notifications' },
    { label: 'High priority alerts', value: notifications.filter((n) => n.severity === 'high').length, detail: 'Delays, urgent documents, long-overdue invoices', href: '#notifications' },
    { label: 'Outstanding tasks', value: openTasks.length, detail: `${openTasks.filter((t) => t.status === 'in_progress').length} in progress`, href: '#tasks' },
    { label: 'Overdue tasks', value: overdue.length, detail: `Past due as at ${formatDate(referenceDate)}`, href: '#tasks' },
  ];

  return (
    <>
      <PageHeader
        title="Notifications & tasks"
        description="Alerts for arrivals, delays, documents, quotations and invoices, and the follow-up tasks assigned to staff."
      >
        <ButtonLink href="/notifications/tasks/new">New task</ButtonLink>
      </PageHeader>
      <SessionNotice />
      <DataSourceNotice source={source}>
        Notifications are worked out in your browser from the demo records and any edits made in this tab, as at the fixed
        demo date {formatDate(referenceDate)}. Tasks and read markers are kept in this tab only and are lost on reload.
      </DataSourceNotice>
      <div className="mb-6">
        <PendingNotice title="Nothing is sent">
          No email, SMS or push notifications are sent, and nobody is told when a task is assigned. Delivering notifications
          and reminders needs a backend scheduler and messaging integration.
        </PendingNotice>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-blue-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <p className="text-sm font-medium text-slate-600">{item.label}</p>
            <p className="mt-2 text-xl font-semibold text-slate-900 tabular-nums">{item.value}</p>
            <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
          </a>
        ))}
      </div>

      <div className="flex flex-col gap-6 [&>*]:scroll-mt-20">
        <div id="notifications">
          <NotificationList />
        </div>
        <div id="tasks">
          <TaskList staff={staff} />
        </div>
      </div>
    </>
  );
}
