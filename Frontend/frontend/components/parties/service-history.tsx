'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { inputClass } from '@/components/ui/form';
import { EmptyState } from '@/components/ui/states';
import { historyKindLabel, type HistoryEntry, type HistoryKind } from '@/lib/customer-history';
import { formatDateTime } from '@/lib/format';
import type { Tone } from '@/lib/labels';

const kindTone: Record<HistoryKind, Tone> = {
  shipment: 'info',
  quotation: 'progress',
  document: 'neutral',
  invoice: 'warning',
  payment: 'success',
};

/** Account-style history: one row per dated event, filterable by type, newest or oldest first. */
export function ServiceHistory({ entries }: { entries: HistoryEntry[] }) {
  const [kind, setKind] = useState<HistoryKind | 'all'>('all');
  const [oldestFirst, setOldestFirst] = useState(false);
  const filtered = entries.filter((e) => kind === 'all' || e.kind === kind);
  const visible = oldestFirst ? [...filtered].reverse() : filtered;
  const counts = Object.fromEntries(
    (Object.keys(historyKindLabel) as HistoryKind[]).map((k) => [k, entries.filter((e) => e.kind === k).length]),
  ) as Record<HistoryKind, number>;

  return (
    <div>
      <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <span>Show</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={inputClass}>
            <option value="all">All activity ({entries.length})</option>
            {(Object.keys(historyKindLabel) as HistoryKind[]).map((k) => (
              <option key={k} value={k}>
                {historyKindLabel[k]}s ({counts[k]})
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setOldestFirst((v) => !v)}
          className="self-start rounded text-sm font-medium text-blue-700 hover:text-blue-900 focus-visible:outline-2 focus-visible:outline-blue-600 sm:self-auto"
          aria-pressed={oldestFirst}
        >
          {oldestFirst ? 'Oldest first' : 'Newest first'} · change order
        </button>
      </div>
      {visible.length === 0 ? (
        <EmptyState title="No activity of this type" description="Only records with a recorded date are listed." />
      ) : (
        <ol className="divide-y divide-slate-100">
          {visible.map((e) => (
            <li key={e.id} className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[9rem_6.5rem_1fr_auto] sm:items-start sm:gap-3 sm:px-5">
              <time dateTime={e.at} className="text-xs text-slate-500 tabular-nums sm:pt-0.5">
                {formatDateTime(e.at)}
              </time>
              <span>
                <Badge tone={kindTone[e.kind]}>{historyKindLabel[e.kind]}</Badge>
              </span>
              <div className="min-w-0">
                <p className="text-sm text-slate-900">{e.title}</p>
                {e.detail && <p className="text-xs text-slate-500">{e.detail}</p>}
                {e.href && e.linkLabel && (
                  <Link href={e.href} className="rounded font-mono text-xs text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">
                    {e.linkLabel}
                  </Link>
                )}
              </div>
              {e.status && <StatusBadge meta={e.status} />}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
