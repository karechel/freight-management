// Dashboard panels. Presentational only; data is passed in by the page.

import Link from 'next/link';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ClockIcon } from '@/components/ui/icons';
import { EmptyState } from '@/components/ui/states';
import { daysBetween, formatDateTime } from '@/lib/format';
import { severityMeta, shipmentStatusMeta, shipmentStatusOrder } from '@/lib/labels';
import type { ActivityItem, ShipmentStatus, Task } from '@/lib/types';

const linkClass =
  'rounded font-mono text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600';

/** Shipment count per workflow stage, as labelled rows with a single-hue bar. */
export function StatusBreakdown({ counts }: { counts: Record<ShipmentStatus, number> }) {
  const max = Math.max(1, ...Object.values(counts));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <Card>
      <CardHeader
        title="Shipment pipeline"
        description={`${total} shipments by current stage`}
        action={{ href: '/shipments?view=all', label: 'View all' }}
      />
      <CardBody>
        <ul className="flex flex-col gap-2.5">
          {shipmentStatusOrder.map((status) => {
            const count = counts[status];
            return (
              <li key={status} className="grid grid-cols-[8.5rem_1fr_2rem] items-center gap-3 text-sm">
                <span className="truncate text-slate-700">{shipmentStatusMeta[status].label}</span>
                <span className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                  <span
                    className={`block h-full rounded-full ${status === 'on_hold' ? 'bg-red-500' : 'bg-blue-700'}`}
                    style={{ width: `${(count / max) * 100}%` }}
                  />
                </span>
                <span className="text-right font-medium text-slate-900 tabular-nums">{count}</span>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}

export function TaskList({ tasks, referenceDate }: { tasks: Task[]; referenceDate: string }) {
  return (
    <Card>
      <CardHeader title="Pending tasks" description="Ordered by due date" />
      {tasks.length === 0 ? (
        <EmptyState title="No pending tasks" description="Follow-ups for shipments, documents and invoices will appear here." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {tasks.map((task) => {
            const overdue = task.dueAt < referenceDate;
            const days = daysBetween(referenceDate, task.dueAt);
            return (
              <li key={task.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                <ClockIcon className={`mt-0.5 size-4 shrink-0 ${overdue ? 'text-red-600' : 'text-slate-400'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{task.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span>{task.assignee}</span>
                    <span aria-hidden="true">·</span>
                    <span className={overdue ? 'font-medium text-red-700' : undefined}>
                      {overdue ? 'Overdue' : days <= 0 ? 'Due today' : `Due in ${days} day${days === 1 ? '' : 's'}`} (
                      {formatDateTime(task.dueAt)})
                    </span>
                    {task.shipmentReference && (
                      <>
                        <span aria-hidden="true">·</span>
                        <Link href={`/shipments/${task.shipmentReference}`} className={linkClass}>
                          {task.shipmentReference}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <StatusBadge meta={severityMeta[task.priority]} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <Card>
      <CardHeader title="Recent activity" description="Latest updates across shipments and finance" />
      {items.length === 0 ? (
        <EmptyState title="No recent activity" />
      ) : (
        <ol className="flex flex-col px-4 py-3 sm:px-5">
          {items.map((item, index) => (
            <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
              {index < items.length - 1 && (
                <span className="absolute top-3 left-[5px] h-full w-px bg-slate-200" aria-hidden="true" />
              )}
              <span className="relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-white bg-blue-700 ring-1 ring-slate-300" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm text-slate-800">{item.message}</p>
                <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-slate-500">
                  <time dateTime={item.at}>{formatDateTime(item.at)}</time>
                  <span aria-hidden="true">·</span>
                  <span>{item.actor}</span>
                  {item.shipmentReference && (
                    <>
                      <span aria-hidden="true">·</span>
                      <Link href={`/shipments/${item.shipmentReference}`} className={linkClass}>
                        {item.shipmentReference}
                      </Link>
                    </>
                  )}
                  {item.quotationReference && (
                    <>
                      <span aria-hidden="true">·</span>
                      <Link href={`/quotations/${item.quotationReference}`} className={linkClass}>
                        {item.quotationReference}
                      </Link>
                    </>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function IntegrationSummary() {
  const rows = [
    { name: 'Backend API', state: 'Health check only', tone: 'info' as const, note: 'GET /health is live. No freight endpoints exist yet.' },
    { name: 'KRA iCMS', state: 'Pending', tone: 'neutral' as const, note: 'Not integrated. Access and onboarding status unknown.' },
    { name: 'M-Pesa', state: 'Pending', tone: 'neutral' as const, note: 'Not integrated. Payments shown are demo records.' },
    { name: 'Sign-in & roles', state: 'Not built', tone: 'warning' as const, note: 'No authentication or access control yet.' },
  ];
  return (
    <Card>
      <CardHeader title="Integrations" action={{ href: '/settings', label: 'Details' }} />
      <ul className="divide-y divide-slate-100">
        {rows.map((row) => (
          <li key={row.name} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
            <div>
              <p className="text-sm font-medium text-slate-900">{row.name}</p>
              <p className="text-xs text-slate-500">{row.note}</p>
            </div>
            <Badge tone={row.tone}>{row.state}</Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}
