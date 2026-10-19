import type { Metadata } from 'next';
import { BackendHealthCard } from '@/components/settings/backend-health-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';

export const metadata: Metadata = { title: 'System status' };

const integrations = [
  { name: 'Authentication & roles', status: 'Not built', tone: 'warning', note: 'No sign-in, sessions or role-based access control. Anyone who can reach the app sees everything.' },
  { name: 'Freight data API', status: 'Not built', tone: 'warning', note: 'No backend endpoints for shipments, documents, quotations, parties or finance. All pages use demo data.' },
  { name: 'Document storage', status: 'Not built', tone: 'warning', note: 'Requires private, access-controlled storage. No files are uploaded or stored.' },
  { name: 'KRA iCMS', status: 'Pending', tone: 'neutral', note: 'Not integrated. Access and onboarding status unknown.' },
  { name: 'M-Pesa (Daraja)', status: 'Pending', tone: 'neutral', note: 'Not integrated. Sandbox access status unknown.' },
] as const;

const plannedModules = [
  'Customer portal',
  'Agent portal',
  'Notifications and reminders',
  'Transport, warehouse and delivery management',
  'Reports and management dashboards',
  'User and staff administration',
  'Audit logs',
];

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="System status"
        description="What is connected, what is demonstration only, and what is still planned."
      />
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
              <li key={m} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-slate-400" aria-hidden="true" />
                {m}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
