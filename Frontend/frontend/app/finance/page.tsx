import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { DataSourceNotice, EmptyState, PendingNotice } from '@/components/ui/states';
import { Table, Td, Th } from '@/components/ui/table';
import { getExpenses, getInvoices, getPayments } from '@/lib/data';
import { formatDate, formatDateTime, formatKes } from '@/lib/format';
import { invoiceStatusMeta, paymentMethodLabel } from '@/lib/labels';
import { invoiceBalance, receivablesSummary } from '@/lib/metrics';

export const metadata: Metadata = { title: 'Invoices & payments' };

const shipmentLink =
  'rounded font-mono text-xs text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600';

const expenseStatus = {
  pending_approval: { label: 'Pending approval', tone: 'warning' },
  approved: { label: 'Approved', tone: 'info' },
  paid: { label: 'Paid', tone: 'success' },
} as const;

export default async function FinancePage() {
  const [invoices, payments, expenses] = await Promise.all([getInvoices(), getPayments(), getExpenses()]);
  const receivables = receivablesSummary(invoices.data);
  const unreconciled = payments.data.filter((p) => !p.reconciled);
  const pendingExpenses = expenses.data.filter((e) => e.status === 'pending_approval');
  const source = [invoices, payments, expenses].some((r) => r.source === 'demo') ? 'demo' : 'live';

  const summary = [
    { label: 'Outstanding receivables', value: formatKes(receivables.outstandingKes), detail: `${receivables.openCount} open invoices` },
    { label: 'Overdue', value: formatKes(receivables.overdueKes), detail: `${receivables.overdueCount} invoices past due` },
    { label: 'Unreconciled payments', value: String(unreconciled.length), detail: formatKes(unreconciled.reduce((s, p) => s + p.amountKes, 0)) },
    { label: 'Expenses awaiting approval', value: String(pendingExpenses.length), detail: formatKes(pendingExpenses.reduce((s, e) => s + e.amountKes, 0)) },
  ];

  return (
    <>
      <PageHeader title="Invoices & payments" description="Receivables, payments received, reconciliation and job expenses." />
      <DataSourceNotice source={source}>
        No invoice has been issued and no payment has been received through this system.
      </DataSourceNotice>
      <div className="mb-6">
        <PendingNotice title="M-Pesa integration pending">
          Payments marked M-Pesa are demo records entered by hand. No M-Pesa (Daraja) connection exists; nothing is
          received, verified or reconciled automatically.
        </PendingNotice>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <p className="text-sm font-medium text-slate-600">{item.label}</p>
            <p className="mt-2 text-xl font-semibold text-slate-900 tabular-nums">{item.value}</p>
            <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader title="Invoices" description="Newest first" />
          {invoices.data.length === 0 ? (
            <EmptyState title="No invoices" />
          ) : (
            <Table caption="Invoices">
              <thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th>Customer</Th>
                  <Th className="text-right">Amount</Th>
                  <Th className="text-right">Balance</Th>
                  <Th>Status</Th>
                  <Th>Due</Th>
                </tr>
              </thead>
              <tbody>
                {invoices.data.map((inv) => (
                  <tr key={inv.number} className="hover:bg-slate-50">
                    <Td>
                      <p className="font-mono text-[13px] font-medium text-slate-900">{inv.number}</p>
                      <Link href={`/shipments/${inv.shipmentReference}`} className={shipmentLink}>
                        {inv.shipmentReference}
                      </Link>
                    </Td>
                    <Td className="font-medium text-slate-900">{inv.customerName}</Td>
                    <Td className="text-right tabular-nums">{formatKes(inv.amountKes)}</Td>
                    <Td className="text-right tabular-nums">{formatKes(invoiceBalance(inv))}</Td>
                    <Td><StatusBadge meta={invoiceStatusMeta[inv.status]} /></Td>
                    <Td className="whitespace-nowrap">{formatDate(inv.dueAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="Payments received" description="Recorded manually (demo)" />
            {payments.data.length === 0 ? (
              <EmptyState title="No payments recorded" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {payments.data.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 sm:px-5">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{p.customerName}</p>
                      <p className="text-xs text-slate-500">
                        {paymentMethodLabel[p.method]} · {p.reference} · {p.invoiceNumber} · {formatDateTime(p.receivedAt)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-medium tabular-nums">{formatKes(p.amountKes)}</span>
                      <Badge tone={p.reconciled ? 'success' : 'warning'} dot>
                        {p.reconciled ? 'Reconciled' : 'Unreconciled'}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Job expenses" description="Costs recorded against shipments" />
            {expenses.data.length === 0 ? (
              <EmptyState title="No expenses recorded" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {expenses.data.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 sm:px-5">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{e.description}</p>
                      <p className="text-xs text-slate-500">
                        {e.payee} ·{' '}
                        <Link href={`/shipments/${e.shipmentReference}`} className={shipmentLink}>
                          {e.shipmentReference}
                        </Link>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-medium tabular-nums">{formatKes(e.amountKes)}</span>
                      <Badge tone={expenseStatus[e.status].tone} dot>
                        {expenseStatus[e.status].label}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
