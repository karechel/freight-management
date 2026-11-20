import type { Metadata } from 'next';
import { LiveQuotationForm } from '@/components/quotations/live-quotation-form';
import { QuotationFormView } from '@/components/quotations/quotation-form-view';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { getLiveQuotationFormOptions } from '@/lib/api/quotation-options';
import { getCurrentUser, serverGet } from '@/lib/api/server';
import { DEMO_REFERENCE_DATE, getQuotationFormOptions } from '@/lib/data';
import { liveQuotationHref, QUOTATIONS_MANAGE, type LiveQuotation } from '@/lib/live-quotations';

export const metadata: Metadata = { title: 'New quotation' };

export default async function NewQuotationPage({ searchParams }: PageProps<'/quotations/new'>) {
  const params = await searchParams;
  // `?from=REF` duplicates an existing quotation as a new draft.
  const from = typeof params.from === 'string' ? params.from.slice(0, 40) : undefined;
  const returnTo = from ? `/quotations/new?from=${encodeURIComponent(from)}` : '/quotations/new';
  const back = from ? { href: liveQuotationHref(from), label: 'Back to quotation' } : { href: '/quotations', label: 'All quotations' };

  const [user, source] = await Promise.all([
    getCurrentUser(returnTo),
    from ? serverGet<LiveQuotation>(`quotations/${encodeURIComponent(from)}`, returnTo) : Promise.resolve(undefined),
  ]);

  // Duplicating a demo quotation stays in the demo session, as before.
  if (from && source && !source.ok && source.status === 404) {
    const options = await getQuotationFormOptions();
    return <QuotationFormView mode="duplicate" reference={from} options={options.data} source={options.source} referenceDate={DEMO_REFERENCE_DATE} />;
  }

  const title = from ? `Duplicate ${from}` : 'New quotation';
  if (!user.ok || !user.data.permissions.includes(QUOTATIONS_MANAGE)) {
    return (
      <>
        <PageHeader title={title} back={back} />
        <Card>
          <ErrorState
            title={user.ok ? 'You cannot create quotations' : 'This page could not be loaded'}
            description={user.ok ? 'Ask an administrator if you need to.' : user.message}
          />
        </Card>
      </>
    );
  }
  const options = await getLiveQuotationFormOptions(returnTo);
  const failed = !options.ok ? options : source && !source.ok ? source : undefined;
  if (failed) {
    return (
      <>
        <PageHeader title={title} back={back} />
        <Card>
          <ErrorState title="This page could not be loaded" description={failed.message} />
        </Card>
      </>
    );
  }
  const duplicateOf = source?.ok ? source.data : undefined;
  return (
    <>
      <PageHeader
        title={title}
        description={
          duplicateOf
            ? 'Creates a new draft with the same customer, route and lines. Set new issue and validity dates.'
            : 'Fields marked * are required.'
        }
        back={back}
      />
      {options.ok && <LiveQuotationForm options={options.data} duplicateOf={duplicateOf} />}
    </>
  );
}
