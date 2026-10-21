import type { Metadata } from 'next';
import { ShipmentCostsCard } from '@/components/expenses/shipment-costs-card';
import { ShipmentDetailView } from '@/components/shipments/shipment-detail-view';
import { getInvoices, getShipmentFormOptions } from '@/lib/data';

// Next.js passes `params` already URL-decoded, so they are used as-is.
// The shipment itself is read from the browser session store by
// ShipmentDetailView (it may have been created or edited in this tab), as are
// its documents and expenses; invoices are not editable yet and are loaded here.

export async function generateMetadata({ params }: PageProps<'/shipments/[reference]'>): Promise<Metadata> {
  const { reference } = await params;
  return { title: `Shipment ${reference}` };
}

async function ShipmentRecords({ reference }: { reference: string }) {
  const invoices = await getInvoices(reference);
  return <ShipmentCostsCard reference={reference} invoices={invoices.data} />;
}

export default async function ShipmentDetailPage({ params }: PageProps<'/shipments/[reference]'>) {
  const [{ reference }, options] = await Promise.all([params, getShipmentFormOptions()]);
  return (
    <ShipmentDetailView
      reference={reference}
      options={options.data}
      source={options.source}
      records={<ShipmentRecords reference={reference} />}
    />
  );
}
