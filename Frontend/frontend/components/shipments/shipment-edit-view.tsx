'use client';

import { PageHeader } from '@/components/ui/page-header';
import { DataSourceNotice, RecordNotFound, SESSION_EDIT_NOTE } from '@/components/ui/states';
import type { ShipmentFormOptions } from '@/lib/data';
import { useSessionShipment } from '@/lib/data/session-store';
import type { DataSource } from '@/lib/types';
import { ShipmentForm } from './shipment-form';
import { shipmentHref } from './shipment-table';

export function ShipmentEditView({
  reference,
  options,
  source,
}: {
  reference: string;
  options: ShipmentFormOptions;
  source: DataSource;
}) {
  const shipment = useSessionShipment(reference);
  if (!shipment) {
    return <RecordNotFound title={`Shipment ${reference} was not found`} backHref="/shipments" backLabel="All shipments" />;
  }
  return (
    <>
      <PageHeader
        title={`Edit ${shipment.reference}`}
        description={`${shipment.customerName} · ${shipment.cargoDescription}. Fields marked * are required.`}
        back={{ href: shipmentHref(shipment.reference), label: 'Back to shipment' }}
      />
      <DataSourceNotice source={source}>{SESSION_EDIT_NOTE}</DataSourceNotice>
      <ShipmentForm shipment={shipment} options={options} />
    </>
  );
}
