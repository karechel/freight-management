import type { Metadata } from 'next';
import { ShipmentDetailView } from '@/components/shipments/shipment-detail-view';
import { StatusBadge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { DetailList } from '@/components/ui/detail-list';
import { getExpenses, getInvoices, getShipmentFormOptions } from '@/lib/data';
import { formatKes } from '@/lib/format';
import { invoiceStatusMeta } from '@/lib/labels';

// Next.js passes `params` already URL-decoded, so they are used as-is.
// The shipment itself is read from the browser session store by
// ShipmentDetailView (it may have been created or edited in this tab), as are
// its documents; the billing records below are not editable yet and render here.

export async function generateMetadata({ params }: PageProps<'/shipments/[reference]'>): Promise<Metadata> {
  const { reference } = await params;
  return { title: `Shipment ${reference}` };
}

async function ShipmentRecords({ reference }: { reference: string }) {
  const [invoices, expenses] = await Promise.all([
    getInvoices(reference),
    getExpenses(reference),
  ]);
  const expenseTotal = expenses.data.reduce((sum, e) => sum + e.amountKes, 0);
  const invoicedTotal = invoices.data.reduce((sum, i) => sum + i.amountKes, 0);

  return (
    <>
      <Card>
        <CardHeader title="Costs and billing" description="Invoices issued and expenses recorded against this job" />
        <CardBody className="flex flex-col gap-4">
          <DetailList
            columns={3}
            items={[
              { label: 'Invoiced', value: formatKes(invoicedTotal) },
              { label: 'Expenses recorded', value: formatKes(expenseTotal) },
              { label: 'Margin (indicative)', value: invoices.data.length ? formatKes(invoicedTotal - expenseTotal) : '—' },
            ]}
          />
          {invoices.data.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {invoices.data.map((inv) => (
                <li key={inv.number} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="font-mono text-[13px]">{inv.number}</span>
                  <span className="tabular-nums">{formatKes(inv.amountKes)}</span>
                  <StatusBadge meta={invoiceStatusMeta[inv.status]} />
                </li>
              ))}
            </ul>
          )}
          {expenses.data.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {expenses.data.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span>{e.description}</span>
                  <span className="text-slate-500">{e.payee}</span>
                  <span className="tabular-nums">{formatKes(e.amountKes)}</span>
                </li>
              ))}
            </ul>
          )}
          {invoices.data.length === 0 && expenses.data.length === 0 && (
            <p className="text-sm text-slate-500">No invoices or expenses recorded yet.</p>
          )}
        </CardBody>
      </Card>
    </>
  );
}

export default async function ShipmentDetailPage({ params }: PageProps<'/shipments/[reference]'>) {
  const [{ reference }, options] = await Promise.all([params, getShipmentFormOptions()]);
  return (
    <ShipmentDetailView
      reference={reference}
      options={options.data}
      source={options.source}
      records={<ShipmentRecords reference={reference} />}
    />
  );
}
