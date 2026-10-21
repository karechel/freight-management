import type { Metadata } from 'next';
import { ReportsView } from '@/components/reports/reports-view';
import { DEMO_REFERENCE_DATE, getCostEstimates, getInvoices, getParties } from '@/lib/data';

export const metadata: Metadata = { title: 'Reports & analytics' };

export default async function ReportsPage() {
  const [invoices, estimates, customers] = await Promise.all([getInvoices(), getCostEstimates(), getParties('customer')]);
  const source = [invoices, estimates, customers].some((r) => r.source === 'demo') ? 'demo' : 'live';
  return (
    <ReportsView
      invoices={invoices.data}
      estimates={estimates.data}
      customers={customers.data.map((c) => ({ id: c.id, name: c.name }))}
      referenceDate={DEMO_REFERENCE_DATE}
      source={source}
    />
  );
}
