import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PartyDetailView } from '@/components/parties/party-detail-view';
import { DEMO_REFERENCE_DATE, getInvoices, getParty, getPayments } from '@/lib/data';

// Agents, carriers and transporters. Customers live under /parties/[id]; the
// older /parties/[id] links for agents keep working too.

export async function generateMetadata({ params }: PageProps<'/agents/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const party = await getParty(id);
  return { title: party.data && party.data.type !== 'customer' ? party.data.name : 'Partner not found' };
}

export default async function AgentPage({ params }: PageProps<'/agents/[id]'>) {
  const { id } = await params;
  const party = await getParty(id);
  if (!party.data || party.data.type === 'customer') notFound();
  const [invoices, payments] = await Promise.all([getInvoices(), getPayments()]);
  return (
    <PartyDetailView
      party={party.data}
      invoices={invoices.data}
      payments={payments.data}
      referenceDate={DEMO_REFERENCE_DATE}
      source={party.source}
    />
  );
}
