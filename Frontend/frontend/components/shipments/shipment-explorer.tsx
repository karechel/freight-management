'use client';

// Searchable, filterable shipment list. Filtering happens in the browser over
// the records passed in; with a real API this would move to query parameters.

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { EmptyState } from '@/components/ui/states';
import { SearchIcon } from '@/components/ui/icons';
import { modeLabel } from '@/lib/labels';
import { matchesView, shipmentViewLabel, type ShipmentView } from '@/lib/metrics';
import type { Shipment, TransportMode } from '@/lib/types';
import { ShipmentTable } from './shipment-table';

export interface ShipmentFilters {
  view: ShipmentView;
  mode: TransportMode | 'all';
  query: string;
}

interface ShipmentExplorerProps {
  shipments: Shipment[];
  referenceDate: string;
  initialFilters?: Partial<ShipmentFilters>;
  /** Keep filters in the URL so filtered views can be shared and bookmarked. */
  syncUrl?: boolean;
  /** Limit visible rows (dashboard preview). */
  limit?: number;
}

const views = Object.keys(shipmentViewLabel) as ShipmentView[];
const modes = Object.keys(modeLabel) as TransportMode[];

const inputClass =
  'h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-2 focus:outline-offset-1 focus:outline-blue-600';

export function ShipmentExplorer({
  shipments,
  referenceDate,
  initialFilters,
  syncUrl = false,
  limit,
}: ShipmentExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const initialView = initialFilters?.view ?? 'active';
  const initialMode = initialFilters?.mode ?? 'all';
  const [filters, setFilters] = useState<ShipmentFilters>({
    view: initialView,
    mode: initialMode,
    query: initialFilters?.query ?? '',
  });

  // If the URL's view/mode changes from outside (e.g. the sidebar link while
  // filtered), adopt it. Our own router.replace produces matching values, so
  // this is a no-op for changes made here.
  const urlKey = `${initialView}|${initialMode}`;
  const [seenUrlKey, setSeenUrlKey] = useState(urlKey);
  if (seenUrlKey !== urlKey) {
    setSeenUrlKey(urlKey);
    setFilters((f) => ({ ...f, view: initialView, mode: initialMode }));
  }

  function update(patch: Partial<ShipmentFilters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    // The free-text search stays local so typing does not trigger navigation.
    if (syncUrl && ('view' in patch || 'mode' in patch)) {
      const params = new URLSearchParams();
      if (next.view !== 'active') params.set('view', next.view);
      if (next.mode !== 'all') params.set('mode', next.mode);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return shipments.filter(
      (s) =>
        matchesView(s, filters.view, referenceDate) &&
        (filters.mode === 'all' || s.mode === filters.mode) &&
        (!q ||
          [s.reference, s.customerName, s.origin, s.destination, s.transportDocRef, s.cargoDescription]
            .join(' ')
            .toLowerCase()
            .includes(q)),
    );
  }, [shipments, filters, referenceDate]);

  const visible = limit ? filtered.slice(0, limit) : filtered;

  return (
    <div>
      <form
        role="search"
        className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:px-5"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="relative flex-1">
          <span className="sr-only">Search shipments</span>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={filters.query}
            onChange={(e) => update({ query: e.target.value })}
            placeholder="Search reference, customer, B/L or AWB, route…"
            className={`${inputClass} w-full pl-8`}
          />
        </label>
        <div className="flex gap-2">
          <label className="flex-1 sm:flex-none">
            <span className="sr-only">View</span>
            <select
              value={filters.view}
              onChange={(e) => update({ view: e.target.value as ShipmentView })}
              className={`${inputClass} w-full`}
            >
              {views.map((v) => (
                <option key={v} value={v}>
                  {shipmentViewLabel[v]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1 sm:flex-none">
            <span className="sr-only">Transport mode</span>
            <select
              value={filters.mode}
              onChange={(e) => update({ mode: e.target.value as ShipmentFilters['mode'] })}
              className={`${inputClass} w-full`}
            >
              <option value="all">All modes</option>
              {modes.map((m) => (
                <option key={m} value={m}>
                  {modeLabel[m]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </form>

      {visible.length > 0 ? (
        <ShipmentTable shipments={visible} caption={`Shipments: ${shipmentViewLabel[filters.view]}`} />
      ) : (
        <EmptyState
          title="No shipments match these filters"
          description="Try a different view, transport mode or search term."
        >
          <button
            type="button"
            onClick={() => update({ view: 'all', mode: 'all', query: '' })}
            className="mt-1 rounded text-sm font-medium text-blue-700 hover:text-blue-900 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            Clear filters
          </button>
        </EmptyState>
      )}

      <p className="px-4 py-2.5 text-xs text-slate-500 sm:px-5" aria-live="polite">
        Showing {visible.length} of {filtered.length} matching · {shipments.length} total
      </p>
    </div>
  );
}
