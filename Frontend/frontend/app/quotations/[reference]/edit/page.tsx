import type { Metadata } from 'next';
import { DemoPageMarker } from '@/components/layout/page-source';
import { LiveQuotationForm } from '@/components/quotations/live-quotation-form';
import { QuotationFormView } from '@/components/quotations/quotation-form-view';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState, PendingNotice } from '@/components/ui/states';
import { getLiveQuotationFormOptions } from '@/lib/api/quotation-options';
import { getCurrentUser, serverGet } from '@/lib/api/server';
import { DEMO_REFERENCE_DATE, getQuotationFormOptions } from '@/lib/data';
import { liveQuotationHref, QUOTATIONS_MANAGE, type LiveQuotation } from '@/lib/live-quotations';

export async function generateMetadata({ params }: PageProps<'/quotations/[reference]/edit'>): Promise<Metadata> {
  const { reference } = await params;
  return { title: `Edit quotation ${reference}` };
}

export default async function EditQuotationPage({ params }: PageProps<'/quotations/[reference]/edit'>) {
  const { reference } = await params;
  const returnTo = `/quotations/${encodeURIComponent(reference)}/edit`;
  const back = { href: liveQuotationHref(reference), label: 'Back to quotation' };
  const [quotation, user] = await Promise.all([
    serverGet<LiveQuotation>(`quotations/${encodeURIComponent(reference)}`, returnTo),
    getCurrentUser(returnTo),
  ]);

  // Demo quotations are still edited in the demo session.
  if (!quotation.ok && quotation.status === 404) {
    const options = await getQuotationFormOptions();
    return (
      <>
        <DemoPageMarker />
        <QuotationFormView mode="edit" reference={reference} options={options.data} source={options.source} referenceDate={DEMO_REFERENCE_DATE} />
      </>
    );
  }

  const title = `Edit ${reference}`;
  const blocked = (heading: string, description: string) => (
    <>
      <PageHeader title={title} back={back} />
      <Card>
        <ErrorState title={heading} description={description} />
      </Card>
    </>
  );
  if (!quotation.ok) return blocked('This quotation could not be loaded', quotation.message);
  if (!user.ok || !user.data.permissions.includes(QUOTATIONS_MANAGE)) {
    return blocked('You cannot edit quotations', 'Ask an administrator if you need to.');
  }
  if (!quotation.data.editable) {
    return (
      <>
        <PageHeader title={title} back={back} />
        <PendingNotice title="Only draft and sent quotations can be edited">
          {reference} can no longer change. To change the offer, duplicate it as a new draft.
        </PendingNotice>
      </>
    );
  }
  const options = await getLiveQuotationFormOptions(returnTo);
  if (!options.ok) return blocked('This page could not be loaded', options.message);
  return (
    <>
      <PageHeader title={title} description={`${quotation.data.customer.name}. Fields marked * are required.`} back={back} />
      <LiveQuotationForm options={options.data} quotation={quotation.data} />
    </>
  );
}
