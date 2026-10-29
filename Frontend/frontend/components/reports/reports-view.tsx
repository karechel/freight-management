'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { inputClass } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { DataSourceNotice, EmptyState, PendingNotice } from '@/components/ui/states';
import { Table, Td, Th } from '@/components/ui/table';
import { shipmentHref } from '@/components/shipments/shipment-table';
import { useSessionStore } from '@/lib/data/session-store';
import { formatDate, formatDateTime, formatDuration, formatKes } from '@/lib/format';
import { customsStatusMeta, modeLabel, shipmentStatusMeta, shipmentStatusOrder } from '@/lib/labels';
import { costingTotals, marginPercent } from '@/lib/profitability';
import {
  agingBucketLabel,
  arrivalPerformance,
  countBy,
  customsDelays,
  emptyReportFilters,
  filterShipments,
  monthKey,
  ON_TIME_GRACE_HOURS,
  outstandingInvoices,
  profitabilityRows,
  revenueAndExpensesByMonth,
  type AgingBucket,
  type ReportFilters,
} from '@/lib/reports';
import type { CostEstimate, DataSource, Invoice, ShipmentStatus, TransportMode } from '@/lib/types';
import { BarList, CsvButton } from './report-parts';

const linkClass = 'rounded font-mono text-xs text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600';

