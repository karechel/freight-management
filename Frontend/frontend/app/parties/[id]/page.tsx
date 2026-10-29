import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PartyDetailView } from '@/components/parties/party-detail-view';
import { DEMO_REFERENCE_DATE, getInvoices, getParty, getPayments } from '@/lib/data';

// Next.js passes `params` already URL-decoded, so they are used as-is.
// Parties are not editable in the session, so an unknown id is a real 404.

export async function generateMetadata({ params }: PageProps<'/parties/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const party = await getParty(id);
  return { title: party.data?.name ?? 'Party not found' };
}

export default async function PartyPage({ params }: PageProps<'/parties/[id]'>) {
  const { id } = await params;
  const party = await getParty(id);
  if (!party.data) notFound();
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
