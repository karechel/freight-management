import type { Metadata } from 'next';
import { AuditLog } from '@/components/settings/audit-log';
import { BackendHealthCard } from '@/components/settings/backend-health-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { DetailList } from '@/components/ui/detail-list';
import { PageHeader } from '@/components/ui/page-header';
import { PendingNotice } from '@/components/ui/states';
import { Table, Td, Th } from '@/components/ui/table';
import { DEMO_REFERENCE_DATE } from '@/lib/data';
import { allowedSummary, MAX_FILES_PER_UPLOAD, MAX_SESSION_BYTES, formatBytes } from '@/lib/document-upload';
import { formatDate } from '@/lib/format';
import { currencyLabel, expenseCategoryLabel } from '@/lib/labels';
import type { Currency, ExpenseCategory } from '@/lib/types';

export const metadata: Metadata = { title: 'Settings & audit log' };

const sections = [
  { id: 'company', label: 'Company' },
  { id: 'currencies', label: 'Currencies' },
  { id: 'charges', label: 'Charge categories' },
  { id: 'numbering', label: 'Numbering' },
  { id: 'configuration', label: 'Other configuration' },
  { id: 'status', label: 'System status' },
  { id: 'audit', label: 'Audit log' },
];

const integrations = [
  { name: 'Authentication & roles', status: 'Not built', tone: 'warning', note: 'No sign-in, sessions or role-based access control. Anyone who can reach the app sees everything.' },
  { name: 'Freight data API', status: 'Not built', tone: 'warning', note: 'No backend endpoints for shipments, documents, quotations, parties or finance. All pages use demo data; edits made in the forms are kept in the browser tab only and are lost on reload.' },
  { name: 'Document storage', status: 'Not built', tone: 'warning', note: 'Requires private, access-controlled storage. Files chosen on the upload page stay in the browser tab’s memory; none are uploaded or stored.' },
  { name: 'KRA iCMS', status: 'Pending', tone: 'neutral', note: 'Not integrated. Access and onboarding status unknown.' },
  { name: 'M-Pesa (Daraja)', status: 'Pending', tone: 'neutral', note: 'Not integrated. Sandbox access status unknown.' },
] as const;

const plannedModules = [
  'Customer portal',
  'Agent portal',
  'Notification delivery (email, SMS) and scheduled reminders (the notifications and tasks page is a demo preview)',
  'Transport, warehouse and delivery management',
  'Backend for reports, user administration, settings and the audit log (these pages are demo previews)',
];

const currencies: { code: Currency; use: string }[] = [
  { code: 'KES', use: 'Base currency. Invoices, payments, expenses, reports and customer balances.' },
  { code: 'USD', use: 'Quotations only. Not converted: no exchange-rate source is configured.' },
];

const chargeCategoryNotes: Record<ExpenseCategory, string> = {
  carrier: 'Ocean, air and rail freight; shipping-line and airline fees such as delivery orders',
  transport: 'Road haulage, last-mile delivery and trucking between port, ICD and site',
  handling: 'Port, ICD and airport terminal handling',
  storage: 'Warehouse, cold-store and port storage, including storage after the free period',
  customs: 'Duties and taxes paid for the customer (disbursements) and customs-related fees',
  agent_fees: 'Origin, border and destination agent charges',
  other: 'Anything else; describe it on the expense',
};

