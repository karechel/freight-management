import type { Metadata } from 'next';
import { CustomerForm } from '@/components/customers/customer-form';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { getCurrentUser } from '@/lib/api/server';
import { BILLING_MANAGE, PARTIES_MANAGE, STATUS_MANAGE } from '@/lib/customers';

export const metadata: Metadata = { title: 'New customer' };

export default async function NewCustomerPage() {
  const user = await getCurrentUser('/parties/new');
  const permissions = user.ok ? user.data.permissions : [];
  const back = { href: '/parties', label: 'Customers' };

  if (!permissions.includes(PARTIES_MANAGE)) {
    return (
      <>
        <PageHeader title="New customer" back={back} />
        <Card>
          <ErrorState
            title={user.ok ? 'You cannot create customers' : 'This page could not be loaded'}
            description={user.ok ? 'Ask an administrator if you need to.' : user.message}
          />
        </Card>
      </>
    );
  }
  return (
    <>
      <PageHeader title="New customer" back={back} />
      <CustomerForm access={{ details: true, billing: permissions.includes(BILLING_MANAGE), status: permissions.includes(STATUS_MANAGE) }} />
    </>
  );
}
