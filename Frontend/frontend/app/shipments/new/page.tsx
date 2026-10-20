import type { Metadata } from 'next';
import { NewShipmentView } from '@/components/shipments/new-shipment-view';
import { getShipmentFormOptions } from '@/lib/data';

export const metadata: Metadata = { title: 'New shipment' };

export default async function NewShipmentPage({ searchParams }: PageProps<'/shipments/new'>) {
  const [options, params] = await Promise.all([getShipmentFormOptions(), searchParams]);
  const quotation = typeof params.quotation === 'string' ? params.quotation.slice(0, 40) : undefined;
  return <NewShipmentView options={options.data} source={options.source} quotationReference={quotation} />;
}
