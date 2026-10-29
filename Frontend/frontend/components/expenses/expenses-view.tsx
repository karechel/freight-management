'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { inputClass } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { SessionNotice } from '@/components/ui/session-notice';
import { DataSourceNotice, EmptyState, SESSION_EDIT_NOTE } from '@/components/ui/states';
import { Table, Td, Th } from '@/components/ui/table';
import { shipmentHref } from '@/components/shipments/shipment-table';
import { useSessionStore } from '@/lib/data/session-store';
import { formatDate, formatKes } from '@/lib/format';
import { expenseCategoryLabel, expenseStatusMeta, shipmentStatusMeta } from '@/lib/labels';
import { costingTotals, costsByCategory, marginPercent, shipmentCostings } from '@/lib/profitability';
import type { CostEstimate, DataSource, ExpenseCategory, ExpenseStatus, Invoice } from '@/lib/types';

const linkClass = 'rounded font-mono text-xs text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600';

const kesOrDash = (v: number | undefined) => (v === undefined ? '—' : formatKes(v));

function Profit({ value, charge }: { value: number | undefined; charge: number | undefined }) {
  if (value === undefined) return <span className="text-slate-500">—</span>;
  const margin = marginPercent(value, charge);
  return (
    <span className={value < 0 ? 'font-medium text-red-700' : 'text-slate-900'}>
      {formatKes(value)}
      {margin !== undefined && <span className="block text-xs text-slate-500">{margin}% margin</span>}
    </span>
  );
}

