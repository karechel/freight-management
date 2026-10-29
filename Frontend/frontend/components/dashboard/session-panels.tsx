'use client';

// Dashboard panels computed from the session's shipment and document records, so they agree
// with the shipment list and detail pages after edits made in this tab.

import { AlertIcon, BoxIcon, ClockIcon, FileIcon, ReceiptIcon, ShieldIcon } from '@/components/ui/icons';
import { KpiCard } from '@/components/ui/kpi-card';
import { useSessionStore } from '@/lib/data/session-store';
import { formatKes } from '@/lib/format';
import { countByStatus, isActive, isArrivingSoon, isDelayed, isInCustoms, needsAttention, outstandingDocuments } from '@/lib/metrics';
import { ActivityFeed, StatusBreakdown } from './panels';

interface DashboardKpisProps {
  referenceDate: string;
  receivables: { outstandingKes: number; overdueKes: number; overdueCount: number };
}

export function DashboardKpis({ referenceDate, receivables }: DashboardKpisProps) {
  const { shipments, documents } = useSessionStore();
  const documentsOutstanding = outstandingDocuments(documents).length;
  const active = shipments.filter(isActive);
  const inCustoms = shipments.filter(isInCustoms);
  const arriving = shipments.filter((s) => isArrivingSoon(s, referenceDate));
  const attention = shipments.filter(needsAttention);
  const delayed = shipments.filter(isDelayed);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <KpiCard
        label="Active shipments"
        value={String(active.length)}
        detail={`${shipments.length - active.length} delivered`}
        href="/shipments?view=active"
        icon={<BoxIcon className="size-4" />}
      />
      <KpiCard
        label="In customs clearance"
        value={String(inCustoms.length)}
        detail="Entries lodged, assessed, queried or awaiting documents"
        href="/shipments?view=customs"
        icon={<ShieldIcon className="size-4" />}
      />
      <KpiCard
        label="Arriving in 7 days"
        value={String(arriving.length)}
        detail="Booked or in transit with current ETA this week"
        href="/shipments?view=arriving"
        icon={<ClockIcon className="size-4" />}
      />
      <KpiCard
        label="Needs attention"
        value={String(attention.length)}
        detail={`On hold, customs query, open exception or delay (${delayed.length} delayed)`}
        href="/shipments?view=attention"
        icon={<AlertIcon className="size-4" />}
        attention={attention.length > 0 ? 'danger' : undefined}
      />
      <KpiCard
        label="Documents outstanding"
        value={String(documentsOutstanding)}
        detail="Missing or rejected shipping documents"
        href="/documents?status=outstanding"
        icon={<FileIcon className="size-4" />}
        attention={documentsOutstanding > 0 ? 'warning' : undefined}
      />
      <KpiCard
        label="Outstanding receivables"
        value={formatKes(receivables.outstandingKes)}
        detail={`${receivables.overdueCount} overdue invoice${receivables.overdueCount === 1 ? '' : 's'} (${formatKes(receivables.overdueKes)})`}
        href="/finance"
        icon={<ReceiptIcon className="size-4" />}
        attention={receivables.overdueCount > 0 ? 'warning' : undefined}
      />
    </div>
  );
}

export function SessionStatusBreakdown() {
  const { shipments } = useSessionStore();
  return <StatusBreakdown counts={countByStatus(shipments)} />;
}

export function SessionActivityFeed({ limit = 10 }: { limit?: number }) {
  const { activity } = useSessionStore();
  return <ActivityFeed items={activity.slice(0, limit)} />;
}
