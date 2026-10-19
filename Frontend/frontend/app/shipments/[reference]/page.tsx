import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MilestoneTimeline } from '@/components/shipments/milestone-timeline';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { DetailList } from '@/components/ui/detail-list';
import { AlertIcon, ModeIcon } from '@/components/ui/icons';
import { PageHeader } from '@/components/ui/page-header';
import { DataSourceNotice, EmptyState, PendingNotice } from '@/components/ui/states';
import { Table, Td, Th } from '@/components/ui/table';
import { getDocuments, getExpenses, getInvoices, getShipment } from '@/lib/data';
import { formatDate, formatDateTime, formatKes, formatNumber } from '@/lib/format';
import {
  customsStatusMeta,
  directionLabel,
  documentStatusMeta,
  documentTypeLabel,
  invoiceStatusMeta,
  modeLabel,
  severityMeta,
  shipmentStatusMeta,
} from '@/lib/labels';

// Next.js passes `params` already URL-decoded, so they are used as-is.

export async function generateMetadata({ params }: PageProps<'/shipments/[reference]'>): Promise<Metadata> {
  const { reference } = await params;
  return { title: `Shipment ${reference}` };
}

export default async function ShipmentDetailPage({ params }: PageProps<'/shipments/[reference]'>) {
  const { reference } = await params;
  const shipment = await getShipment(reference);
  if (!shipment.data) notFound();
  const s = shipment.data;

  const [documents, invoices, expenses] = await Promise.all([
    getDocuments(s.reference),
    getInvoices(s.reference),
    getExpenses(s.reference),
  ]);
  const expenseTotal = expenses.data.reduce((sum, e) => sum + e.amountKes, 0);
  const invoicedTotal = invoices.data.reduce((sum, i) => sum + i.amountKes, 0);

  return (
    <>
      <PageHeader
        title={s.reference}
        description={`${s.customerName} · ${s.cargoDescription}`}
        back={{ href: '/shipments', label: 'All shipments' }}
      >
        <Badge tone="neutral">
          <ModeIcon mode={s.mode} className="size-3.5" />
          {modeLabel[s.mode]} · {directionLabel[s.direction]}
        </Badge>
        <StatusBadge meta={shipmentStatusMeta[s.status]} />
      </PageHeader>

      <DataSourceNotice source={shipment.source}>
        Status changes, uploads and notes cannot be saved until the shipment API exists.
      </DataSourceNotice>

      {s.exceptions.length > 0 && (
        <section aria-labelledby="exceptions-heading" className="mb-6 rounded-xl border border-red-200 bg-red-50/60 px-4 py-3 sm:px-5">
          <h2 id="exceptions-heading" className="flex items-center gap-2 text-sm font-semibold text-red-900">
            <AlertIcon className="size-4" /> Open exceptions
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {s.exceptions.map((ex) => (
              <li key={ex.id} className="flex flex-col gap-1 text-sm text-red-950 sm:flex-row sm:items-start sm:gap-3">
                <StatusBadge meta={severityMeta[ex.severity]} />
                <span className="flex-1">{ex.message}</span>
                <span className="text-xs whitespace-nowrap text-red-800">{formatDateTime(ex.raisedAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader title="Shipment details" />
            <CardBody>
              <DetailList
                columns={3}
                items={[
                  { label: 'Origin', value: s.origin },
                  { label: 'Destination', value: s.destination },
                  { label: 'Carrier', value: s.carrier },
                  { label: s.mode === 'air' ? 'Air waybill' : s.mode === 'sea' ? 'Bill of lading' : 'Consignment note', value: <span className="font-mono text-[13px]">{s.transportDocRef}</span> },
                  { label: 'Equipment', value: s.equipment },
                  { label: 'Packages / weight', value: `${formatNumber(s.packages)} pkgs · ${formatNumber(s.weightKg)} kg` },
                  { label: 'ETD', value: s.etd ? formatDate(s.etd) : '—' },
                  { label: 'ETA', value: formatDate(s.eta) },
                  { label: 'Last update', value: formatDateTime(s.updatedAt) },
                  { label: 'Customer', value: s.customerName },
                  { label: 'Overseas / partner agent', value: s.agentName ?? '—' },
                  { label: 'Assigned to', value: s.assignedTo },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Documents" description="Required shipping and clearing documents for this job" />
            {documents.data.length === 0 ? (
              <EmptyState title="No documents recorded" description="Documents for this shipment will be listed here." />
            ) : (
              <Table caption={`Documents for ${s.reference}`}>
                <thead>
                  <tr>
                    <Th>Document</Th>
                    <Th>Status</Th>
                    <Th>Received</Th>
                    <Th>Note</Th>
                  </tr>
                </thead>
                <tbody>
                  {documents.data.map((d) => (
                    <tr key={d.id}>
                      <Td className="font-medium text-slate-900">{documentTypeLabel[d.type]}</Td>
                      <Td><StatusBadge meta={documentStatusMeta[d.status]} /></Td>
                      <Td className="whitespace-nowrap">{d.receivedAt ? formatDate(d.receivedAt) : '—'}</Td>
                      <Td className="text-slate-600">{d.note ?? '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500 sm:px-5">
              File upload and viewing need private, access-controlled storage, which is not built yet.
            </p>
          </Card>

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
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Tracking milestones" />
            <CardBody>
              <MilestoneTimeline milestones={s.milestones} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Customs" />
            <CardBody className="flex flex-col gap-4">
              <DetailList
                columns={1}
                items={[
                  { label: 'Status', value: <StatusBadge meta={customsStatusMeta[s.customs.status]} /> },
                  { label: 'Internal entry reference', value: s.customs.entryReference ?? '—' },
                  { label: 'Duty and taxes (recorded)', value: s.customs.dutyKes !== undefined ? formatKes(s.customs.dutyKes) : '—' },
                  { label: 'Last update', value: formatDateTime(s.customs.updatedAt) },
                ]}
              />
              <PendingNotice title="KRA iCMS integration pending">
                Customs status here is recorded manually. It is not synchronised with KRA iCMS.
              </PendingNotice>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
