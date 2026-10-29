'use client';

// Expense figures on the invoices and payments page. They read the session
// store, so expenses recorded on the expenses page appear here too.

import Link from 'next/link';
import { StatusBadge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { shipmentHref } from '@/components/shipments/shipment-table';
import { useSessionStore } from '@/lib/data/session-store';
import { formatKes } from '@/lib/format';
import { expenseCategoryLabel, expenseStatusMeta } from '@/lib/labels';

const shipmentLink =
  'rounded font-mono text-xs text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600';

/** How many recent expenses the card lists before pointing to the expenses page. */
const LIMIT = 6;

export function PendingExpensesTile() {
  const pending = useSessionStore().expenses.filter((e) => e.status === 'pending_approval');
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <p className="text-sm font-medium text-slate-600">Expenses awaiting approval</p>
      <p className="mt-2 text-xl font-semibold text-slate-900 tabular-nums">{pending.length}</p>
      <p className="mt-1 text-xs text-slate-500">{formatKes(pending.reduce((s, e) => s + e.amountKes, 0))}</p>
    </div>
  );
}

export function JobExpensesCard() {
  const { expenses } = useSessionStore();
  return (
    <Card>
      <CardHeader
        title="Job expenses"
        description={`Latest costs recorded against shipments (${expenses.length} in total)`}
        action={{ href: '/expenses', label: 'Expenses & profitability' }}
      />
      {expenses.length === 0 ? (
        <EmptyState title="No expenses recorded" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {expenses.slice(0, LIMIT).map((e) => (
            <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 sm:px-5">
              <div>
                <p className="text-sm font-medium text-slate-900">{e.description}</p>
                <p className="text-xs text-slate-500">
                  {expenseCategoryLabel[e.category]} · {e.payee} ·{' '}
                  <Link href={shipmentHref(e.shipmentReference)} className={shipmentLink}>
                    {e.shipmentReference}
                  </Link>
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-medium tabular-nums">{formatKes(e.amountKes)}</span>
                <StatusBadge meta={expenseStatusMeta[e.status]} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
