import type { Metadata } from 'next';
import Form from 'next/form';
import Link from 'next/link';
import { ShipmentTable } from '@/components/shipments/shipment-table';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inputClass } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { getCurrentUser, serverGet } from '@/lib/api/server';
import { modeLabel } from '@/lib/labels';
import {
  parseShipmentFilters,
  shipmentApiQuery,
  shipmentPageQuery,
  SHIPMENT_PAGE_SIZE,
  SHIPMENTS_MANAGE,
  toDisplayShipment,
  type ShipmentListFilters,
  type ShipmentListPage,
} from '@/lib/live-shipments';
import { shipmentViewLabel, type ShipmentView } from '@/lib/metrics';

export const metadata: Metadata = { title: 'Shipments' };

const VIEWS: ShipmentView[] = ['active', 'attention', 'delayed', 'arriving', 'customs', 'all'];
const labelClass = 'text-xs font-medium text-slate-600';

function ViewTabs({ filters, counts }: { filters: ShipmentListFilters; counts: ShipmentListPage['counts'] }) {
  return (
    <nav aria-label="Shipment views" className="flex flex-wrap gap-2 border-b border-slate-200 px-4 py-3 sm:px-5">
      {VIEWS.map((view) => {
        const current = view === filters.view;
        return (
          <Link
            key={view}
            href={`/shipments${shipmentPageQuery({ ...filters, view, page: 1 })}`}
            aria-current={current ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-blue-600 ${
              current ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {shipmentViewLabel[view]}
            <span className={`tabular-nums ${current ? 'text-blue-100' : 'text-slate-500'}`}>{counts[view]}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Filters({ filters }: { filters: ShipmentListFilters }) {
  return (
    <Form action="/shipments" className="flex flex-wrap items-end gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
      <input type="hidden" name="view" value={filters.view} />
      {filters.customerId && <input type="hidden" name="customer" value={filters.customerId} />}
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <label htmlFor="shipments-q" className={labelClass}>
          Search
        </label>
        <input
          id="shipments-q"
          name="q"
          type="search"
          defaultValue={filters.q}
          maxLength={100}
          placeholder="Reference, customer, route, cargo or B/L number"
          className={`${inputClass} w-full`}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="shipments-mode" className={labelClass}>
          Mode
        </label>
        <select id="shipments-mode" name="mode" defaultValue={filters.mode ?? ''} className={inputClass}>
          <option value="">All modes</option>
          {Object.entries(modeLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="secondary">
        Apply
      </Button>
    </Form>
  );
}

function Pagination({ filters, total }: { filters: ShipmentListFilters; total: number }) {
  const first = (filters.page - 1) * SHIPMENT_PAGE_SIZE + 1;
  const last = Math.min(filters.page * SHIPMENT_PAGE_SIZE, total);
  const hrefFor = (page: number) => `/shipments${shipmentPageQuery({ ...filters, page })}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:px-5">
      <p className="tabular-nums">
        Showing {first}–{last} of {total}
      </p>
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

export default async function ShipmentsPage({ searchParams }: PageProps<'/shipments'>) {
  const filters = parseShipmentFilters(await searchParams);
  const returnTo = `/shipments${shipmentPageQuery(filters)}`;
  const [page, user] = await Promise.all([
    serverGet<ShipmentListPage>(`shipments?${shipmentApiQuery(filters)}`, returnTo),
    getCurrentUser(returnTo),
  ]);
  const canManage = user.ok && user.data.permissions.includes(SHIPMENTS_MANAGE);
  return (
    <>
      <PageHeader
        title="Shipments"
        description="Sea, air, road and rail jobs with their current stage, customs status, issues and delays."
      >
        <ButtonLink href="/bookings" variant="secondary">
          Bookings
        </ButtonLink>
        {canManage && <ButtonLink href="/shipments/new">New shipment</ButtonLink>}
      </PageHeader>
      {page.ok ? (
        <Card>
          {filters.customerId && (
            <p className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 sm:px-5">
              Showing one customer&apos;s shipments
              {page.data.items[0] ? `: ${page.data.items[0].customer.name}` : ''}.
              <Link href={`/shipments${shipmentPageQuery({ ...filters, customerId: undefined, page: 1 })}`} className="rounded font-medium text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">
                Show all customers
              </Link>
            </p>
          )}
          <ViewTabs filters={filters} counts={page.data.counts} />
          <Filters filters={filters} />
          {page.data.items.length === 0 ? (
            <EmptyState
              title="No shipments match"
              description={
                filters.q || filters.mode
                  ? 'Try another search or mode, or another view.'
                  : `There are no shipments in "${shipmentViewLabel[filters.view]}".`
              }
            />
          ) : (
            <>
              <ShipmentTable shipments={page.data.items.map(toDisplayShipment)} caption={shipmentViewLabel[filters.view]} />
              <Pagination filters={filters} total={page.data.total} />
            </>
          )}
        </Card>
      ) : (
        <Card>
          <ErrorState
            title={page.status === 403 ? 'You do not have access to shipments' : 'Shipments could not be loaded'}
            description={page.status === 403 ? 'Ask an administrator if you need access.' : page.message}
          />
        </Card>
      )}
    </>
  );
}
