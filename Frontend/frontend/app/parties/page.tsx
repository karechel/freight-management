import type { Metadata } from 'next';
import { CustomerList } from '@/components/customers/customer-list';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState, PendingNotice } from '@/components/ui/states';
import { getCurrentUser, serverGet } from '@/lib/api/server';
import {
  customerApiQuery,
  customerPageQuery,
  parseCustomerFilters,
  PARTIES_MANAGE,
  type CustomerPage,
} from '@/lib/customers';

export const metadata: Metadata = { title: 'Customers' };

export default async function CustomersPage({ searchParams }: PageProps<'/parties'>) {
  const filters = parseCustomerFilters(await searchParams);
  const returnTo = `/parties${customerPageQuery(filters)}`;
  const [user, page] = await Promise.all([
    getCurrentUser(returnTo),
    serverGet<CustomerPage>(`parties?${customerApiQuery(filters)}`, returnTo),
  ]);
  const canManage = user.ok && user.data.permissions.includes(PARTIES_MANAGE);

  return (
    <>
      <PageHeader title="Customers" description="Importers and exporters we forward and clear for.">
        {canManage && <ButtonLink href="/parties/new">New customer</ButtonLink>}
      </PageHeader>
      {page.ok ? (
        <CustomerList page={page.data} filters={filters} />
      ) : (
        <Card>
          <ErrorState
            title={page.status === 403 ? 'You do not have access to customers' : 'Customers could not be loaded'}
            description={page.status === 403 ? 'Ask an administrator if you need access.' : page.message}
          />
        </Card>
      )}
      <div className="mt-6">
        <PendingNotice title="The customer portal is planned">
          Customers cannot sign in yet. Agents and partners are on the Agents &amp; partners page.
        </PendingNotice>
      </div>
    </>
  );
}
