'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/states';
import { Table, Td, Th } from '@/components/ui/table';
import { formatDate } from '@/lib/format';
import { documentStatusMeta, documentTypeLabel } from '@/lib/labels';
import type { DocumentStatus, DocumentType, ShipmentDocument } from '@/lib/types';

export type DocumentFilter = 'all' | 'outstanding' | DocumentStatus;

const filterLabels: Record<DocumentFilter, string> = {
  all: 'All',
  outstanding: 'Outstanding',
  missing: 'Missing',
  rejected: 'Rejected',
  received: 'Received',
  verified: 'Verified',
};

function matches(doc: ShipmentDocument, filter: DocumentFilter) {
  if (filter === 'all') return true;
  if (filter === 'outstanding') return doc.status === 'missing' || doc.status === 'rejected';
  return doc.status === filter;
}

export function DocumentList({
  documents,
  initialFilter = 'all',
}: {
  documents: ShipmentDocument[];
  initialFilter?: DocumentFilter;
}) {
  const [filter, setFilter] = useState<DocumentFilter>(initialFilter);
  const [type, setType] = useState<DocumentType | 'all'>('all');

  const counts = useMemo(() => {
    const result = {} as Record<DocumentFilter, number>;
    for (const key of Object.keys(filterLabels) as DocumentFilter[]) {
      result[key] = documents.filter((d) => matches(d, key)).length;
    }
    return result;
  }, [documents]);

  const visible = documents.filter((d) => matches(d, filter) && (type === 'all' || d.type === type));

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {(Object.keys(filterLabels) as DocumentFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                filter === key
                  ? 'bg-blue-700 text-white ring-blue-700'
                  : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
              }`}
            >
              {filterLabels[key]} <span className="tabular-nums opacity-80">({counts[key]})</span>
            </button>
          ))}
        </div>
        <label>
          <span className="sr-only">Document type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as DocumentType | 'all')}
            className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-2 focus:outline-offset-1 focus:outline-blue-600 sm:w-auto"
          >
            <option value="all">All document types</option>
            {(Object.keys(documentTypeLabel) as DocumentType[]).map((t) => (
              <option key={t} value={t}>
                {documentTypeLabel[t]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="No documents match this filter" />
      ) : (
        <Table caption="Shipment documents">
          <thead>
            <tr>
              <Th>Document</Th>
              <Th>Shipment</Th>
              <Th>Status</Th>
              <Th>Received</Th>
              <Th>Note</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50">
                <Td className="font-medium text-slate-900">{documentTypeLabel[d.type]}</Td>
                <Td>
                  <Link
                    href={`/shipments/${d.shipmentReference}`}
                    className="rounded font-mono text-[13px] text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
                  >
                    {d.shipmentReference}
                  </Link>
                  <p className="text-xs text-slate-500">{d.customerName}</p>
                </Td>
                <Td><StatusBadge meta={documentStatusMeta[d.status]} /></Td>
                <Td className="whitespace-nowrap">{d.receivedAt ? formatDate(d.receivedAt) : '—'}</Td>
                <Td className="text-slate-600">{d.note ?? '—'}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
