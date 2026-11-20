import type { Metadata } from 'next';
import { BookingList } from '@/components/quotations/live-lists';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { getCurrentUser, serverGet } from '@/lib/api/server';
import {
  listApiQuery,
  listPageQuery,
  parseBookingFilters,
  QUOTATIONS_MANAGE,
  type ListPage,
  type LiveBooking,
} from '@/lib/live-quotations';

export const metadata: Metadata = { title: 'Bookings' };

export default async function BookingsPage({ searchParams }: PageProps<'/bookings'>) {
  const filters = parseBookingFilters(await searchParams);
  const returnTo = `/bookings${listPageQuery(filters)}`;
  const [page, user] = await Promise.all([
    serverGet<ListPage<LiveBooking>>(`bookings?${listApiQuery(filters)}`, returnTo),
    getCurrentUser(returnTo),
  ]);
  const canManage = user.ok && user.data.permissions.includes(QUOTATIONS_MANAGE);
  return (
    <>
      <PageHeader title="Bookings" description="Confirmed arrangements, from accepted quotations or agreed directly.">
        <ButtonLink href="/quotations" variant="secondary">
          Quotations
        </ButtonLink>
        {canManage && <ButtonLink href="/bookings/new">New booking</ButtonLink>}
      </PageHeader>
      {page.ok ? (
        <BookingList page={page.data} filters={filters} />
      ) : (
        <Card>
          <ErrorState
            title={page.status === 403 ? 'You do not have access to bookings' : 'Bookings could not be loaded'}
            description={page.status === 403 ? 'Ask an administrator if you need access.' : page.message}
          />
        </Card>
      )}
    </>
  );
}
