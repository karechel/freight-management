import type { Metadata } from 'next';
import { QuotationFormView } from '@/components/quotations/quotation-form-view';
import { DEMO_REFERENCE_DATE, getQuotationFormOptions } from '@/lib/data';

export async function generateMetadata({ params }: PageProps<'/quotations/[reference]/edit'>): Promise<Metadata> {
  const { reference } = await params;
  return { title: `Edit quotation ${reference}` };
}

export default async function EditQuotationPage({ params }: PageProps<'/quotations/[reference]/edit'>) {
  const [{ reference }, options] = await Promise.all([params, getQuotationFormOptions()]);
  return <QuotationFormView mode="edit" reference={reference} options={options.data} source={options.source} referenceDate={DEMO_REFERENCE_DATE} />;
}