const numbering = [
  { record: 'Shipments', pattern: 'FMS-<MODE>-<YYMM>-<NNNN>', example: 'FMS-SEA-2610-0041', note: 'Assigned when a shipment is created; NNNN continues the highest number in use.' },
  { record: 'Quotations', pattern: 'QT-<YYMM>-<NNNN>', example: 'QT-2610-0057', note: 'Assigned when a quotation is created or duplicated.' },
  { record: 'Invoices', pattern: 'INV-<YYMM>-<NNNN>', example: 'INV-2610-0112', note: 'Demo records only; invoices cannot be created in this interface yet.' },
  { record: 'Customs entries', pattern: 'DEMO-CE-<NNNN>', example: 'DEMO-CE-0041', note: 'Internal placeholders. Not KRA iCMS entry numbers.' },
];

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings & audit log"
        description="Company configuration, system status and a record of important changes."
      >
        <Badge tone="neutral">Read only</Badge>
      </PageHeader>
      <div className="mb-6">
        <PendingNotice title="Settings cannot be changed yet">
          These values are what the demo interface currently uses. Saving company settings needs a backend and administrator
          sign-in; neither exists, so nothing on this page can be edited.
        </PendingNotice>
      </div>

      <nav aria-label="Settings sections" className="mb-6 flex flex-wrap gap-2 print:hidden">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            {s.label}
          </a>
        ))}
      </nav>

      <div className="flex flex-col gap-6 [&>*]:scroll-mt-20">
        <div id="company">
          <Card>
            <CardHeader title="Company details" description="Shown on quotations and, later, invoices" />
            <CardBody>
              <DetailList
                columns={3}
                items={[
                  { label: 'Trading name', value: 'Freight Management (demo)' },
                  { label: 'Business', value: 'Freight forwarding and customs clearing' },
                  { label: 'Country', value: 'Kenya' },
                  { label: 'KRA PIN', value: 'Not recorded' },
                  { label: 'Registered address', value: 'Not recorded' },
                  { label: 'Customs agent licence', value: 'Not recorded' },
                ]}
              />
            </CardBody>
          </Card>
        </div>

        <div id="currencies">
          <Card>
            <CardHeader title="Currencies" />
            <ul className="divide-y divide-slate-100">
              {currencies.map((c) => (
                <li key={c.code} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{currencyLabel[c.code]}</p>
                    <p className="text-xs text-slate-600">{c.use}</p>
                  </div>
                  {c.code === 'KES' && <Badge tone="info">Base</Badge>}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div id="charges">
          <Card>
            <CardHeader title="Charge categories" description="Used to classify shipment expenses and cost estimates" />
            <ul className="divide-y divide-slate-100">
              {(Object.keys(expenseCategoryLabel) as ExpenseCategory[]).map((c) => (
                <li key={c} className="px-4 py-3 sm:px-5">
                  <p className="text-sm font-medium text-slate-900">{expenseCategoryLabel[c]}</p>
                  <p className="text-xs text-slate-600">{chargeCategoryNotes[c]}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div id="numbering">
          <Card>
            <CardHeader title="Document and transaction numbering" description="YYMM is the year and month of creation; NNNN is a running number" />
            <Table caption="Numbering formats">
              <thead>
                <tr>
                  <Th>Record</Th>
                  <Th>Format</Th>
                  <Th>Example</Th>
                  <Th>Notes</Th>
                </tr>
              </thead>
              <tbody>
                {numbering.map((n) => (
                  <tr key={n.record}>
                    <Td className="font-medium text-slate-900">{n.record}</Td>
                    <Td className="font-mono text-xs">{n.pattern}</Td>
                    <Td className="font-mono text-xs">{n.example}</Td>
                    <Td>{n.note}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>

        <div id="configuration">
          <Card>
            <CardHeader title="Other configuration" />
            <CardBody>
              <DetailList
                columns={2}
                items={[
                  { label: 'Time zone', value: 'Africa/Nairobi (UTC+03:00); all dates are entered and shown in this zone' },
                  { label: 'Default customer payment terms', value: '14 days (as on the demo billing profiles)' },
                  { label: 'Document uploads', value: `${allowedSummary}; up to ${MAX_FILES_PER_UPLOAD} files at a time and ${formatBytes(MAX_SESSION_BYTES)} per browser session` },
                  { label: 'Demo reference date', value: `${formatDate(DEMO_REFERENCE_DATE)}: “today” for overdue, expiry and ageing figures` },
                ]}
              />
            </CardBody>
          </Card>
        </div>

        <section id="status" aria-labelledby="status-heading" className="flex flex-col gap-4">
          <h2 id="status-heading" className="text-base font-semibold text-slate-900">
            System status
          </h2>
          <p className="-mt-2 text-sm text-slate-600">What is connected, what is demonstration only, and what is still planned.</p>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="flex flex-col gap-6 xl:col-span-2">
              <BackendHealthCard />
              <Card>
                <CardHeader title="Capabilities and integrations" />
                <ul className="divide-y divide-slate-100">
                  {integrations.map((item) => (
                    <li key={item.name} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{item.name}</p>
                        <p className="text-xs text-slate-600">{item.note}</p>
                      </div>
                      <Badge tone={item.tone}>{item.status}</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
            <Card>
              <CardHeader title="Planned modules" description="Not yet available in this interface" />
              <ul className="flex flex-col gap-2 px-4 py-4 text-sm text-slate-700 sm:px-5">
                {plannedModules.map((m) => (
                  <li key={m} className="flex items-start gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden="true" />
                    {m}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </section>

        <div id="audit">
          <AuditLog />
        </div>
      </div>
    </>
  );
}
