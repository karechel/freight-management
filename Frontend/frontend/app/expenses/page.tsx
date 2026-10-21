import type { Metadata } from 'next';
import { ExpensesView } from '@/components/expenses/expenses-view';
import { getCostEstimates, getInvoices } from '@/lib/data';

export const metadata: Metadata = { title: 'Expenses & profitability' };

export default async function ExpensesPage() {
  const [invoices, estimates] = await Promise.all([getInvoices(), getCostEstimates()]);
  const source = [invoices, estimates].some((r) => r.source === 'demo') ? 'demo' : 'live';
  return <ExpensesView invoices={invoices.data} estimates={estimates.data} source={source} />;
}
