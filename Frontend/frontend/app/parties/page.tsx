import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { DataSourceNotice, EmptyState, PendingNotice } from '@/components/ui/states';
import { Table, Td, Th } from '@/components/ui/table';
import { getParties } from '@/lib/data';
import { formatKes } from '@/lib/format';
import { partyTypeLabel } from '@/lib/labels';
import type { Party, PartyType } from '@/lib/types';

export const metadata: Metadata = { title: 'Customers & agents' };

const sections: { type: PartyType; title: string; description: string }[] = [
  { type: 'customer', title: 'Customers', description: 'Importers and exporters we forward and clear for' },
  { type: 'agent', title: 'Freight agents', description: 'Overseas and regional partner agents' },
  { type: 'supplier', title: 'Carriers and suppliers', description: 'Shipping lines, airlines and service providers' },
  { type: 'transporter', title: 'Transporters', description: 'Road haulage partners' },
];

function PartyTable({ parties, type }: { parties: Party[]; type: PartyType }) {
  const showBalance = type === 'customer';
  return (
    <Table caption={partyTypeLabel[type]}>
      <thead>
        <tr>
          <Th>Name</Th>
          <Th>Location</Th>
          <Th>Contact</Th>
          <Th className="text-right">Active shipments</Th>
          {showBalance && <Th className="text-right">Outstanding</Th>}
        </tr>
      </thead>
      <tbody>
        {parties.map((p) => (
          <tr key={p.id} className="hover:bg-slate-50">
            <Td className="font-medium text-slate-900">{p.name}</Td>
            <Td>{p.location}</Td>
            <Td>
              <p>{p.contactName}</p>
              <p className="text-xs text-slate-500">{p.email}</p>
            </Td>
            <Td className="text-right tabular-nums">{p.activeShipments}</Td>
            {showBalance && (
              <Td className="text-right tabular-nums">
                {p.outstandingKes ? formatKes(p.outstandingKes) : <Badge tone="success">Settled</Badge>}
              </Td>
            )}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export default async function PartiesPage() {
  const parties = await getParties();
  return (
    <>
      <PageHeader
        title="Customers & agents"
        description="Customers, freight agents, carriers and transporters involved in shipments."
      />
      <DataSourceNotice source={parties.source}>Contact emails use the reserved .example domain.</DataSourceNotice>
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
