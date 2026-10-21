'use client';

// Customer / agent / carrier detail. Shipments and quotations come from the
// session store (so jobs created in this tab appear), as do documents;
// invoices and payments are the static demo records passed in by the page.

import Link from 'next/link';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { DetailList } from '@/components/ui/detail-list';
import { PageHeader } from '@/components/ui/page-header';
import { DataSourceNotice, EmptyState, PendingNotice } from '@/components/ui/states';
import { Table, Td, Th } from '@/components/ui/table';
import { ShipmentTable } from '@/components/shipments/shipment-table';
import { quotationHref } from '@/components/quotations/quotation-list';
import { accountSummary, buildCustomerHistory, invoiceHref } from '@/lib/customer-history';
import { useSessionStore } from '@/lib/data/session-store';
import { formatDate, formatKes } from '@/lib/format';
import { accountStatusMeta, invoiceStatusMeta, modeLabel, partyTypeLabel, paymentMethodLabel, quotationStatusMeta, routeLabel } from '@/lib/labels';
import { isActive } from '@/lib/metrics';
import { formatMoney } from '@/lib/money';
import { effectiveQuotationStatus, quotationTotals } from '@/lib/quotations';
import type { DataSource, Invoice, Party, Payment, Quotation } from '@/lib/types';
import { shipmentsForParty } from './party-table';
import { ServiceHistory } from './service-history';

const monoLink = 'rounded font-mono text-[13px] text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600';
const notRecorded = <span className="text-slate-500">Not recorded</span>;

interface PartyDetailViewProps {
  party: Party;
  invoices: Invoice[];
  payments: Payment[];
  referenceDate: string;
  source: DataSource;
}

