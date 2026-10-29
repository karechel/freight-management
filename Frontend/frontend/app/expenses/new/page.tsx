import type { Metadata } from 'next';
import { ExpenseForm } from '@/components/expenses/expense-form';
import { PageHeader } from '@/components/ui/page-header';
import { DataSourceNotice, SESSION_EDIT_NOTE } from '@/components/ui/states';
import { getExpenses } from '@/lib/data';

export const metadata: Metadata = { title: 'Record expense' };

export default async function NewExpensePage({ searchParams }: PageProps<'/expenses/new'>) {
  const [expenses, params] = await Promise.all([getExpenses(), searchParams]);
  const shipment = typeof params.shipment === 'string' ? params.shipment.slice(0, 40) : undefined;
  return (
    <>
      <PageHeader
        title="Record expense"
        description="Record a supplier charge against a shipment. Fields marked * are required."
        back={shipment ? { href: `/shipments/${encodeURIComponent(shipment)}`, label: 'Back to shipment' } : { href: '/expenses', label: 'Expenses & profitability' }}
      />
      <DataSourceNotice source={expenses.source}>
        {SESSION_EDIT_NOTE} No supplier is paid and no accounting entry is made.
      </DataSourceNotice>
      <ExpenseForm initialShipment={shipment} />
    </>
  );
}