function Variance({ value }: { value: number | undefined }) {
  if (value === undefined) return <span className="text-slate-500">—</span>;
  if (value === 0) return <span>On estimate</span>;
  return (
    <span className={value > 0 ? 'text-red-700' : 'text-emerald-800'}>
      {value > 0 ? `${formatKes(value)} over` : `${formatKes(-value)} under`}
    </span>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-slate-600">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} w-full`}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ExpensesView({
  invoices,
  estimates,
  source,
}: {
  invoices: Invoice[];
  estimates: CostEstimate[];
  source: DataSource;
}) {
  const { shipments, quotations, expenses } = useSessionStore();
  const [shipmentFilter, setShipmentFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const costings = shipmentCostings(shipments, { invoices, quotations, estimates, expenses });
  const totals = costingTotals(costings);
  const filteredExpenses = expenses.filter(
    (e) =>
      (!shipmentFilter || e.shipmentReference === shipmentFilter) &&
      (!categoryFilter || e.category === categoryFilter) &&
      (!statusFilter || e.status === statusFilter),
  );
  const filteredTotal = filteredExpenses.reduce((s, e) => s + e.amountKes, 0);
  const awaitingApproval = filteredExpenses.filter((e) => e.status === 'pending_approval');
  const categories = costsByCategory(estimates, expenses, shipmentFilter || undefined);

  const summary = [
    { label: 'Customer charges', value: formatKes(totals.estimatedChargeKes), detail: `${formatKes(totals.invoicedKes)} invoiced so far` },
    { label: 'Estimated costs', value: formatKes(totals.estimatedCostKes), detail: 'From job costing' },
    { label: 'Actual costs to date', value: formatKes(totals.actualCostKes), detail: `${expenses.length} supplier charges recorded` },
    {
      label: 'Estimated profit',
      value: formatKes(totals.estimatedProfitKes),
      detail: `Actual to date: ${formatKes(totals.actualProfitKes)} (on invoiced jobs)`,
    },
  ];

  return (
    <>
      <PageHeader
        title="Expenses & profitability"
        description="Shipment costs from carriers, transporters, handling, storage, customs and agents, compared with what the customer is charged."
      >
        <ButtonLink href="/expenses/new">Record expense</ButtonLink>
      </PageHeader>
      <SessionNotice />
      <DataSourceNotice source={source}>
        {SESSION_EDIT_NOTE} Cost estimates are fixed demo figures. No financial record is saved permanently.
      </DataSourceNotice>

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
          <CardHeader
            title="Shipment profitability"
            description="Estimated profit uses the quotation (or invoices) and the cost estimate. Actual profit to date uses issued invoices and the costs recorded so far."
          />
          {costings.length === 0 ? (
            <EmptyState title="No shipments with charges or costs" />
          ) : (
            <Table caption="Shipment profitability">
              <thead>
                <tr>
                  <Th>Shipment</Th>
                  <Th className="text-right">Charge (estimated / invoiced)</Th>
                  <Th className="text-right">Cost (estimated / actual)</Th>
                  <Th>Cost against estimate</Th>
                  <Th className="text-right">Estimated profit</Th>
                  <Th className="text-right">Actual profit to date</Th>
                </tr>
              </thead>
              <tbody>
                {costings.map((c) => (
                  <tr key={c.reference} className="hover:bg-slate-50">
                    <Td>
                      <Link href={shipmentHref(c.reference)} className={linkClass}>
                        {c.reference}
                      </Link>
                      <p className="text-xs text-slate-600">{c.customerName}</p>
                      <div className="mt-1">
                        <StatusBadge meta={shipmentStatusMeta[c.shipment.status]} />
                      </div>
                    </Td>
                    <Td className="text-right tabular-nums">
                      {kesOrDash(c.estimatedChargeKes)}
                      <span className="block text-xs text-slate-500">
                        {c.quotedKes !== undefined ? 'quoted · ' : ''}
                        {c.invoicedKes ? `${formatKes(c.invoicedKes)} invoiced` : c.draftInvoicedKes ? 'draft invoice only' : 'not invoiced'}
                      </span>
                    </Td>
                    <Td className="text-right tabular-nums">
                      {kesOrDash(c.estimatedCostKes)}
                      <span className="block text-xs text-slate-500">{formatKes(c.actualCostKes)} actual</span>
                    </Td>
                    <Td className="tabular-nums">
                      <Variance value={c.costVarianceKes} />
                    </Td>
                    <Td className="text-right tabular-nums">
                      <Profit value={c.estimatedProfitKes} charge={c.estimatedChargeKes} />
                    </Td>
                    <Td className="text-right tabular-nums">
                      <Profit value={c.actualProfitKes} charge={c.invoicedKes} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Expenses" description="Supplier charges recorded against shipments, newest first">
            <span className="text-sm text-slate-600">
              {filteredExpenses.length} shown · <span className="font-medium text-slate-900 tabular-nums">{formatKes(filteredTotal)}</span>
            </span>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-3 border-b border-slate-200 sm:grid-cols-3">
            <FilterSelect
              id="expense-filter-shipment"
              label="Shipment"
              value={shipmentFilter}
              onChange={setShipmentFilter}
              options={shipments.map((s) => ({ value: s.reference, label: `${s.reference} · ${s.customerName}` }))}
            />
            <FilterSelect
              id="expense-filter-category"
              label="Category"
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={(Object.keys(expenseCategoryLabel) as ExpenseCategory[]).map((c) => ({ value: c, label: expenseCategoryLabel[c] }))}
            />
            <FilterSelect
              id="expense-filter-status"
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={(Object.keys(expenseStatusMeta) as ExpenseStatus[]).map((s) => ({ value: s, label: expenseStatusMeta[s].label }))}
            />
          </CardBody>
          {filteredExpenses.length === 0 ? (
            <EmptyState title="No expenses match these filters" />
          ) : (
            <Table caption="Expenses">
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Shipment</Th>
                  <Th>Category</Th>
                  <Th>Description</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <Td className="whitespace-nowrap">{formatDate(e.incurredAt)}</Td>
                    <Td>
                      <Link href={shipmentHref(e.shipmentReference)} className={linkClass}>
                        {e.shipmentReference}
                      </Link>
                    </Td>
                    <Td>{expenseCategoryLabel[e.category]}</Td>
                    <Td>
                      <p className="text-slate-900">{e.description}</p>
                      <p className="text-xs text-slate-500">
                        {e.payee}
                        {e.recordedBy ? ` · recorded by ${e.recordedBy} (this tab only)` : ''}
                      </p>
                    </Td>
                    <Td className="text-right tabular-nums">{formatKes(e.amountKes)}</Td>
                    <Td>
                      <StatusBadge meta={expenseStatusMeta[e.status]} />
                    </Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <Td className="font-medium text-slate-900">Total</Td>
                  <Td />
                  <Td />
                  <Td className="text-xs text-slate-500">
                    {awaitingApproval.length} awaiting approval ({formatKes(awaitingApproval.reduce((s, e) => s + e.amountKes, 0))})
                  </Td>
                  <Td className="text-right font-semibold text-slate-900 tabular-nums">{formatKes(filteredTotal)}</Td>
                  <Td />
                </tr>
              </tfoot>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Costs by category"
            description={shipmentFilter ? `Estimated and actual costs for ${shipmentFilter}` : 'Estimated and actual costs across all shipments'}
          />
          {categories.length === 0 ? (
            <EmptyState title="No costs for this selection" />
          ) : (
            <Table caption="Costs by category">
              <thead>
                <tr>
                  <Th>Category</Th>
                  <Th className="text-right">Estimated</Th>
                  <Th className="text-right">Actual to date</Th>
                  <Th>Against estimate</Th>
                </tr>
              </thead>
              <tbody>
                {categories.map((row) => (
                  <tr key={row.category}>
                    <Td className="font-medium text-slate-900">{expenseCategoryLabel[row.category]}</Td>
                    <Td className="text-right tabular-nums">{formatKes(row.estimatedKes)}</Td>
                    <Td className="text-right tabular-nums">{formatKes(row.actualKes)}</Td>
                    <Td className="tabular-nums">
                      <Variance value={row.estimatedKes ? row.actualKes - row.estimatedKes : undefined} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="How these figures are worked out" />
          <CardBody>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Estimated charge: the linked KES quotation total, otherwise the invoiced total including draft invoices.</li>
              <li>Actual costs: every supplier charge recorded against the shipment, whatever its approval status.</li>
              <li>Actual profit to date is provisional: more supplier charges may still arrive before a job is closed.</li>
              <li>Customs duty paid for a customer is a disbursement: it appears as both a cost and part of the invoice.</li>
              <li>Approving and paying expenses needs finance permissions and a backend; this page cannot do either.</li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
