import Form from 'next/form';
import Link from 'next/link';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inputClass } from '@/components/ui/form';
import { EmptyState } from '@/components/ui/states';
import { Table, Td, Th } from '@/components/ui/table';
import {
  customerLocation,
  customerPageQuery,
  PAGE_SIZE,
  type CustomerFilters,
  type CustomerPage,
} from '@/lib/customers';
import { formatKesExact } from '@/lib/format';
import { accountStatusMeta } from '@/lib/labels';
import type { AccountStatus } from '@/lib/types';

const labelClass = 'text-xs font-medium text-slate-600';

function Filters({ filters }: { filters: CustomerFilters }) {
  return (
    <Form action="/parties" className="flex flex-wrap items-end gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <label htmlFor="customers-q" className={labelClass}>
          Search
        </label>
        <input
          id="customers-q"
          name="q"
          type="search"
          defaultValue={filters.q}
          maxLength={100}
          placeholder="Name, KRA PIN, email, phone, city or contact"
          className={`${inputClass} w-full`}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="customers-status" className={labelClass}>
          Account status
        </label>
        <select id="customers-status" name="status" defaultValue={filters.status} className={inputClass}>
          <option value="">Any status</option>
          {(Object.keys(accountStatusMeta) as AccountStatus[]).map((status) => (
            <option key={status} value={status}>
              {accountStatusMeta[status].label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="customers-archived" className={labelClass}>
          Show
        </label>
        <select id="customers-archived" name="archived" defaultValue={filters.archived} className={inputClass}>
          <option value="exclude">Current customers</option>
          <option value="only">Archived customers</option>
          <option value="include">Current and archived</option>
        </select>
      </div>
      <Button type="submit" variant="secondary">
        Apply
      </Button>
    </Form>
  );
}

function Pagination({ filters, total }: { filters: CustomerFilters; total: number }) {
  const first = (filters.page - 1) * PAGE_SIZE + 1;
  const last = Math.min(filters.page * PAGE_SIZE, total);
  const hrefFor = (page: number) => `/parties${customerPageQuery({ ...filters, page })}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-slate-600 sm:px-5">
      <p>{first > total ? `${total} in total` : `Showing ${first}–${last} of ${total}`}</p>
      <div className="flex gap-2">
        {filters.page > 1 && (
          <ButtonLink href={hrefFor(filters.page - 1)} variant="secondary" size="sm">
            Previous
          </ButtonLink>
        )}
        {last < total && (
          <ButtonLink href={hrefFor(filters.page + 1)} variant="secondary" size="sm">
            Next
          </ButtonLink>
        )}
      </div>
    </div>
  );
}

export function CustomerList({ page, filters }: { page: CustomerPage; filters: CustomerFilters }) {
  const showBalance = page.items.some((customer) => customer.billing);
  const filtered = Boolean(filters.q || filters.status || filters.archived !== 'exclude');
  return (
    <Card>
      <Filters filters={filters} />
      {page.items.length === 0 ? (
        <EmptyState
          title={filtered ? 'No customers match these filters' : 'No customers yet'}
          description={filtered ? 'Try a different search or filter.' : undefined}
        >
          {filters.page > 1 && (
            <ButtonLink href={`/parties${customerPageQuery({ ...filters, page: 1 })}`} variant="secondary" size="sm">
              Back to the first page
            </ButtonLink>
          )}
        </EmptyState>
      ) : (
        <>
          <Table caption="Customers">
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Location</Th>
                <Th>Primary contact</Th>
                <Th>Status</Th>
                <Th className="text-right">Active shipments</Th>
                {showBalance && <Th className="text-right">Outstanding</Th>}
              </tr>
            </thead>
            <tbody>
              {page.items.map((customer) => (
                <tr key={customer.id} className="hover:bg-slate-50">
                  <Td>
                    <Link
                      href={`/parties/${customer.id}`}
                      className="rounded font-medium text-blue-700 hover:text-blue-900 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
                    >
                      {customer.name}
                    </Link>
                    {customer.kraPin && <p className="font-mono text-xs text-slate-500">{customer.kraPin}</p>}
                  </Td>
                  <Td>{customerLocation(customer) || <span className="text-slate-500">Not recorded</span>}</Td>
                  <Td>
                    {customer.primaryContact ? (
                      <>
                        <p>{customer.primaryContact.name}</p>
                        {customer.primaryContact.email && (
                          <p className="text-xs break-all text-slate-500">{customer.primaryContact.email}</p>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-500">None</span>
                    )}
                  </Td>
                  <Td>
                    {customer.archivedAt ? (
                      <Badge tone="neutral">Archived</Badge>
                    ) : (
                      <StatusBadge meta={accountStatusMeta[customer.accountStatus]} />
                    )}
                  </Td>
                  <Td className="text-right tabular-nums">{customer.shipments.active}</Td>
                  {showBalance && (
                    <Td className="text-right whitespace-nowrap tabular-nums">
                      {customer.billing ? formatKesExact(customer.billing.account.outstanding) : ''}
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination filters={filters} total={page.total} />
        </>
      )}
    </Card>
  );
}
