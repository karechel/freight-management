'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { inputClass } from '@/components/ui/form';
import { EmptyState } from '@/components/ui/states';
import { useSessionStore } from '@/lib/data/session-store';
import { severityMeta } from '@/lib/labels';
import { notificationKindLabel, notificationKinds, taskPrefillQuery, type NotificationKind } from '@/lib/notifications';
import { RecordLinks } from './record-links';

const smallAction =
  'rounded px-1.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-50 hover:text-blue-900 focus-visible:outline-2 focus-visible:outline-blue-600';

export function NotificationList() {
  const { notifications, readNotificationIds, setNotificationsRead } = useSessionStore();
  const [kind, setKind] = useState<'' | NotificationKind>('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const visible = notifications.filter((n) => (!kind || n.kind === kind) && (!unreadOnly || !readNotificationIds.has(n.id)));
  const unreadVisible = visible.filter((n) => !readNotificationIds.has(n.id));
  const countByKind = (k: NotificationKind) => notifications.filter((n) => n.kind === k).length;

  return (
    <Card>
      <CardHeader
        title="Notifications"
        description="Calculated from the current records. Each one clears itself when its cause is resolved."
      >
        <Button variant="secondary" size="sm" disabled={unreadVisible.length === 0} onClick={() => setNotificationsRead(unreadVisible.map((n) => n.id), true)}>
          Mark all as read
        </Button>
      </CardHeader>
      <CardBody className="grid grid-cols-1 gap-3 border-b border-slate-200 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="notification-kind" className="text-xs font-medium text-slate-600">
            Type
          </label>
          <select id="notification-kind" value={kind} onChange={(e) => setKind(e.target.value as '' | NotificationKind)} className={`${inputClass} w-full`}>
            <option value="">All types ({notifications.length})</option>
            {notificationKinds.map((k) => (
              <option key={k} value={k}>
                {notificationKindLabel[k]} ({countByKind(k)})
              </option>
            ))}
          </select>
        </div>
        <label className="flex h-9 items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="size-4 rounded border-slate-300 accent-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          />
          Unread only
        </label>
      </CardBody>
      <p className="sr-only" role="status">
        {visible.length} notifications shown, {unreadVisible.length} unread
      </p>
      {visible.length === 0 ? (
        <EmptyState
          title={notifications.length === 0 ? 'No notifications' : 'No notifications match these filters'}
          description={unreadOnly ? 'Everything shown here has been read.' : undefined}
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {visible.map((n) => {
            const read = readNotificationIds.has(n.id);
            return (
              <li key={n.id} className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5 ${read ? '' : 'bg-blue-50/40'}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {!read && (
                      <span className="size-2 rounded-full bg-blue-600" aria-hidden="true" />
                    )}
                    <Link href={n.href} className="rounded text-sm font-medium text-slate-900 hover:text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">
                      {n.title}
                    </Link>
                    {!read && <span className="sr-only">(unread)</span>}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">{n.detail}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{notificationKindLabel[n.kind]}</Badge>
                    <StatusBadge meta={severityMeta[n.severity]} />
                    <RecordLinks links={n.links} />
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1 sm:justify-end">
                  <Link href={`/notifications/tasks/new?${taskPrefillQuery(n)}`} className={smallAction}>
                    Create task<span className="sr-only"> for {n.title}</span>
                  </Link>
                  <button type="button" className={smallAction} onClick={() => setNotificationsRead([n.id], !read)}>
                    {read ? 'Mark unread' : 'Mark read'}
                    <span className="sr-only"> {n.title}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
