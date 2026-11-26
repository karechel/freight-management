import type { Metadata } from 'next';
import { ShipmentCostsCard } from '@/components/expenses/shipment-costs-card';
import { DemoPageMarker } from '@/components/layout/page-source';
import { LiveShipmentDetail } from '@/components/shipments/live-shipment-detail';
import { ShipmentDetailView } from '@/components/shipments/shipment-detail-view';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { getCurrentUser, serverGet } from '@/lib/api/server';
import { getShipmentStaff } from '@/lib/api/shipment-options';
import { getInvoices, getShipmentFormOptions } from '@/lib/data';
import { SHIPMENTS_MANAGE, type LiveShipment } from '@/lib/live-shipments';

// Next.js passes `params` already URL-decoded, so they are used as-is.
// Live shipments come from the backend (Phase 3). A reference the backend does not know opens the
// demo record from the browser session, which demo pages still link to.

export async function generateMetadata({ params }: PageProps<'/shipments/[reference]'>): Promise<Metadata> {
  const { reference } = await params;
  return { title: `Shipment ${reference}` };
}

async function ShipmentRecords({ reference }: { reference: string }) {
  const invoices = await getInvoices(reference);
  return <ShipmentCostsCard reference={reference} invoices={invoices.data} />;
}

async function DemoShipmentPage({ reference }: { reference: string }) {
  const options = await getShipmentFormOptions();
  return (
    <>
      <DemoPageMarker />
      <ShipmentDetailView reference={reference} options={options.data} source={options.source} records={<ShipmentRecords reference={reference} />} />
    </>
  );
}

export default async function ShipmentDetailPage({ params }: PageProps<'/shipments/[reference]'>) {
  const { reference } = await params;
  const returnTo = `/shipments/${encodeURIComponent(reference)}`;
  const [shipment, user] = await Promise.all([
    serverGet<LiveShipment>(`shipments/${encodeURIComponent(reference)}`, returnTo),
    getCurrentUser(returnTo),
  ]);
  if (!shipment.ok) {
    if (shipment.status === 404) return <DemoShipmentPage reference={reference} />;
    return (
      <>
        <PageHeader title={`Shipment ${reference}`} back={{ href: '/shipments', label: 'All shipments' }} />
        <Card>
          <ErrorState
            title={shipment.status === 403 ? 'You do not have access to shipments' : 'This shipment could not be loaded'}
            description={shipment.status === 403 ? 'Ask an administrator if you need access.' : shipment.message}
          />
        </Card>
      </>
    );
  }
  const canManage = user.ok && user.data.permissions.includes(SHIPMENTS_MANAGE);
  const staff = canManage ? await getShipmentStaff(returnTo) : [];
  return <LiveShipmentDetail shipment={shipment.data} canManage={canManage} staff={staff} />;
}
