import type { Metadata } from 'next';
import { DemoPageMarker } from '@/components/layout/page-source';
import { LiveShipmentForm } from '@/components/shipments/live-shipment-form';
import { ShipmentEditView } from '@/components/shipments/shipment-edit-view';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { getCurrentUser, serverGet } from '@/lib/api/server';
import { getShipmentFormChoices } from '@/lib/api/shipment-options';
import { getShipmentFormOptions } from '@/lib/data';
import { liveShipmentHref, SHIPMENTS_MANAGE, type LiveShipment } from '@/lib/live-shipments';

// Next.js passes `params` already URL-decoded, so they are used as-is.
// A reference the backend does not know opens the demo edit page (browser session only).

export async function generateMetadata({ params }: PageProps<'/shipments/[reference]/edit'>): Promise<Metadata> {
  const { reference } = await params;
  return { title: `Edit shipment ${reference}` };
}

export default async function EditShipmentPage({ params }: PageProps<'/shipments/[reference]/edit'>) {
  const { reference } = await params;
  const returnTo = `/shipments/${encodeURIComponent(reference)}/edit`;
  const [shipment, user] = await Promise.all([
    serverGet<LiveShipment>(`shipments/${encodeURIComponent(reference)}`, returnTo),
    getCurrentUser(returnTo),
  ]);
  if (!shipment.ok && shipment.status === 404) {
    const options = await getShipmentFormOptions();
    return (
      <>
        <DemoPageMarker />
        <ShipmentEditView reference={reference} options={options.data} source={options.source} />
      </>
    );
  }
  const back = { href: liveShipmentHref(reference), label: `Shipment ${reference}` };
  const canManage = user.ok && user.data.permissions.includes(SHIPMENTS_MANAGE);
  const choices = shipment.ok && canManage ? await getShipmentFormChoices(returnTo) : undefined;
  if (!shipment.ok || !canManage || !choices?.ok) {
    return (
      <>
        <PageHeader title={`Edit shipment ${reference}`} back={back} />
        <Card>
          <ErrorState
            title={!canManage ? 'You cannot edit shipments' : 'This shipment could not be loaded'}
            description={
              !canManage
                ? 'Operations staff and administrators edit shipments.'
                : !shipment.ok
                  ? shipment.message
                  : choices && !choices.ok
                    ? choices.message
                    : 'Try again.'
            }
          />
        </Card>
      </>
    );
  }
  return (
    <>
      <PageHeader title={`Edit shipment ${reference}`} description={`${shipment.data.customer.name} · ${shipment.data.origin} → ${shipment.data.destination}`} back={back} />
      <LiveShipmentForm shipment={shipment.data} choices={choices.data} />
    </>
  );
}
