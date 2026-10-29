import type { Metadata } from 'next';
import { ShipmentEditView } from '@/components/shipments/shipment-edit-view';
import { getShipmentFormOptions } from '@/lib/data';

// Next.js passes `params` already URL-decoded, so they are used as-is.

export async function generateMetadata({ params }: PageProps<'/shipments/[reference]/edit'>): Promise<Metadata> {
  const { reference } = await params;
  return { title: `Edit shipment ${reference}` };
}

export default async function EditShipmentPage({ params }: PageProps<'/shipments/[reference]/edit'>) {
  const [{ reference }, options] = await Promise.all([params, getShipmentFormOptions()]);
  return <ShipmentEditView reference={reference} options={options.data} source={options.source} />;
}
