import type { Metadata } from 'next';
import { BookingList } from '@/components/quotations/live-lists';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { serverGet } from '@/lib/api/server';
import { listApiQuery, listPageQuery, parseBookingFilters, type ListPage, type LiveBooking } from '@/lib/live-quotations';

export const metadata: Metadata = { title: 'Bookings' };

export default async function BookingsPage({ searchParams }: PageProps<'/bookings'>) {
  const filters = parseBookingFilters(await searchParams);
  const page = await serverGet<ListPage<LiveBooking>>(`bookings?${listApiQuery(filters)}`, `/bookings${listPageQuery(filters)}`);
  return (
    <>
      <PageHeader title="Bookings" description="Confirmed arrangements, from accepted quotations or agreed directly.">
        <ButtonLink href="/quotations" variant="secondary">
          Quotations
        </ButtonLink>
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
