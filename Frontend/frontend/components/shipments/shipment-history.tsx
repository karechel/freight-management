import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/states';
import { formatDateTime } from '@/lib/format';
import type { StatusMeta } from '@/lib/labels';
import type { QuotationEventKind, ShipmentEventKind } from '@/lib/types';

interface HistoryEvent<K extends string> {
  id: string;
  at: string;
  actor: string;
  kind: K;
  message: string;
}

/** Change history, oldest first, with a badge per kind of change. */
export function EventHistory<K extends string>({
  events,
  kindMeta,
  emptyDescription,
}: {
  events: HistoryEvent<K>[];
  kindMeta: Record<K, StatusMeta>;
  emptyDescription: string;
}) {
  if (events.length === 0) {
    return <EmptyState title="No changes recorded in this session" description={emptyDescription} />;
  }
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <ol className="divide-y divide-slate-100">
      {sorted.map((e) => (
        <li key={e.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-3 sm:px-5">
          <span className="w-20 shrink-0">
            <Badge tone={kindMeta[e.kind].tone}>{kindMeta[e.kind].label}</Badge>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-800">{e.message}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              <time dateTime={e.at}>{formatDateTime(e.at)}</time> · {e.actor}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

const shipmentKindMeta: Record<ShipmentEventKind, StatusMeta> = {
  created: { label: 'Created', tone: 'success' },
  updated: { label: 'Updated', tone: 'neutral' },
  status_changed: { label: 'Status', tone: 'info' },
  milestone_updated: { label: 'Milestone', tone: 'progress' },
  delay_recorded: { label: 'Delay', tone: 'warning' },
  delay_updated: { label: 'Delay', tone: 'warning' },
  expense: { label: 'Expense', tone: 'neutral' },
  document: { label: 'Document', tone: 'neutral' },
};

export const quotationKindMeta: Record<QuotationEventKind, StatusMeta> = {
  created: { label: 'Created', tone: 'success' },
  duplicated: { label: 'Copied', tone: 'success' },
  updated: { label: 'Updated', tone: 'neutral' },
  status_changed: { label: 'Status', tone: 'info' },
  linked: { label: 'Booking', tone: 'progress' },
};

export function ShipmentHistory({ events }: { events: HistoryEvent<ShipmentEventKind>[] }) {
  return (
    <EventHistory
      events={events}
      kindMeta={shipmentKindMeta}
      emptyDescription="Status changes, edits, milestone updates and delays made in this tab appear here. Earlier history is not part of the demo data."
    />
  );
}
