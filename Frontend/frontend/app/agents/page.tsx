import type { Metadata } from 'next';
import { PartyTable } from '@/components/parties/party-table';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { DataSourceNotice, EmptyState, PendingNotice } from '@/components/ui/states';
import { getParties } from '@/lib/data';
import { routeLabel } from '@/lib/labels';
import type { PartyType } from '@/lib/types';

export const metadata: Metadata = { title: 'Agents & partners' };

// The same records also appear on the Customers & agents page, which stays a single page.
const sections: { type: PartyType; title: string; description: string }[] = [
  { type: 'agent', title: 'Freight agents', description: 'Overseas and regional partner agents' },
  { type: 'supplier', title: 'Carriers and suppliers', description: 'Shipping lines, airlines and service providers' },
  { type: 'transporter', title: 'Transporters', description: 'Road haulage partners' },
];

export default async function AgentsPage() {
  const parties = await getParties();
  const agents = parties.data.filter((p) => p.type === 'agent');
  const routes = agents.flatMap((a) => (a.routes ?? []).map((r) => ({ ...r, agent: a.name })));
  return (
    <>
      <PageHeader
        title="Agents & partners"
        description="Freight agents, carriers and transporters we work with, and the lanes agents handle."
      />
      <DataSourceNotice source={parties.source}>
        Contact emails use the reserved .example domain. Select a name for routes, related jobs and invoices.
      </DataSourceNotice>
      <div className="mb-6">
        <PendingNotice title="Agent portal is planned">
          Agents cannot sign in yet. The portal needs authentication and role-based access control on the backend first.
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
        <Card>
          <CardHeader
            title="Agent routes"
            description="Derived from the demo jobs each agent handles. Not an agreement or a rate card."
          />
          {routes.length ? (
            <ul className="divide-y divide-slate-100">
              {routes.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 sm:px-5">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{routeLabel(r)}</p>
                    <p className="text-xs text-slate-500">{r.services}</p>
                  </div>
                  <p className="text-sm text-slate-700">{r.agent}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No routes recorded" />
          )}
        </Card>
      </div>
    </>
  );
}
