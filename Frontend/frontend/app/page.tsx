import { ActivityFeed, IntegrationSummary, StatusBreakdown, TaskList } from '@/components/dashboard/panels';
import { ShipmentExplorer } from '@/components/shipments/shipment-explorer';
import { Card, CardHeader } from '@/components/ui/card';
import { AlertIcon, BoxIcon, ClockIcon, FileIcon, ReceiptIcon, ShieldIcon } from '@/components/ui/icons';
import { KpiCard } from '@/components/ui/kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { DataSourceNotice } from '@/components/ui/states';
import {
  DEMO_REFERENCE_DATE,
  getDocuments,
  getInvoices,
  getRecentActivity,
  getShipments,
  getTasks,
} from '@/lib/data';
import { formatDate, formatKes } from '@/lib/format';
import {
  countByStatus,
  isActive,
  isArrivingSoon,
  isInCustoms,
  needsAttention,
  outstandingDocuments,
  receivablesSummary,
} from '@/lib/metrics';

export default async function DashboardPage() {
  const [shipments, documents, invoices, activity, tasks] = await Promise.all([
    getShipments(),
    getDocuments(),
    getInvoices(),
    getRecentActivity(),
    getTasks(),
  ]);
  const ref = DEMO_REFERENCE_DATE;
  const all = shipments.data;

  const active = all.filter(isActive);
  const inCustoms = all.filter(isInCustoms);
  const arriving = all.filter((s) => isArrivingSoon(s, ref));
  const attention = all.filter(needsAttention);
  const docsOutstanding = outstandingDocuments(documents.data);
  const receivables = receivablesSummary(invoices.data);
  const anyDemo = [shipments, documents, invoices, activity, tasks].some((r) => r.source === 'demo');

  return (
    <>
      <PageHeader
        title="Operations dashboard"
        description={`Shipments, clearance, documents and receivables at a glance. Figures as at ${formatDate(ref)}.`}
      />
      <DataSourceNotice source={anyDemo ? 'demo' : 'live'}>
        Figures are calculated from the demo records as at a fixed date ({formatDate(ref)}).
      </DataSourceNotice>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Active shipments"
          value={String(active.length)}
          detail={`${all.length - active.length} delivered`}
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
          detail="Booked or in transit with ETA this week"
          href="/shipments?view=arriving"
          icon={<ClockIcon className="size-4" />}
        />
        <KpiCard
          label="Needs attention"
          value={String(attention.length)}
          detail="On hold, customs query or open exception"
          href="/shipments?view=attention"
          icon={<AlertIcon className="size-4" />}
          attention={attention.length > 0 ? 'danger' : undefined}
        />
        <KpiCard
          label="Documents outstanding"
          value={String(docsOutstanding.length)}
          detail="Missing or rejected shipping documents"
          href="/documents?status=outstanding"
          icon={<FileIcon className="size-4" />}
          attention={docsOutstanding.length > 0 ? 'warning' : undefined}
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

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card>
            <CardHeader
              title="Shipments"
              description="Filter by view, mode or search. Select a reference to open the shipment."
              action={{ href: '/shipments', label: 'Open shipments' }}
            />
            <ShipmentExplorer shipments={all} referenceDate={ref} limit={6} />
          </Card>
        </div>
        <StatusBreakdown counts={countByStatus(all)} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <TaskList tasks={tasks.data} referenceDate={ref} />
        </div>
        <IntegrationSummary />
      </div>

      <div className="mt-6">
        <ActivityFeed items={activity.data} />
      </div>
    </>
  );
}
