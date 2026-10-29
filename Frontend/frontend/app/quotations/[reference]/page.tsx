import type { Metadata } from 'next';
import { QuotationDetailView } from '@/components/quotations/quotation-detail-view';
import { DEMO_REFERENCE_DATE, getParties } from '@/lib/data';

// Next.js passes `params` already URL-decoded, so they are used as-is.

export async function generateMetadata({ params }: PageProps<'/quotations/[reference]'>): Promise<Metadata> {
  const { reference } = await params;
  return { title: `Quotation ${reference}` };
}

export default async function QuotationPage({ params }: PageProps<'/quotations/[reference]'>) {
  const [{ reference }, customers] = await Promise.all([params, getParties('customer')]);
  return (
    <QuotationDetailView
      reference={reference}
      referenceDate={DEMO_REFERENCE_DATE}
      billingByCustomer={Object.fromEntries(customers.data.map((c) => [c.id, c.billing]))}
      source={customers.source}
    />
  );
}
