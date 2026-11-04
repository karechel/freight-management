import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CustomerDetailView } from '@/components/customers/customer-detail-view';
import { PartyDetailView } from '@/components/parties/party-detail-view';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { getCurrentUser, serverGet } from '@/lib/api/server';
import { BILLING_MANAGE, isLiveCustomerId, PARTIES_MANAGE, STATUS_MANAGE, type CustomerDetail } from '@/lib/customers';
import { DEMO_REFERENCE_DATE, getInvoices, getParty, getPayments } from '@/lib/data';

// Next.js passes `params` already URL-decoded, so they are used as-is.
// Numeric ids are live customers. Other ids, such as "c-001", are the demo records
// that demo shipments and quotations still link to until those pages go live.

export async function generateMetadata({ params }: PageProps<'/parties/[id]'>): Promise<Metadata> {
  const { id } = await params;
  if (isLiveCustomerId(id)) {
    const customer = await serverGet<CustomerDetail>(`parties/${id}`, `/parties/${id}`);
    return { title: customer.ok ? customer.data.name : 'Customer' };
  }
  const party = await getParty(id);
  return { title: party.data?.name ?? 'Party not found' };
}

async function LiveCustomerPage({ id }: { id: string }) {
  const returnTo = `/parties/${id}`;
  const [customer, user] = await Promise.all([
    serverGet<CustomerDetail>(`parties/${id}`, returnTo),
    getCurrentUser(returnTo),
  ]);
  if (!customer.ok) {
    if (customer.status === 404) notFound();
    return (
      <>
        <PageHeader title="Customer" back={{ href: '/parties', label: 'Customers' }} />
        <Card>
          <ErrorState
            title={customer.status === 403 ? 'You do not have access to customers' : 'This customer could not be loaded'}
            description={customer.status === 403 ? 'Ask an administrator if you need access.' : customer.message}
          />
        </Card>
      </>
    );
  }
  const permissions = user.ok ? user.data.permissions : [];
  return (
    <CustomerDetailView
      customer={customer.data}
      canManage={permissions.includes(PARTIES_MANAGE)}
      canEdit={[PARTIES_MANAGE, BILLING_MANAGE, STATUS_MANAGE].some((code) => permissions.includes(code))}
    />
  );
}

export default async function PartyPage({ params }: PageProps<'/parties/[id]'>) {
  const { id } = await params;
  if (isLiveCustomerId(id)) return <LiveCustomerPage id={id} />;

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
