import Form from 'next/form';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inputClass } from '@/components/ui/form';
import { EmptyState } from '@/components/ui/states';
import { Table, Td, Th } from '@/components/ui/table';
import { formatDate, formatKesExact } from '@/lib/format';
import { modeLabel, quotationStatusMeta } from '@/lib/labels';
import {
  bookingHref,
  bookingStatusMeta,
  creditApprovalMeta,
  listPageQuery,
  liveQuotationHref,
  PAGE_SIZE,
  quotationDisplayStatus,
  type ListFilters,
  type ListPage,
  type LiveBooking,
  type LiveQuotation,
} from '@/lib/live-quotations';

const labelClass = 'text-xs font-medium text-slate-600';
const linkClass = 'rounded font-mono font-medium whitespace-nowrap text-blue-700 hover:text-blue-900 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600';

function Filters({
  action,
  filters,
  placeholder,
  statuses,
}: {
  action: string;
  filters: ListFilters;
  placeholder: string;
  statuses: { value: string; label: string }[];
}) {
  return (
    <Form action={action} className="flex flex-wrap items-end gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <label htmlFor={`${action.slice(1)}-q`} className={labelClass}>
          Search
        </label>
        <input
          id={`${action.slice(1)}-q`}
          name="q"
          type="search"
          defaultValue={filters.q}
          maxLength={100}
          placeholder={placeholder}
          className={`${inputClass} w-full`}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${action.slice(1)}-status`} className={labelClass}>
          Status
        </label>
        <select id={`${action.slice(1)}-status`} name="status" defaultValue={filters.status} className={inputClass}>
          <option value="">Any status</option>
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {filters.customerId && <input type="hidden" name="customerId" value={filters.customerId} />}
      {filters.awaitingApproval && <input type="hidden" name="creditApproval" value="awaiting" />}
      <Button type="submit" variant="secondary">
        Apply
      </Button>
    </Form>
  );
}

function Pagination({ action, filters, total }: { action: string; filters: ListFilters; total: number }) {
  const first = (filters.page - 1) * PAGE_SIZE + 1;
  const last = Math.min(filters.page * PAGE_SIZE, total);
  const hrefFor = (page: number) => `${action}${listPageQuery({ ...filters, page })}`;
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

function NoRows({ action, filters, noun }: { action: string; filters: ListFilters; noun: string }) {
  const filtered = Boolean(filters.q || filters.status || filters.customerId || filters.awaitingApproval);
  return (
    <EmptyState
      title={filtered ? `No ${noun} match these filters` : `No ${noun} yet`}
      description={filtered ? 'Try a different search or filter.' : undefined}
    >
      {filters.page > 1 && (
        <ButtonLink href={`${action}${listPageQuery({ ...filters, page: 1 })}`} variant="secondary" size="sm">
          Back to the first page
        </ButtonLink>
      )}
    </EmptyState>
  );
}

const quotationStatuses = (['draft', 'sent', 'accepted', 'declined', 'expired'] as const).map((value) => ({
  value,
  label: quotationStatusMeta[value].label,
}));

export function LiveQuotationList({ page, filters }: { page: ListPage<LiveQuotation>; filters: ListFilters }) {
  const customerName = filters.customerId ? page.items.find((q) => q.customer.id === filters.customerId)?.customer.name : undefined;
  return (
    <Card>
      {filters.customerId && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-200 px-4 py-3 text-sm text-slate-700 sm:px-5">
          <span>
            Showing quotations for{' '}
            <Link href={`/parties/${filters.customerId}`} className="rounded font-medium text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">
              {customerName ?? 'this customer'}
            </Link>
          </span>
          <Link href={`/quotations${listPageQuery({ ...filters, customerId: undefined, page: 1 })}`} className="rounded text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">
            Show all customers
          </Link>
        </p>
      )}
      <Filters action="/quotations" filters={filters} placeholder="Reference, customer, origin, destination or cargo" statuses={quotationStatuses} />
      {page.items.length === 0 ? (
        <NoRows action="/quotations" filters={filters} noun="quotations" />
      ) : (
        <>
          <Table caption="Quotations">
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Customer</Th>
                <Th>Route</Th>
                <Th>Valid until</Th>
                <Th>Status</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((q) => (
                <tr key={q.id} className="hover:bg-slate-50">
                  <Td>
                    <Link href={liveQuotationHref(q.reference)} className={linkClass}>
                      {q.reference}
                    </Link>
                    <p className="text-xs text-slate-500">{modeLabel[q.mode]}</p>
                  </Td>
                  <Td>{q.customer.name}</Td>
                  <Td>
                    {q.origin} → {q.destination}
                  </Td>
                  <Td className="whitespace-nowrap">{formatDate(q.validUntil)}</Td>
                  <Td>
                    <StatusBadge meta={quotationDisplayStatus(q)} />
                  </Td>
                  <Td className="text-right whitespace-nowrap tabular-nums">{formatKesExact(q.totals.total)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination action="/quotations" filters={filters} total={page.total} />
        </>
      )}
    </Card>
  );
}

const bookingStatuses = (Object.keys(bookingStatusMeta) as (keyof typeof bookingStatusMeta)[]).map((value) => ({
  value,
  label: bookingStatusMeta[value].label,
}));

export function BookingList({ page, filters }: { page: ListPage<LiveBooking>; filters: ListFilters }) {
  return (
    <Card>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-200 px-4 py-3 text-sm text-slate-700 sm:px-5">
        {filters.awaitingApproval ? (
          <>
            <span>Showing bookings awaiting credit approval</span>
            <Link href={`/bookings${listPageQuery({ ...filters, awaitingApproval: false, page: 1 })}`} className="rounded text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">
              Show all bookings
            </Link>
          </>
        ) : (
          <Link href={`/bookings${listPageQuery({ ...filters, awaitingApproval: true, page: 1 })}`} className="rounded text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">
            Show only bookings awaiting credit approval
          </Link>
        )}
      </p>
      <Filters action="/bookings" filters={filters} placeholder="Booking or quotation reference, customer, route or cargo" statuses={bookingStatuses} />
      {page.items.length === 0 ? (
        <NoRows action="/bookings" filters={filters} noun="bookings" />
      ) : (
        <>
          <Table caption="Bookings">
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Customer</Th>
                <Th>Route</Th>
                <Th>Quotation</Th>
                <Th>Status</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <Td>
                    <Link href={bookingHref(b.reference)} className={linkClass}>
                      {b.reference}
                    </Link>
                    <p className="text-xs text-slate-500">{modeLabel[b.mode]}</p>
                  </Td>
                  <Td>{b.customer.name}</Td>
                  <Td>
                    {b.origin} → {b.destination}
                  </Td>
                  <Td>
                    {b.quotation ? (
                      <Link href={liveQuotationHref(b.quotation.reference)} className={linkClass}>
                        {b.quotation.reference}
                      </Link>
                    ) : (
                      <span className="text-slate-500">Without quotation</span>
                    )}
                  </Td>
                  <Td>
                    <StatusBadge meta={bookingStatusMeta[b.status]} />
                    {b.creditApproval?.state === 'awaiting' && (
                      <span className="mt-1 block">
                        <StatusBadge meta={creditApprovalMeta.awaiting} />
                      </span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">{formatDate(b.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination action="/bookings" filters={filters} total={page.total} />
        </>
      )}
    </Card>
  );
}
