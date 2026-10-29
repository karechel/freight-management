import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { DataSourceNotice, PendingNotice } from '@/components/ui/states';
import { Table, Td, Th } from '@/components/ui/table';
import { accessLevelMeta, permissionAreas, staffRoleMeta, staffRoles, type AccessLevel } from '@/lib/access';
import { getStaffAccounts } from '@/lib/data';
import type { Tone } from '@/lib/labels';

export const metadata: Metadata = { title: 'Users & permissions' };

const levelTone: Record<AccessLevel, Tone> = { none: 'neutral', view: 'info', edit: 'progress', manage: 'success' };

const accountStatus = {
  active: { label: 'Active (demo)', tone: 'success' },
  invited: { label: 'Invited', tone: 'info' },
  disabled: { label: 'Disabled', tone: 'neutral' },
} as const;

const principles = [
  'Every request is checked on the backend against the signed-in user’s role. Hiding a button in this interface protects nothing.',
  'Customer billing details, balances, invoices, payments and margins are limited to finance and management.',
  'Each person has their own account; shared logins are not allowed, so the audit log shows who did what.',
  'Staff get the least access their job needs. Role and permission changes are themselves recorded in the audit log.',
  'Accounts of people who leave are disabled, not deleted, so their past actions stay attributable.',
  'Stronger sign-in (for example a second factor) is recommended for administrators and finance staff.',
];

export default async function UsersPage() {
  const accounts = await getStaffAccounts();
  return (
    <>
      <PageHeader
        title="Users & permissions"
        description="Staff accounts, roles and the access each role is intended to have."
      >
        <button
          type="button"
          disabled
          className="inline-flex h-9 cursor-not-allowed items-center rounded-lg bg-slate-300 px-4 text-sm font-medium text-slate-600"
        >
          Invite user (planned)
        </button>
      </PageHeader>
      <DataSourceNotice source={accounts.source}>
        Account emails use the reserved .example domain. Roles are illustrative.
      </DataSourceNotice>
      <div className="mb-6">
        <PendingNotice title="Prototype: permissions are not enforced">
          There is no sign-in and no backend authorization yet, so anyone who can open this app can see and change everything
          in it. This page shows the intended structure only. Access control must be enforced by the backend before any real
          customer or financial data is stored.
        </PendingNotice>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader title="Staff accounts" description={`${accounts.data.length} demo accounts; none can sign in`} />
          <Table caption="Staff accounts">
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Last sign-in</Th>
              </tr>
            </thead>
            <tbody>
              {accounts.data.map((a) => (
                <tr key={a.id}>
                  <Td>
                    <p className="font-medium text-slate-900">{a.name}</p>
                    <p className="text-xs text-slate-500">{a.email}</p>
                  </Td>
                  <Td>{staffRoleMeta[a.role].label}</Td>
                  <Td>
                    <Badge tone={accountStatus[a.status].tone} dot>
                      {accountStatus[a.status].label}
                    </Badge>
                  </Td>
                  <Td className="text-slate-500">Never (no sign-in exists)</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader title="Roles" description="What each role is responsible for" />
          <ul className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-3">
            {staffRoles.map((role) => {
              const members = accounts.data.filter((a) => a.role === role);
              return (
                <li key={role} className="bg-white px-4 py-4 sm:px-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{staffRoleMeta[role].label}</p>
                    <Badge tone="neutral">{members.length === 1 ? '1 account' : `${members.length} accounts`}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{staffRoleMeta[role].summary}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {members.length ? members.map((m) => m.name).join(', ') : 'No demo account has this role.'}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Permission matrix"
            description="Intended access per area. Areas marked sensitive hold customer financial information."
          />
          <Table caption="Permission matrix">
            <thead>
              <tr>
                <Th>Area</Th>
                {staffRoles.map((role) => (
                  <Th key={role}>{staffRoleMeta[role].label}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissionAreas.map((area) => (
                <tr key={area.id}>
                  <Td>
                    <p className="font-medium text-slate-900">{area.label}</p>
                    {area.sensitive && (
                      <Badge tone="warning" className="mt-1">
                        Sensitive
                      </Badge>
                    )}
                  </Td>
                  {staffRoles.map((role) => (
                    <Td key={role}>
                      <Badge tone={levelTone[area.access[role]]}>{accessLevelMeta[area.access[role]].label}</Badge>
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
          <CardBody className="border-t border-slate-200">
            <dl className="grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
              {(Object.keys(accessLevelMeta) as AccessLevel[]).map((level) => (
                <div key={level} className="flex items-center gap-2">
                  <dt>
                    <Badge tone={levelTone[level]}>{accessLevelMeta[level].label}</Badge>
                  </dt>
                  <dd>{accessLevelMeta[level].description}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="How access control should work" description="Requirements for the backend implementation" />
          <CardBody>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
              {principles.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
