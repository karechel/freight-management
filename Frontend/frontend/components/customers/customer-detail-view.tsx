import { Badge, StatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { DetailList } from '@/components/ui/detail-list';
import { PageHeader } from '@/components/ui/page-header';
import { PendingNotice } from '@/components/ui/states';
import { customerLocation, type CustomerDetail } from '@/lib/customers';
import { formatDate, formatKesExact } from '@/lib/format';
import { accountStatusMeta } from '@/lib/labels';
import { CustomerArchiveAction } from './customer-archive-action';
import { CustomerContacts } from './customer-contacts';

const notRecorded = <span className="text-slate-500">Not recorded</span>;

function BillingCards({ billing }: { billing: NonNullable<CustomerDetail['billing']> }) {
  const { account } = billing;
  const overLimit = account.availableCredit?.startsWith('-');
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Billing" description="Credit terms agreed with this customer" />
        <CardBody>
          <DetailList
            columns={2}
            items={[
              {
                label: 'Payment terms',
                value: billing.paymentTermsDays === null ? notRecorded : `${billing.paymentTermsDays} days from invoice`,
              },
              {
                label: 'Credit limit',
                value: billing.creditLimit === null ? notRecorded : formatKesExact(billing.creditLimit),
              },
              {
                label: 'Available credit',
                value:
                  account.availableCredit === null ? (
                    'No credit limit recorded'
                  ) : (
                    <span className={overLimit ? 'font-medium text-red-700' : undefined}>
                      {formatKesExact(account.availableCredit)}
                      {overLimit ? ' (over the limit)' : ''}
                    </span>
                  ),
              },
            ]}
          />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Account balance" description="From issued invoices, credit notes and allocated payments" />
        <CardBody>
          <DetailList
            columns={2}
            items={[
              { label: 'Invoiced', value: formatKesExact(account.invoiced) },
              { label: 'Credited', value: formatKesExact(account.credited) },
              { label: 'Paid', value: formatKesExact(account.paid) },
              {
                label: 'Outstanding',
                value: <span className="font-semibold">{formatKesExact(account.outstanding)}</span>,
              },
              {
                label: 'Overdue',
                value: account.overdueInvoices ? (
                  <span className="font-medium text-red-700">
                    {formatKesExact(account.overdue)} ({account.overdueInvoices} invoice
                    {account.overdueInvoices === 1 ? '' : 's'})
                  </span>
                ) : (
                  'None'
                ),
              },
            ]}
          />
        </CardBody>
      </Card>
    </div>
  );
}

export function CustomerDetailView({
  customer,
  canManage,
  canEdit,
}: {
  customer: CustomerDetail;
  canManage: boolean;
  canEdit: boolean;
}) {
  const archived = customer.archivedAt !== null;
  return (
    <>
      <PageHeader
        title={customer.name}
        description={customerLocation(customer) || undefined}
        back={{ href: '/parties', label: 'Customers' }}
      >
        {archived ? <Badge tone="neutral">Archived</Badge> : <StatusBadge meta={accountStatusMeta[customer.accountStatus]} />}
        {!archived && canEdit && (
          <ButtonLink href={`/parties/${customer.id}/edit`} variant="secondary" size="sm">
            Edit
          </ButtonLink>
        )}
        {canManage && <CustomerArchiveAction id={customer.id} name={customer.name} archived={archived} />}
      </PageHeader>

      <div className="flex flex-col gap-6">
        {archived && (
          <PendingNotice title={`Archived on ${formatDate(customer.archivedAt!)}`}>
            This customer is hidden from everyday lists and cannot be changed. Restore them to make changes.
          </PendingNotice>
        )}

        <Card>
          <CardHeader title="Company" />
          <CardBody>
            <DetailList
              columns={3}
              items={[
                { label: 'Registered legal name', value: customer.legalName ?? notRecorded },
                { label: 'KRA PIN', value: customer.kraPin ?? notRecorded },
                { label: 'Email', value: customer.email ?? notRecorded },
                { label: 'Phone', value: customer.phone ?? notRecorded },
                { label: 'Address', value: customer.address ?? notRecorded },
                { label: 'Location', value: customerLocation(customer) || notRecorded },
                {
                  label: 'Notes',
                  value: customer.notes ? <span className="whitespace-pre-line">{customer.notes}</span> : notRecorded,
                },
              ]}
            />
          </CardBody>
        </Card>

        {customer.billing && <BillingCards billing={customer.billing} />}

        <CustomerContacts partyId={customer.id} contacts={customer.contacts} canManage={canManage && !archived} />

        <Card>
          <CardHeader
            title="Activity"
            description="Live records only. Shipments and quotations move to the live system in later phases."
          />
          <CardBody>
            <DetailList
              columns={2}
              items={[
                { label: 'Shipments', value: `${customer.shipments.active} active · ${customer.shipments.total} total` },
                { label: 'Quotations', value: `${customer.quotations.open} open · ${customer.quotations.total} total` },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
