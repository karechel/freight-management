import type { Metadata } from 'next';
import { DelayFormView } from '@/components/shipments/delay-form';
import { getStaff } from '@/lib/data';

export async function generateMetadata({ params }: PageProps<'/shipments/[reference]/delays/[delayId]/edit'>): Promise<Metadata> {
  const { reference } = await params;
  return { title: `Edit delay · ${reference}` };
}

export default async function EditDelayPage({ params }: PageProps<'/shipments/[reference]/delays/[delayId]/edit'>) {
  const [{ reference, delayId }, staff] = await Promise.all([params, getStaff()]);
  return <DelayFormView reference={reference} delayId={delayId} staff={staff.data} source={staff.source} />;
}
