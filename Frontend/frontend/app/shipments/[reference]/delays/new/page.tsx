import type { Metadata } from 'next';
import { DelayFormView } from '@/components/shipments/delay-form';
import { getStaff } from '@/lib/data';

export async function generateMetadata({ params }: PageProps<'/shipments/[reference]/delays/new'>): Promise<Metadata> {
  const { reference } = await params;
  return { title: `Record delay · ${reference}` };
}

export default async function NewDelayPage({ params }: PageProps<'/shipments/[reference]/delays/new'>) {
  const [{ reference }, staff] = await Promise.all([params, getStaff()]);
  return <DelayFormView reference={reference} staff={staff.data} source={staff.source} />;
}
