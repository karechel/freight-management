import type { Metadata } from 'next';
import { TaskFormView } from '@/components/notifications/task-form';
import { getStaffAccounts } from '@/lib/data';

export const metadata: Metadata = { title: 'New task' };

const param = (v: string | string[] | undefined, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined);

export default async function NewTaskPage({ searchParams }: PageProps<'/notifications/tasks/new'>) {
  const [staff, params] = await Promise.all([getStaffAccounts(), searchParams]);
  // Prefill from a notification or record page; values are checked against the records by the form.
  const prefill = {
    title: param(params.title, 160),
    shipmentReference: param(params.shipment, 40),
    quotationReference: param(params.quotation, 40),
    documentId: param(params.document, 40),
    invoiceNumber: param(params.invoice, 40),
  };
  return <TaskFormView staff={staff.data.map((s) => s.name)} prefill={prefill} source={staff.source} />;
}
