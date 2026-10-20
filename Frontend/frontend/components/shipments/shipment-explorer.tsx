'use client';

// Searchable, filterable shipment list over the session's shipment records
// (lib/data/session-store.tsx). Filtering happens in the browser; with a real
// API it would move to query parameters.

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { inputClass } from '@/components/ui/form';
import { EmptyState } from '@/components/ui/states';
import { CloseIcon, SearchIcon } from '@/components/ui/icons';
import { useSessionStore } from '@/lib/data/session-store';
import { modeLabel } from '@/lib/labels';
import { matchesView, shipmentViewLabel, type ShipmentView } from '@/lib/metrics';
import type { TransportMode } from '@/lib/types';
import { ShipmentTable } from './shipment-table';

export interface ShipmentFilters {
  view: ShipmentView;
  mode: TransportMode | 'all';
  query: string;
  /** Only this customer's shipments (`?customer=`). */
  customerId?: string;
  /** Only shipments handled by this agent (`?agent=`). */
  agentName?: string;
}

interface ShipmentExplorerProps {
  referenceDate: string;
  initialFilters?: Partial<ShipmentFilters>;
  /** Keep filters in the URL so filtered views can be shared and bookmarked. */
  syncUrl?: boolean;
  /** Limit visible rows (dashboard preview). */
  limit?: number;
}

const views = Object.keys(shipmentViewLabel) as ShipmentView[];
const modes = Object.keys(modeLabel) as TransportMode[];

export function ShipmentExplorer({
  referenceDate,
  initialFilters,
  syncUrl = false,
  limit,
}: ShipmentExplorerProps) {
  const { shipments } = useSessionStore();
  const router = useRouter();
  const pathname = usePathname();
  const initialView = initialFilters?.view ?? 'active';
  const initialMode = initialFilters?.mode ?? 'all';
  const [filters, setFilters] = useState<ShipmentFilters>({
    view: initialView,
    mode: initialMode,
    query: initialFilters?.query ?? '',
    customerId: initialFilters?.customerId,
    agentName: initialFilters?.agentName,
  });

  // If the URL's filters change from outside (e.g. the sidebar link while
  // filtered), adopt them. Our own router.replace produces matching values, so
  // this is a no-op for changes made here.
  const urlKey = [initialView, initialMode, initialFilters?.customerId, initialFilters?.agentName].join('|');
  const [seenUrlKey, setSeenUrlKey] = useState(urlKey);
  if (seenUrlKey !== urlKey) {
    setSeenUrlKey(urlKey);
    setFilters((f) => ({
      ...f,
      view: initialView,
      mode: initialMode,
      customerId: initialFilters?.customerId,
      agentName: initialFilters?.agentName,
    }));
  }

  function update(patch: Partial<ShipmentFilters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    // The free-text search stays local so typing does not trigger navigation.
    if (syncUrl && ('view' in patch || 'mode' in patch || 'customerId' in patch || 'agentName' in patch)) {
      const params = new URLSearchParams();
      if (next.view !== 'active') params.set('view', next.view);
      if (next.mode !== 'all') params.set('mode', next.mode);
      if (next.customerId) params.set('customer', next.customerId);
      if (next.agentName) params.set('agent', next.agentName);
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
        (!filters.customerId || s.customerId === filters.customerId) &&
        (!filters.agentName || s.agentName === filters.agentName) &&
        (!q ||
          [s.reference, s.customerName, s.origin, s.destination, s.transportDocRef, s.cargoDescription, s.carrier, s.agentName ?? '']
            .join(' ')
            .toLowerCase()
            .includes(q)),
    );
  }, [shipments, filters, referenceDate]);

  const visible = limit ? filtered.slice(0, limit) : filtered;
  const customerName = filters.customerId
    ? (shipments.find((s) => s.customerId === filters.customerId)?.customerName ?? filters.customerId)
    : undefined;
  const chips = [
    ...(customerName ? [{ key: 'customerId' as const, label: `Customer: ${customerName}` }] : []),
    ...(filters.agentName ? [{ key: 'agentName' as const, label: `Agent: ${filters.agentName}` }] : []),
  ];

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

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-slate-200 px-4 py-2 sm:px-5">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => update({ [chip.key]: undefined })}
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 ring-1 ring-blue-200 ring-inset hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              {chip.label}
              <CloseIcon className="size-3.5" />
              <span className="sr-only">Remove filter</span>
            </button>
          ))}
        </div>
      )}

      {visible.length > 0 ? (
        <ShipmentTable shipments={visible} caption={`Shipments: ${shipmentViewLabel[filters.view]}`} />
      ) : (
        <EmptyState
          title="No shipments match these filters"
          description="Try a different view, transport mode or search term."
        >
          <button
            type="button"
            onClick={() => update({ view: 'all', mode: 'all', query: '', customerId: undefined, agentName: undefined })}
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
