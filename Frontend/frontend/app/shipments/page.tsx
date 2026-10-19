import type { Metadata } from 'next';
import { ShipmentExplorer, type ShipmentFilters } from '@/components/shipments/shipment-explorer';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { DataSourceNotice } from '@/components/ui/states';
import { DEMO_REFERENCE_DATE, getShipments } from '@/lib/data';
import { modeLabel } from '@/lib/labels';
import { shipmentViewLabel } from '@/lib/metrics';

export const metadata: Metadata = { title: 'Shipments' };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(params: Record<string, string | string[] | undefined>): Partial<ShipmentFilters> {
  const view = first(params.view);
  const mode = first(params.mode);
  const query = first(params.q);
  return {
    // Object.hasOwn, not `in`, so inherited keys such as "toString" are rejected.
    view: view && Object.hasOwn(shipmentViewLabel, view) ? (view as ShipmentFilters['view']) : undefined,
    mode: mode && Object.hasOwn(modeLabel, mode) ? (mode as ShipmentFilters['mode']) : undefined,
    query: query?.slice(0, 100),
  };
}

export default async function ShipmentsPage({ searchParams }: PageProps<'/shipments'>) {
  const [shipments, params] = await Promise.all([getShipments(), searchParams]);
  return (
    <>
      <PageHeader
        title="Shipments"
        description="Sea, air, road and rail jobs with their current stage, customs status and exceptions."
      />
      <DataSourceNotice source={shipments.source}>
        Creating or editing shipments needs backend endpoints that do not exist yet.
      </DataSourceNotice>
      <Card>
        <ShipmentExplorer
          shipments={shipments.data}
          referenceDate={DEMO_REFERENCE_DATE}
          initialFilters={parseFilters(params)}
          syncUrl
        />
      </Card>
    </>
  );
}
