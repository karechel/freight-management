import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BookingDetail } from '@/components/quotations/booking-detail';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { getCurrentUser, serverGet } from '@/lib/api/server';
import { QUOTATIONS_MANAGE, type LiveBooking } from '@/lib/live-quotations';

// Next.js passes `params` already URL-decoded, so they are used as-is.

export async function generateMetadata({ params }: PageProps<'/bookings/[reference]'>): Promise<Metadata> {
  const { reference } = await params;
  return { title: `Booking ${reference}` };
}

export default async function BookingPage({ params }: PageProps<'/bookings/[reference]'>) {
  const { reference } = await params;
  const returnTo = `/bookings/${encodeURIComponent(reference)}`;
  const [booking, user] = await Promise.all([
    serverGet<LiveBooking>(`bookings/${encodeURIComponent(reference)}`, returnTo),
    getCurrentUser(returnTo),
  ]);
  if (!booking.ok) {
    if (booking.status === 404) notFound();
    return (
      <>
        <PageHeader title={`Booking ${reference}`} back={{ href: '/bookings', label: 'All bookings' }} />
        <Card>
          <ErrorState
            title={booking.status === 403 ? 'You do not have access to bookings' : 'This booking could not be loaded'}
            description={booking.status === 403 ? 'Ask an administrator if you need access.' : booking.message}
          />
        </Card>
      </>
    );
  }
  return <BookingDetail booking={booking.data} canManage={user.ok && user.data.permissions.includes(QUOTATIONS_MANAGE)} />;
}
