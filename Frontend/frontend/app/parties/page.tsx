import type { Metadata } from 'next';
import { PartyTable } from '@/components/parties/party-table';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { DataSourceNotice, EmptyState, PendingNotice } from '@/components/ui/states';
import { getParties } from '@/lib/data';
import type { PartyType } from '@/lib/types';

export const metadata: Metadata = { title: 'Customers & agents' };

const sections: { type: PartyType; title: string; description: string }[] = [
  { type: 'customer', title: 'Customers', description: 'Importers and exporters we forward and clear for' },
  { type: 'agent', title: 'Freight agents', description: 'Overseas and regional partner agents' },
  { type: 'supplier', title: 'Carriers and suppliers', description: 'Shipping lines, airlines and service providers' },
  { type: 'transporter', title: 'Transporters', description: 'Road haulage partners' },
];

export default async function PartiesPage() {
  const parties = await getParties();
  return (
    <>
      <PageHeader
        title="Customers & agents"
        description="Customers, freight agents, carriers and transporters involved in shipments."
      />
      <DataSourceNotice source={parties.source}>
        Contact emails use the reserved .example domain. Select a name for billing, service history, routes and related jobs.
      </DataSourceNotice>
      <div className="mb-6">
        <PendingNotice title="Customer and agent portals are planned">
          External users cannot sign in yet. Portals need authentication and role-based access control on the backend first.
        </PendingNotice>
      </div>
      <div className="flex flex-col gap-6">
        {sections.map((section) => {
          const rows = parties.data.filter((p) => p.type === section.type);
          return (
            <Card key={section.type}>
              <CardHeader title={section.title} description={section.description} />
              {rows.length ? (
                <PartyTable parties={rows} type={section.type} />
              ) : (
                <EmptyState title={`No ${section.title.toLowerCase()} recorded`} />
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
