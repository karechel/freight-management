import type { Metadata } from 'next';
import { DemoPageMarker } from '@/components/layout/page-source';
import { LiveQuotationDetail } from '@/components/quotations/live-quotation-detail';
import { QuotationDetailView } from '@/components/quotations/quotation-detail-view';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { getCurrentUser, serverGet } from '@/lib/api/server';
import { DEMO_REFERENCE_DATE, getParties } from '@/lib/data';
import { QUOTATIONS_MANAGE, type ListPage, type LiveQuotation, type PartyRef } from '@/lib/live-quotations';

// Next.js passes `params` already URL-decoded, so they are used as-is.
// Live quotations come from the backend. A reference the backend does not know is looked up
// in the demo records, which demo shipments, customers and notifications still link to.

export async function generateMetadata({ params }: PageProps<'/quotations/[reference]'>): Promise<Metadata> {
  const { reference } = await params;
  return { title: `Quotation ${reference}` };
}

async function DemoQuotationPage({ reference }: { reference: string }) {
  const customers = await getParties('customer');
  return (
    <>
      <DemoPageMarker />
      <QuotationDetailView
        reference={reference}
        referenceDate={DEMO_REFERENCE_DATE}
        billingByCustomer={Object.fromEntries(customers.data.map((c) => [c.id, c.billing]))}
        source={customers.source}
      />
    </>
  );
}

export default async function QuotationPage({ params }: PageProps<'/quotations/[reference]'>) {
  const { reference } = await params;
  const returnTo = `/quotations/${encodeURIComponent(reference)}`;
  const [quotation, user] = await Promise.all([
    serverGet<LiveQuotation>(`quotations/${encodeURIComponent(reference)}`, returnTo),
    getCurrentUser(returnTo),
  ]);
  if (!quotation.ok) {
    if (quotation.status === 404) return <DemoQuotationPage reference={reference} />;
    return (
      <>
        <PageHeader title={`Quotation ${reference}`} back={{ href: '/quotations', label: 'All quotations' }} />
        <Card>
          <ErrorState
            title={quotation.status === 403 ? 'You do not have access to quotations' : 'This quotation could not be loaded'}
            description={quotation.status === 403 ? 'Ask an administrator if you need access.' : quotation.message}
          />
        </Card>
      </>
    );
  }
  const canManage = user.ok && user.data.permissions.includes(QUOTATIONS_MANAGE);
  // Carriers are offered on the convert form, shown only for accepted quotations not yet booked.
  const canConvert = canManage && quotation.data.status === 'accepted' && !quotation.data.booking;
  const carriers = canConvert ? await serverGet<ListPage<PartyRef>>('parties?role=carrier&limit=200', returnTo) : undefined;
  return (
    <LiveQuotationDetail
      quotation={quotation.data}
      canManage={canManage}
      carriers={carriers?.ok ? carriers.data.items.map(({ id, name }) => ({ id, name })) : []}
    />
  );
}
