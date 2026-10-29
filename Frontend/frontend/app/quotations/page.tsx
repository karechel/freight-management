import type { Metadata } from 'next';
import { QuotationList } from '@/components/quotations/quotation-list';
import { ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { SessionNotice } from '@/components/ui/session-notice';
import { DataSourceNotice, SESSION_EDIT_NOTE } from '@/components/ui/states';
import { DEMO_REFERENCE_DATE, getQuotations } from '@/lib/data';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Quotations & bookings' };

export default async function QuotationsPage() {
  // The list itself comes from the session store (seeded from the same data in the root layout).
  const quotations = await getQuotations();
  return (
    <>
      <PageHeader
        title="Quotations & bookings"
        description="Freight quotations for sea, air, road and rail, and the bookings they turn into."
      >
        <ButtonLink href="/quotations/new">New quotation</ButtonLink>
      </PageHeader>
      <SessionNotice />
      <DataSourceNotice source={quotations.source}>
        {SESSION_EDIT_NOTE} Expiry is calculated as at {formatDate(DEMO_REFERENCE_DATE)}. Quotations are not emailed.
      </DataSourceNotice>
      <QuotationList referenceDate={DEMO_REFERENCE_DATE} />
    </>
  );
}
