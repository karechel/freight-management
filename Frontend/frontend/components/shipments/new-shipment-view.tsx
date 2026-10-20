'use client';

import { PageHeader } from '@/components/ui/page-header';
import { DataSourceNotice, PendingNotice, RecordNotFound, SESSION_EDIT_NOTE } from '@/components/ui/states';
import type { ShipmentFormOptions } from '@/lib/data';
import { useSessionQuotation } from '@/lib/data/session-store';
import { quotationStatusMeta } from '@/lib/labels';
import type { DataSource } from '@/lib/types';
import { ShipmentForm } from './shipment-form';

const quotationHref = (reference: string) => `/quotations/${encodeURIComponent(reference)}`;

export function NewShipmentView({
  options,
  source,
  quotationReference,
}: {
  options: ShipmentFormOptions;
  source: DataSource;
  /** `?quotation=` — convert this accepted quotation into the new shipment. */
  quotationReference?: string;
}) {
  const quotation = useSessionQuotation(quotationReference ?? '');
  if (quotationReference && !quotation) {
    return <RecordNotFound title={`Quotation ${quotationReference} was not found`} backHref="/quotations" backLabel="All quotations" />;
  }
  const convertible = quotation?.status === 'accepted';
  return (
    <>
      <PageHeader
        title={quotation ? `New shipment from ${quotation.reference}` : 'New shipment'}
        description="Open a new sea, air, road or rail job. Fields marked * are required."
        back={quotation ? { href: quotationHref(quotation.reference), label: 'Back to quotation' } : { href: '/shipments', label: 'All shipments' }}
      />
      <DataSourceNotice source={source}>{SESSION_EDIT_NOTE}</DataSourceNotice>
      {quotation && !convertible ? (
        <PendingNotice title="This quotation cannot be converted">
          Only accepted quotations can be converted. {quotation.reference} is &quot;
          {quotationStatusMeta[quotation.status].label}&quot;
          {quotation.shipmentReference ? ` and is already linked to ${quotation.shipmentReference}` : ''}.
        </PendingNotice>
      ) : (
        <>
          {quotation && (
            <div className="mb-6">
              <PendingNotice title={`Prefilled from ${quotation.reference}`}>
                Customer, route, mode, direction, cargo and agent come from the quotation. Enter the carrier, equipment,
                packages, weight and dates. Saving marks the quotation as booked and links it to the new shipment.
              </PendingNotice>
            </div>
          )}
          <ShipmentForm options={options} fromQuotation={convertible ? quotation : undefined} />
        </>
      )}
    </>
  );
}