const monthFormatter = new Intl.DateTimeFormat('en-KE', { month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi' });
const monthLabel = (key: string) => monthFormatter.format(new Date(`${key}-15T12:00:00+03:00`));

const modes: TransportMode[] = ['sea', 'air', 'road', 'rail'];
const HOUR_MS = 60 * 60 * 1000;

function lateness(hours: number): string {
  if (hours <= 0) return hours === 0 ? 'On ETA' : `${formatDuration(-hours * HOUR_MS)} early`;
  return `${formatDuration(hours * HOUR_MS)} late`;
}

function Tile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900 tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function Labelled({ id, label, children }: { id: string; label: string; children: (id: string) => React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-slate-600">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

export function ReportsView({
  invoices,
  estimates,
  customers,
  referenceDate,
  source,
}: {
  invoices: Invoice[];
  estimates: CostEstimate[];
  customers: { id: string; name: string }[];
  referenceDate: string;
  source: DataSource;
}) {
  const { shipments: allShipments, quotations, expenses: allExpenses } = useSessionStore();
  const [filters, setFilters] = useState<ReportFilters>(emptyReportFilters);
  const set = <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const filtered = Object.values(filters).some(Boolean);

  const shipments = filterShipments(allShipments, filters);
  const refs = new Set(shipments.map((s) => s.reference));
  const scopedInvoices = invoices.filter((i) => refs.has(i.shipmentReference));
  const scopedExpenses = allExpenses.filter((e) => refs.has(e.shipmentReference));

  const byMode = countBy(shipments, (s) => s.mode);
  const byStatus = countBy(shipments, (s) => s.status);
  const byMonth = countBy(shipments, (s) => monthKey(s.eta));
  const arrivals = arrivalPerformance(shipments);
  const customs = customsDelays(shipments, referenceDate);
  const outstanding = outstandingInvoices(scopedInvoices, referenceDate);
  const outstandingTotal = outstanding.reduce((s, r) => s + r.balanceKes, 0);
  const aging = (Object.keys(agingBucketLabel) as AgingBucket[]).map((bucket) => {
    const value = outstanding.filter((r) => r.bucket === bucket).reduce((s, r) => s + r.balanceKes, 0);
    return { label: agingBucketLabel[bucket], value, display: formatKes(value) };
  });
  const monthly = revenueAndExpensesByMonth(scopedInvoices, scopedExpenses);
  const profit = profitabilityRows(shipments, { invoices, quotations, estimates, expenses: allExpenses });
  const profitTotals = costingTotals(profit);

  return (
    <>
      <PageHeader
        title="Reports & analytics"
        description="Shipment volumes, delivery performance, customs delays, receivables, revenue, costs and profitability."
      >
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          Print / save as PDF
        </Button>
      </PageHeader>
      <DataSourceNotice source={source}>
        Figures are calculated in your browser from the demo records and any edits made in this tab. Ages and overdue days
        are measured against the fixed demo date, {formatDate(referenceDate)}.
      </DataSourceNotice>

      <Card className="mb-6 print:hidden">
        <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
          <Labelled id="report-from" label="Planned ETA from">
            {(id) => <input id={id} type="date" value={filters.from} onChange={(e) => set('from', e.target.value)} className={`${inputClass} w-full`} />}
          </Labelled>
          <Labelled id="report-to" label="Planned ETA to">
            {(id) => <input id={id} type="date" value={filters.to} onChange={(e) => set('to', e.target.value)} className={`${inputClass} w-full`} />}
          </Labelled>
          <Labelled id="report-customer" label="Customer">
            {(id) => (
              <select id={id} value={filters.customerId} onChange={(e) => set('customerId', e.target.value)} className={`${inputClass} w-full`}>
                <option value="">All customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </Labelled>
          <Labelled id="report-status" label="Shipment status">
            {(id) => (
              <select id={id} value={filters.status} onChange={(e) => set('status', e.target.value as '' | ShipmentStatus)} className={`${inputClass} w-full`}>
                <option value="">All statuses</option>
                {shipmentStatusOrder.map((s) => (
                  <option key={s} value={s}>
                    {shipmentStatusMeta[s].label}
                  </option>
                ))}
              </select>
            )}
          </Labelled>
          <Labelled id="report-mode" label="Transport mode">
            {(id) => (
              <select id={id} value={filters.mode} onChange={(e) => set('mode', e.target.value as '' | TransportMode)} className={`${inputClass} w-full`}>
                <option value="">All modes</option>
                {modes.map((m) => (
                  <option key={m} value={m}>
                    {modeLabel[m]}
                  </option>
                ))}
              </select>
            )}
          </Labelled>
          <Button variant="secondary" onClick={() => setFilters(emptyReportFilters)} disabled={!filtered}>
            Reset filters
          </Button>
        </CardBody>
        <p className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500 sm:px-5" role="status">
          {shipments.length} of {allShipments.length} shipments match. Invoices and expenses are included when their shipment matches.
        </p>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Shipments" value={String(shipments.length)} detail={`${shipments.filter((s) => s.status !== 'delivered').length} active`} />
        <Tile
          label="On-time arrivals"
          value={arrivals.onTimePercent === undefined ? '—' : `${arrivals.onTimePercent}%`}
          detail={`${arrivals.onTime} of ${arrivals.measured} arrived within ${ON_TIME_GRACE_HOURS} h of ETA`}
        />
        <Tile label="Held at customs" value={String(customs.length)} detail="Query, missing documents or customs-related delay" />
        <Tile label="Outstanding invoices" value={formatKes(outstandingTotal)} detail={`${outstanding.length} invoices with a balance`} />
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader title="Shipment volumes" description="Number of shipments matching the filters">
            <CsvButton
              filename="shipment-volumes.csv"
              rows={() => [
                ['Reference', 'Customer', 'Mode', 'Status', 'Planned ETA'],
                ...shipments.map((s) => [s.reference, s.customerName, modeLabel[s.mode], shipmentStatusMeta[s.status].label, s.eta]),
              ]}
            />
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div>
              <h3 className="mb-3 text-xs font-semibold tracking-wide text-slate-600 uppercase">By transport mode</h3>
              <BarList
                label="Shipments by transport mode"
                data={modes.filter((m) => byMode[m]).map((m) => ({ label: modeLabel[m], value: byMode[m] ?? 0, display: String(byMode[m] ?? 0) }))}
              />
            </div>
            <div>
              <h3 className="mb-3 text-xs font-semibold tracking-wide text-slate-600 uppercase">By status</h3>
              <BarList
                label="Shipments by status"
                data={shipmentStatusOrder
                  .filter((s) => byStatus[s])
                  .map((s) => ({ label: shipmentStatusMeta[s].label, value: byStatus[s] ?? 0, display: String(byStatus[s] ?? 0) }))}
              />
            </div>
            <div>
              <h3 className="mb-3 text-xs font-semibold tracking-wide text-slate-600 uppercase">By planned ETA month</h3>
              <BarList
                label="Shipments by planned ETA month"
                data={Object.keys(byMonth)
                  .sort()
                  .map((m) => ({ label: monthLabel(m), value: byMonth[m] ?? 0, display: String(byMonth[m] ?? 0) }))}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Delivery performance"
            description={`Actual arrival against the planned ETA. Within ${ON_TIME_GRACE_HOURS} h counts as on time.${arrivals.averageLateHours ? ` Late arrivals average ${formatDuration(arrivals.averageLateHours * HOUR_MS)}.` : ''}`}
          >
            <CsvButton
              filename="delivery-performance.csv"
              rows={() => [
                ['Reference', 'Customer', 'Mode', 'Planned ETA', 'Actual arrival', 'Hours late (negative = early)'],
                ...arrivals.rows.map((r) => [r.reference, r.customerName, modeLabel[r.mode], r.eta, r.ata, r.lateHours]),
              ]}
            />
          </CardHeader>
          {arrivals.rows.length === 0 ? (
            <EmptyState title="No arrivals for these filters" />
          ) : (
            <Table caption="Delivery performance">
              <thead>
                <tr>
                  <Th>Shipment</Th>
                  <Th>Mode</Th>
                  <Th>Planned ETA</Th>
                  <Th>Actual arrival</Th>
                  <Th>Against ETA</Th>
                </tr>
              </thead>
              <tbody>
                {arrivals.rows.map((r) => (
                  <tr key={r.reference}>
                    <Td>
                      <Link href={shipmentHref(r.reference)} className={linkClass}>
                        {r.reference}
                      </Link>
                      <p className="text-xs text-slate-600">{r.customerName}</p>
                    </Td>
                    <Td>{modeLabel[r.mode]}</Td>
                    <Td className="whitespace-nowrap">{formatDateTime(r.eta)}</Td>
                    <Td className="whitespace-nowrap">{formatDateTime(r.ata)}</Td>
                    <Td className={r.lateHours > ON_TIME_GRACE_HOURS ? 'font-medium text-red-700' : ''}>{lateness(r.lateHours)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Customs delays" description="Active shipments with a customs query, missing documents or a customs-related delay">
            <CsvButton
              filename="customs-delays.csv"
              rows={() => [
                ['Reference', 'Customer', 'Customs status', 'Days since arrival', 'Issues'],
                ...customs.map((r) => [r.reference, r.customerName, customsStatusMeta[r.customsStatus].label, r.daysSinceArrival ?? '', r.issues.join(' | ')]),
              ]}
            />
          </CardHeader>
          {customs.length === 0 ? (
            <EmptyState title="No customs delays for these filters" />
          ) : (
            <Table caption="Customs delays">
              <thead>
                <tr>
                  <Th>Shipment</Th>
                  <Th>Customs status</Th>
                  <Th className="text-right">Days since arrival</Th>
                  <Th>Issue</Th>
                </tr>
              </thead>
              <tbody>
                {customs.map((r) => (
                  <tr key={r.reference}>
                    <Td>
                      <Link href={shipmentHref(r.reference)} className={linkClass}>
                        {r.reference}
                      </Link>
                      <p className="text-xs text-slate-600">{r.customerName}</p>
                    </Td>
                    <Td>
                      <StatusBadge meta={customsStatusMeta[r.customsStatus]} />
                    </Td>
                    <Td className="text-right tabular-nums">{r.daysSinceArrival ?? 'Not arrived'}</Td>
                    <Td className="max-w-md">{r.issues.length ? r.issues.join(' ') : 'No details recorded'}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="Outstanding invoices" description={`Balance by age, ${formatKes(outstandingTotal)} in total`}>
              <CsvButton
                filename="outstanding-invoices.csv"
                rows={() => [
                  ['Invoice', 'Customer', 'Shipment', 'Balance (KES)', 'Due', 'Days overdue'],
                  ...outstanding.map((r) => [r.number, r.customerName, r.shipmentReference, r.balanceKes, r.dueAt, r.daysOverdue]),
                ]}
              />
            </CardHeader>
            <CardBody className="flex flex-col gap-5">
              <BarList label="Outstanding balance by age" data={aging} />
              {outstanding.length > 0 && (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
                  {outstanding.map((r) => (
                    <li key={r.number} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <span>
                        <Link href={`/finance#${r.number}`} className={linkClass}>
                          {r.number}
                        </Link>
                        <span className="block text-xs text-slate-600">{r.customerName}</span>
                      </span>
                      <span className="text-right">
                        <span className="block font-medium tabular-nums">{formatKes(r.balanceKes)}</span>
                        <span className="text-xs text-slate-500">{r.daysOverdue ? `${r.daysOverdue} days overdue` : `Due ${formatDate(r.dueAt)}`}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Revenue and expenses" description="Invoiced (excluding drafts) by issue month; supplier costs by month incurred">
              <CsvButton
                filename="revenue-and-expenses.csv"
                rows={() => [
                  ['Month', 'Invoiced (KES)', 'Expenses (KES)', 'Difference (KES)'],
                  ...monthly.map((m) => [m.month, m.invoicedKes, m.expensesKes, m.invoicedKes - m.expensesKes]),
                ]}
              />
            </CardHeader>
            {monthly.length === 0 ? (
              <EmptyState title="No invoices or expenses for these filters" />
            ) : (
              <Table caption="Revenue and expenses by month">
                <thead>
                  <tr>
                    <Th>Month</Th>
                    <Th className="text-right">Invoiced</Th>
                    <Th className="text-right">Expenses</Th>
                    <Th className="text-right">Difference</Th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m) => (
                    <tr key={m.month}>
                      <Td className="font-medium text-slate-900">{monthLabel(m.month)}</Td>
                      <Td className="text-right tabular-nums">{formatKes(m.invoicedKes)}</Td>
                      <Td className="text-right tabular-nums">{formatKes(m.expensesKes)}</Td>
                      <Td className={`text-right tabular-nums ${m.invoicedKes - m.expensesKes < 0 ? 'text-red-700' : ''}`}>
                        {formatKes(m.invoicedKes - m.expensesKes)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <p className="px-4 py-3 text-xs text-slate-500 sm:px-5">
              Invoices and costs fall in different months for the same job, so a monthly difference is not a job margin. See
              shipment profitability below.
            </p>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Shipment profitability"
            description={`Estimated profit ${formatKes(profitTotals.estimatedProfitKes)} · actual to date ${formatKes(profitTotals.actualProfitKes)}`}
            action={{ href: '/expenses', label: 'Expenses & profitability' }}
          >
            <CsvButton
              filename="shipment-profitability.csv"
              rows={() => [
                ['Reference', 'Customer', 'Estimated charge', 'Invoiced', 'Estimated cost', 'Actual cost', 'Estimated profit', 'Actual profit to date'],
                ...profit.map((c) => [
                  c.reference,
                  c.customerName,
                  c.estimatedChargeKes ?? '',
                  c.invoicedKes,
                  c.estimatedCostKes ?? '',
                  c.actualCostKes,
                  c.estimatedProfitKes ?? '',
                  c.actualProfitKes ?? '',
                ]),
              ]}
            />
          </CardHeader>
          <CardBody className="border-b border-slate-200">
            <BarList
              label="Estimated profit by shipment"
              data={profit
                .filter((c) => (c.estimatedProfitKes ?? 0) > 0)
                .map((c) => ({ label: c.reference, value: c.estimatedProfitKes ?? 0, display: formatKes(c.estimatedProfitKes ?? 0) }))}
            />
          </CardBody>
          {profit.length === 0 ? (
            <EmptyState title="No shipments with costing for these filters" />
          ) : (
            <Table caption="Shipment profitability">
              <thead>
                <tr>
                  <Th>Shipment</Th>
                  <Th className="text-right">Estimated profit</Th>
                  <Th className="text-right">Estimated margin</Th>
                  <Th className="text-right">Actual profit to date</Th>
                  <Th className="text-right">Actual margin</Th>
                </tr>
              </thead>
              <tbody>
                {profit.map((c) => {
                  const estMargin = marginPercent(c.estimatedProfitKes, c.estimatedChargeKes);
                  const actMargin = marginPercent(c.actualProfitKes, c.invoicedKes);
                  return (
                    <tr key={c.reference}>
                      <Td>
                        <Link href={shipmentHref(c.reference)} className={linkClass}>
                          {c.reference}
                        </Link>
                        <p className="text-xs text-slate-600">{c.customerName}</p>
                      </Td>
                      <Td className="text-right tabular-nums">{c.estimatedProfitKes === undefined ? '—' : formatKes(c.estimatedProfitKes)}</Td>
                      <Td className="text-right tabular-nums">{estMargin === undefined ? '—' : `${estMargin}%`}</Td>
                      <Td className="text-right tabular-nums">{c.actualProfitKes === undefined ? '—' : formatKes(c.actualProfitKes)}</Td>
                      <Td className="text-right tabular-nums">{actMargin === undefined ? '—' : `${actMargin}%`}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <PendingNotice title="Scheduled and emailed reports are planned">
          CSV downloads and printing work now: they are generated in this browser from the figures on screen and nothing is
          sent anywhere. Scheduled reports, emailing and Excel or PDF files produced by the system need a backend and are not
          built.
        </PendingNotice>
      </div>
    </>
  );
}
