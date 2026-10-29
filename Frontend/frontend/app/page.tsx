import { AlertsSummary } from '@/components/dashboard/alerts-summary';
import { IntegrationSummary } from '@/components/dashboard/panels';
import { DashboardKpis, SessionActivityFeed, SessionStatusBreakdown } from '@/components/dashboard/session-panels';
import { ShipmentExplorer } from '@/components/shipments/shipment-explorer';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { DataSourceNotice } from '@/components/ui/states';
import { DEMO_REFERENCE_DATE, getDocuments, getInvoices, getShipments, getTasks } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { receivablesSummary } from '@/lib/metrics';

export default async function DashboardPage() {
  // Shipment and document figures and activity come from the session store
  // (seeded in the root layout); the rest from lib/data.
  const [shipments, documents, invoices, tasks] = await Promise.all([
    getShipments(),
    getDocuments(),
    getInvoices(),
    getTasks(),
  ]);
  const ref = DEMO_REFERENCE_DATE;
  const anyDemo = [shipments, documents, invoices, tasks].some((r) => r.source === 'demo');

  return (
    <>
      <PageHeader
        title="Operations dashboard"
        description={`Shipments, clearance, documents and receivables at a glance. Figures as at ${formatDate(ref)}.`}
      />
      <DataSourceNotice source={anyDemo ? 'demo' : 'live'}>
        Figures are calculated from the demo records as at a fixed date ({formatDate(ref)}). Shipment changes made in
        this browser tab are included until the page is reloaded.
      </DataSourceNotice>

      <DashboardKpis
        referenceDate={ref}
        receivables={receivablesSummary(invoices.data)}
      />

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card>
            <CardHeader
              title="Shipments"
              description="Filter by view, mode or search. Select a row to open the shipment."
              action={{ href: '/shipments', label: 'Open shipments' }}
            />
            <ShipmentExplorer referenceDate={ref} limit={6} />
          </Card>
        </div>
        <SessionStatusBreakdown />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <AlertsSummary />
        </div>
        <IntegrationSummary />
      </div>

      <div className="mt-6">
        <SessionActivityFeed />
      </div>
    </>
  );
}
