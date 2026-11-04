import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CustomerForm } from '@/components/customers/customer-form';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { getCurrentUser, serverGet } from '@/lib/api/server';
import { BILLING_MANAGE, isLiveCustomerId, PARTIES_MANAGE, STATUS_MANAGE, type CustomerDetail } from '@/lib/customers';

export const metadata: Metadata = { title: 'Edit customer' };

export default async function EditCustomerPage({ params }: PageProps<'/parties/[id]/edit'>) {
  const { id } = await params;
  if (!isLiveCustomerId(id)) notFound();
  const returnTo = `/parties/${id}/edit`;
  const [customer, user] = await Promise.all([
    serverGet<CustomerDetail>(`parties/${id}`, returnTo),
    getCurrentUser(returnTo),
  ]);
  if (!customer.ok && customer.status === 404) notFound();

  const back = { href: `/parties/${id}`, label: customer.ok ? customer.data.name : 'Customer' };
  const permissions = user.ok ? user.data.permissions : [];
  const access = {
    details: permissions.includes(PARTIES_MANAGE),
    billing: permissions.includes(BILLING_MANAGE),
    status: permissions.includes(STATUS_MANAGE),
  };

  let problem: { title: string; description?: string } | undefined;
  if (!customer.ok) problem = { title: 'This customer could not be loaded', description: customer.message };
  else if (!access.details && !access.billing && !access.status) problem = { title: 'You cannot edit customers' };
  else if (customer.data.archivedAt) {
    problem = { title: 'This customer is archived', description: 'Restore them before making changes.' };
  }

  if (problem || !customer.ok) {
    return (
      <>
        <PageHeader title="Edit customer" back={back} />
        <Card>
          <ErrorState title={problem?.title ?? 'This customer could not be loaded'} description={problem?.description}>
            <ButtonLink href={back.href} variant="secondary" size="sm">
              Back to the customer
            </ButtonLink>
          </ErrorState>
        </Card>
      </>
    );
  }
  return (
    <>
      <PageHeader title={`Edit ${customer.data.name}`} back={back} />
      <CustomerForm customer={customer.data} access={access} />
    </>
  );
}