function InvoiceTable({ invoices, caption }: { invoices: Invoice[]; caption: string }) {
  return (
    <Table caption={caption}>
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
        {invoices.map((inv) => (
          <tr key={inv.number}>
            <Td>
              <Link href={invoiceHref(inv.number)} className={monoLink}>
                {inv.number}
              </Link>
              <p>
                <Link href={`/shipments/${encodeURIComponent(inv.shipmentReference)}`} className={`${monoLink} text-xs`}>
                  {inv.shipmentReference}
                </Link>
              </p>
            </Td>
            <Td>{inv.customerName}</Td>
            <Td className="text-right tabular-nums">{formatKes(inv.amountKes)}</Td>
            <Td className="text-right tabular-nums">{formatKes(inv.amountKes - inv.paidKes)}</Td>
            <Td>
              <StatusBadge meta={invoiceStatusMeta[inv.status]} />
            </Td>
            <Td className="whitespace-nowrap">{formatDate(inv.dueAt)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function QuotationRows({ quotations, referenceDate }: { quotations: Quotation[]; referenceDate: string }) {
  if (quotations.length === 0) return <EmptyState title="No quotations" />;
  return (
    <ul className="divide-y divide-slate-100">
      {quotations.map((q) => (
        <li key={q.reference} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
          <div>
            <Link href={quotationHref(q.reference)} className={monoLink}>
              {q.reference}
            </Link>
            <p className="text-xs text-slate-500">
              {q.customerName} · {q.origin} → {q.destination} · issued {formatDate(q.issuedAt)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm tabular-nums">{formatMoney(quotationTotals(q.lines).totalMinor, q.currency)}</span>
            <StatusBadge meta={quotationStatusMeta[effectiveQuotationStatus(q, referenceDate)]} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function CustomerSections({ party, invoices, payments, referenceDate }: Omit<PartyDetailViewProps, 'source'>) {
  const store = useSessionStore();
  const documents = store.documents;
  const shipments = shipmentsForParty(party, store.shipments);
  const quotations = store.quotations.filter((q) => q.customerId === party.id);
  const own = invoices.filter((i) => i.customerName === party.name);
  const ownPayments = payments.filter((p) => p.customerName === party.name);
  const summary = accountSummary(own);
  const billing = party.billing;
  const history = buildCustomerHistory(
    { shipments, quotations, documents: documents.filter((d) => d.customerName === party.name), invoices: own, payments: ownPayments },
    referenceDate,
  );

  return (
    <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Billing profile" description="Fictional demo values. Fields not held in the demo data show as not recorded." />
          <CardBody>
            {billing ? (
              <DetailList
                columns={3}
                items={[
                  { label: 'Billing contact', value: billing.contactName },
                  { label: 'Billing email', value: billing.email },
                  { label: 'Phone', value: billing.phone ?? notRecorded },
                  { label: 'Billing address', value: billing.address.map((l) => <span key={l} className="block">{l}</span>) },
                  { label: 'KRA PIN', value: billing.taxPin ?? notRecorded },
                  { label: 'Payment terms', value: `${billing.paymentTermsDays} days from invoice` },
                  { label: 'Billing currency', value: billing.currency },
                  { label: 'Account status', value: <StatusBadge meta={accountStatusMeta[billing.accountStatus]} /> },
                  { label: 'Credit limit', value: billing.creditLimitKes !== undefined ? formatKes(billing.creditLimitKes) : notRecorded },
                ]}
              />
            ) : (
              <EmptyState title="No billing profile recorded" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Account balance" description="Indicative, from the demo invoices. Not an authoritative ledger." />
          <CardBody className="flex flex-col gap-4">
            <DetailList
              columns={1}
              items={[
                { label: 'Invoiced (issued invoices)', value: formatKes(summary.invoicedKes) },
                { label: 'Paid against these invoices', value: formatKes(summary.paidKes) },
                { label: 'Outstanding', value: <span className="font-semibold">{formatKes(summary.outstandingKes)}</span> },
                {
                  label: 'Overdue',
                  value: summary.overdueCount ? (
                    <span className="font-medium text-red-700">{`${formatKes(summary.overdueKes)} (${summary.overdueCount} invoice${summary.overdueCount === 1 ? '' : 's'})`}</span>
                  ) : (
                    'None'
                  ),
                },
                {
                  label: 'Available credit',
                  value:
                    billing?.creditLimitKes !== undefined ? formatKes(billing.creditLimitKes - summary.outstandingKes) : 'Cannot be calculated: no credit limit recorded',
                },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Service history" description="Shipments, quotations, documents, invoices and payments for this customer" />
        <ServiceHistory entries={history} />
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Shipments"
          description={`${shipments.filter(isActive).length} active · ${shipments.length} total`}
          action={{ href: `/shipments?view=all&customer=${encodeURIComponent(party.id)}`, label: 'Open in shipment list' }}
        />
        {shipments.length ? <ShipmentTable shipments={shipments} caption={`Shipments for ${party.name}`} /> : <EmptyState title="No shipments" />}
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Quotations" />
          <QuotationRows quotations={quotations} referenceDate={referenceDate} />
        </Card>
        <Card>
          <CardHeader title="Payments received" description="Recorded manually (demo). Not M-Pesa or bank-verified." />
          {ownPayments.length === 0 ? (
            <EmptyState title="No payments recorded" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {ownPayments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 sm:px-5">
                  <div>
                    <p className="text-sm text-slate-900">
                      {paymentMethodLabel[p.method]} · {p.reference}
                    </p>
                    <p className="text-xs text-slate-500">
                      For {p.invoiceNumber}
                      {own.some((i) => i.number === p.invoiceNumber) ? '' : ' (invoice not in the demo data)'} · {formatDate(p.receivedAt)}
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
      </div>

      <Card className="mt-6">
        <CardHeader title="Invoices" />
        {own.length ? <InvoiceTable invoices={own} caption={`Invoices for ${party.name}`} /> : <EmptyState title="No invoices" />}
      </Card>
    </>
  );
}

function AgentSections({ party, invoices, referenceDate }: Omit<PartyDetailViewProps, 'source' | 'payments'>) {
  const store = useSessionStore();
  const jobs = shipmentsForParty(party, store.shipments);
  const routes = party.routes ?? [];
  const jobRefs = new Set(jobs.map((s) => s.reference));
  const jobInvoices = invoices.filter((i) => jobRefs.has(i.shipmentReference));
  const quotations = store.quotations.filter((q) => q.agentName === party.name);
  const unrouted = jobs.filter((s) => !s.agentRouteId || !routes.some((r) => r.id === s.agentRouteId));

  return (
    <>
      <Card>
        <CardHeader
          title="Supported routes"
          description="Lanes this agent handles on demo jobs. Not an agreement, rate card or service commitment."
        />
        {routes.length === 0 ? (
          <EmptyState title="No routes recorded" />
        ) : (
          <Table caption={`Routes for ${party.name}`}>
            <thead>
              <tr>
                <Th>Origin</Th>
                <Th>Destination</Th>
                <Th>Modes</Th>
                <Th>Role</Th>
                <Th className="text-right">Jobs</Th>
              </tr>
            </thead>
            <tbody>
              {routes.map((r) => {
                const count = jobs.filter((s) => s.agentRouteId === r.id).length;
                return (
                  <tr key={r.id}>
                    <Td className="font-medium text-slate-900">{r.origin}</Td>
                    <Td>{r.destination}</Td>
                    <Td>{r.modes.map((m) => modeLabel[m]).join(', ')}</Td>
                    <Td className="text-slate-600">{r.services}</Td>
                    <Td className="text-right tabular-nums">{count}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        {unrouted.length > 0 && (
          <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500 sm:px-5">
            {unrouted.length} job{unrouted.length === 1 ? ' has' : 's have'} no route recorded: {unrouted.map((s) => s.reference).join(', ')}.
          </p>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Related jobs"
          description={`${jobs.filter(isActive).length} active · ${jobs.length} total`}
          action={{ href: `/shipments?view=all&agent=${encodeURIComponent(party.name)}`, label: 'Open in shipment list' }}
        />
        {jobs.length === 0 ? (
          <EmptyState title="No jobs with this agent" />
        ) : (
          <>
            <ShipmentTable shipments={jobs} caption={`Jobs handled by ${party.name}`} />
            <ul className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500 sm:px-5">
              {jobs.map((s) => {
                const route = routes.find((r) => r.id === s.agentRouteId);
                return (
                  <li key={s.reference}>
                    <span className="font-mono">{s.reference}</span>: {route ? routeLabel(route) : 'no route recorded'}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Customer invoices on these jobs" description="What the customer was billed. The agent's own charges are not recorded in the demo data." />
          {jobInvoices.length ? (
            <InvoiceTable invoices={jobInvoices} caption={`Invoices on jobs handled by ${party.name}`} />
          ) : (
            <EmptyState title="No invoices on these jobs" />
          )}
        </Card>
        <Card>
          <CardHeader title="Quotations naming this agent" />
          <QuotationRows quotations={quotations} referenceDate={referenceDate} />
        </Card>
      </div>
    </>
  );
}

function CarrierSections({ party }: { party: Party }) {
  const { shipments } = useSessionStore();
  const jobs = shipmentsForParty(party, shipments);
  return (
    <Card>
      <CardHeader title="Shipments carried" description={`${jobs.filter(isActive).length} active · ${jobs.length} total`} />
      {jobs.length ? <ShipmentTable shipments={jobs} caption={`Shipments carried by ${party.name}`} /> : <EmptyState title="No shipments" />}
    </Card>
  );
}

export function PartyDetailView(props: PartyDetailViewProps) {
  const { party, source } = props;
  return (
    <>
      <PageHeader title={party.name} description={`${partyTypeLabel[party.type]} · ${party.location}`} back={party.type === 'customer' ? { href: '/parties', label: 'Customers & agents' } : { href: '/agents', label: 'Agents & partners' }}>
        <Badge tone="neutral">{partyTypeLabel[party.type]}</Badge>
        {party.type === 'customer' && (
          <ButtonLink href="/quotations/new" variant="secondary" size="sm">
            New quotation
          </ButtonLink>
        )}
      </PageHeader>
      <DataSourceNotice source={source}>
        Contact emails use the reserved .example domain. Balances and relationships are calculated from demo records and are not authoritative.
      </DataSourceNotice>

      <Card className="mb-6">
        <CardHeader title="Contact" />
        <CardBody>
          <DetailList
            columns={3}
            items={[
              { label: 'Contact', value: party.contactName },
              { label: 'Email', value: party.email },
              { label: 'Location', value: party.location },
            ]}
          />
        </CardBody>
      </Card>

      {party.type === 'customer' && <CustomerSections {...props} />}
      {party.type === 'agent' && <AgentSections {...props} />}
      {(party.type === 'supplier' || party.type === 'transporter') && <CarrierSections party={party} />}

      <div className="mt-6">
        <PendingNotice title="Editing customer and agent records is not available yet">
          Billing profiles, routes and contacts are read-only in this demo. Changing them needs the party API described in
          docs/api-contracts.md.
        </PendingNotice>
      </div>
    </>
  );
}
