import type { Metadata } from 'next';
import { BlockedCustomersNote } from '@/components/quotations/blocked-customers-note';
import { NewBookingForm } from '@/components/quotations/new-booking-form';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { getLiveQuotationFormOptions } from '@/lib/api/quotation-options';
import { getCurrentUser, serverGet } from '@/lib/api/server';
import { QUOTATIONS_MANAGE, type ListPage, type PartyRef } from '@/lib/live-quotations';

export const metadata: Metadata = { title: 'New booking' };

/** A booking agreed without a quotation (approved Phase 2 scope: "standalone creation"). */
export default async function NewBookingPage() {
  const returnTo = '/bookings/new';
  const back = { href: '/bookings', label: 'All bookings' };
  const user = await getCurrentUser(returnTo);
  if (!user.ok || !user.data.permissions.includes(QUOTATIONS_MANAGE)) {
    return (
      <>
        <PageHeader title="New booking" back={back} />
        <Card>
          <ErrorState
            title={user.ok ? 'You cannot create bookings' : 'This page could not be loaded'}
            description={user.ok ? 'Ask an administrator if you need to.' : user.message}
          />
        </Card>
      </>
    );
  }
  const [options, carriers] = await Promise.all([
    getLiveQuotationFormOptions(returnTo),
    serverGet<ListPage<PartyRef>>('parties?role=carrier&limit=200', returnTo),
  ]);
  if (!options.ok || !carriers.ok) {
    return (
      <>
        <PageHeader title="New booking" back={back} />
        <Card>
          <ErrorState title="This page could not be loaded" description={!options.ok ? options.message : !carriers.ok ? carriers.message : ''} />
        </Card>
      </>
    );
  }
  return (
    <>
      <PageHeader
        title="New booking"
        description="For work agreed without a quotation. To book an accepted quotation, convert it from the quotation's page."
        back={back}
      />
      <BlockedCustomersNote count={options.data.blockedCustomers} />
      <NewBookingForm
        customers={options.data.customers}
        agents={options.data.agents}
        carriers={carriers.data.items.map(({ id, name }) => ({ id, name }))}
      />
    </>
  );
}
