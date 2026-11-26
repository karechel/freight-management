import type { Metadata } from 'next';
import { LiveShipmentForm } from '@/components/shipments/live-shipment-form';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { getCurrentUser, serverGet } from '@/lib/api/server';
import { getShipmentFormChoices } from '@/lib/api/shipment-options';
import { bookingHref, type LiveBooking } from '@/lib/live-quotations';
import { SHIPMENTS_MANAGE } from '@/lib/live-shipments';

export const metadata: Metadata = { title: 'New shipment' };

function Refused({ title, description, back }: { title: string; description: string; back: { href: string; label: string } }) {
  return (
    <>
      <PageHeader title="New shipment" back={back} />
      <Card>
        <ErrorState title={title} description={description} />
      </Card>
    </>
  );
}

export default async function NewShipmentPage({ searchParams }: PageProps<'/shipments/new'>) {
  const params = await searchParams;
  const bookingReference = typeof params.booking === 'string' ? params.booking.slice(0, 40) : undefined;
  const returnTo = `/shipments/new${bookingReference ? `?booking=${encodeURIComponent(bookingReference)}` : ''}`;
  const [user, choices, booking] = await Promise.all([
    getCurrentUser(returnTo),
    getShipmentFormChoices(returnTo),
    bookingReference ? serverGet<LiveBooking>(`bookings/${encodeURIComponent(bookingReference)}`, returnTo) : undefined,
  ]);
  const back = booking?.ok
    ? { href: bookingHref(booking.data.reference), label: `Booking ${booking.data.reference}` }
    : { href: '/shipments', label: 'All shipments' };

  if (!user.ok || !user.data.permissions.includes(SHIPMENTS_MANAGE)) {
    return <Refused title="You cannot create shipments" description="Operations staff and administrators create shipments. Ask an administrator if you need access." back={back} />;
  }
  if (!choices.ok) return <Refused title="The form could not be loaded" description={choices.message} back={back} />;
  if (booking && !booking.ok) {
    return <Refused title="Booking not found" description={`There is no booking ${bookingReference}.`} back={back} />;
  }
  if (booking?.ok && booking.data.status !== 'confirmed') {
    return (
      <Refused
        title="This booking is not confirmed"
        description={`Only confirmed bookings can be turned into shipments. ${booking.data.reference} is ${booking.data.status}.`}
        back={back}
      />
    );
  }
  if (booking?.ok) {
    // On-hold, closed and archived customers' bookings do not become shipments (2026-11-27,
    // CLAUDE.md §17 question 19); the backend refuses it too.
    const customer = await serverGet<{ name: string; accountStatus: string; archivedAt: string | null }>(
      `parties/${booking.data.customer.id}`,
      returnTo,
    );
    const block = !customer.ok
      ? undefined
      : customer.data.archivedAt
        ? 'is archived'
        : customer.data.accountStatus === 'on_hold'
          ? 'is on hold'
          : customer.data.accountStatus === 'closed'
            ? 'has a closed account'
            : undefined;
    if (block) {
      return (
        <Refused
          title="This booking's customer cannot receive new shipments"
          description={`${booking.data.customer.name} ${block}, so ${booking.data.reference} cannot be turned into a shipment. Management or an administrator must make the account active first.`}
          back={back}
        />
      );
    }
  }
  return (
    <>
      <PageHeader
        title="New shipment"
        description={
          booking?.ok
            ? `From booking ${booking.data.reference}: ${booking.data.customer.name}, ${booking.data.origin} → ${booking.data.destination}.`
            : 'A job without a booking, for example clearing only. To ship a booking, open it and choose "Create shipment".'
        }
        back={back}
      >
        {!booking && (
          <ButtonLink href="/bookings?status=confirmed" variant="secondary">
            Confirmed bookings
          </ButtonLink>
        )}
      </PageHeader>
      <LiveShipmentForm booking={booking?.ok ? booking.data : undefined} choices={choices.data} />
    </>
  );
}
