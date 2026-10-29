'use client';

// Costs and billing on the shipment page. Expenses come from the session
// store, so costs recorded on the expenses page show here as well.

import { StatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { DetailList } from '@/components/ui/detail-list';
import { useSessionStore } from '@/lib/data/session-store';
import { formatKes } from '@/lib/format';
import { expenseCategoryLabel, expenseStatusMeta, invoiceStatusMeta } from '@/lib/labels';
import type { Invoice } from '@/lib/types';

export function ShipmentCostsCard({ reference, invoices }: { reference: string; invoices: Invoice[] }) {
  const expenses = useSessionStore().expenses.filter((e) => e.shipmentReference === reference);
  const expenseTotal = expenses.reduce((sum, e) => sum + e.amountKes, 0);
  const invoicedTotal = invoices.reduce((sum, i) => sum + i.amountKes, 0);

  return (
    <Card>
      <CardHeader
        title="Costs and billing"
        description="Invoices issued and expenses recorded against this job"
        action={{ href: '/expenses', label: 'Profitability' }}
      >
        <ButtonLink href={`/expenses/new?shipment=${encodeURIComponent(reference)}`} variant="secondary" size="sm">
          Record expense
        </ButtonLink>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        <DetailList
          columns={3}
          items={[
            { label: 'Invoiced', value: formatKes(invoicedTotal) },
            { label: 'Expenses recorded', value: formatKes(expenseTotal) },
            { label: 'Margin (indicative)', value: invoices.length ? formatKes(invoicedTotal - expenseTotal) : '—' },
          ]}
        />
        {invoices.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {invoices.map((inv) => (
              <li key={inv.number} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="font-mono text-[13px]">{inv.number}</span>
                <span className="tabular-nums">{formatKes(inv.amountKes)}</span>
                <StatusBadge meta={invoiceStatusMeta[inv.status]} />
              </li>
            ))}
          </ul>
        )}
        {expenses.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {expenses.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  {e.description}
                  <span className="block text-xs text-slate-500">
                    {expenseCategoryLabel[e.category]} · {e.payee}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">{formatKes(e.amountKes)}</span>
                  <StatusBadge meta={expenseStatusMeta[e.status]} />
                </span>
              </li>
            ))}
          </ul>
        )}
        {invoices.length === 0 && expenses.length === 0 && (
          <p className="text-sm text-slate-500">No invoices or expenses recorded yet.</p>
        )}
      </CardBody>
    </Card>
  );
}
