import type { Metadata } from 'next';
import { LiveQuotationList } from '@/components/quotations/live-lists';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState, PendingNotice } from '@/components/ui/states';
import { getCurrentUser, serverGet } from '@/lib/api/server';
import {
  listApiQuery,
  listPageQuery,
  parseQuotationFilters,
  QUOTATIONS_MANAGE,
  type ListPage,
  type LiveQuotation,
} from '@/lib/live-quotations';

export const metadata: Metadata = { title: 'Quotations & bookings' };

export default async function QuotationsPage({ searchParams }: PageProps<'/quotations'>) {
  const filters = parseQuotationFilters(await searchParams);
  const returnTo = `/quotations${listPageQuery(filters)}`;
  const [user, page] = await Promise.all([
    getCurrentUser(returnTo),
    serverGet<ListPage<LiveQuotation>>(`quotations?${listApiQuery(filters)}`, returnTo),
  ]);
  const canManage = user.ok && user.data.permissions.includes(QUOTATIONS_MANAGE);

  return (
    <>
      <PageHeader
        title="Quotations & bookings"
        description="Freight quotations for sea, air, road and rail, and the bookings they turn into."
      >
        <ButtonLink href="/bookings" variant="secondary">
          Bookings
        </ButtonLink>
        {canManage && <ButtonLink href="/quotations/new">New quotation</ButtonLink>}
      </PageHeader>
      {page.ok ? (
        <LiveQuotationList page={page.data} filters={filters} />
      ) : (
        <Card>
          <ErrorState
            title={page.status === 403 ? 'You do not have access to quotations' : 'Quotations could not be loaded'}
            description={page.status === 403 ? 'Ask an administrator if you need access.' : page.message}
          />
        </Card>
      )}
      <div className="mt-6">
        <PendingNotice title="Quotations are not emailed">
          Amounts are in KES. Expiry follows each quotation&apos;s valid-until date on the Nairobi calendar. The demo quotations
          shown on other demo pages are still available from their links.
        </PendingNotice>
      </div>
    </>
  );
}
