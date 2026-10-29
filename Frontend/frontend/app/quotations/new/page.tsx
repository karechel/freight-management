import type { Metadata } from 'next';
import { QuotationFormView } from '@/components/quotations/quotation-form-view';
import { DEMO_REFERENCE_DATE, getQuotationFormOptions } from '@/lib/data';

export const metadata: Metadata = { title: 'New quotation' };

export default async function NewQuotationPage({ searchParams }: PageProps<'/quotations/new'>) {
  const [options, params] = await Promise.all([getQuotationFormOptions(), searchParams]);
  // `?from=REF` duplicates an existing quotation as a new draft.
  const from = typeof params.from === 'string' ? params.from.slice(0, 40) : undefined;
  return (
    <QuotationFormView
      mode={from ? 'duplicate' : 'create'}
      reference={from}
      options={options.data}
      source={options.source}
      referenceDate={DEMO_REFERENCE_DATE}
    />
  );
}
