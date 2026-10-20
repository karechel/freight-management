'use client';

// Document records from the session store, with status filters, open/download
// for files selected in this tab, and verify/reject review.

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/form';
import { EmptyState } from '@/components/ui/states';
import { Table, Td, Th } from '@/components/ui/table';
import { useSessionStore } from '@/lib/data/session-store';
import { validateReview, type ReviewDecision } from '@/lib/document-changes';
import { formatBytes } from '@/lib/document-upload';
import { formatDate, formatDateTime } from '@/lib/format';
import { documentStatusMeta, documentTypeLabel } from '@/lib/labels';
import { documentFilterLabel as filterLabels, documentFilters, matchesDocumentFilter as matches, type DocumentFilter } from '@/lib/metrics';
import type { DocumentType, ShipmentDocument } from '@/lib/types';

const smallAction =
  'rounded px-1.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-50 hover:text-blue-900 focus-visible:outline-2 focus-visible:outline-blue-600';

function ReviewForm({ doc, onDone }: { doc: ShipmentDocument; onDone: () => void }) {
  const { reviewDocument } = useSessionStore();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | undefined>();

  function decide(decision: ReviewDecision) {
    const problem = validateReview(doc, decision, reason);
    setError(problem);
    if (problem) return;
    reviewDocument(doc.id, decision, reason);
    onDone();
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 sm:flex-row sm:items-end">
      <TextField
        id={`review-${doc.id}`}
        label="Reason or note"
        value={reason}
        onChange={setReason}
        maxLength={300}
        error={error}
        hint="Required when rejecting."
        className="flex-1"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => decide('verified')}>
          Verify
        </Button>
        <Button size="sm" variant="secondary" onClick={() => decide('rejected')}>
          Reject
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

interface DocumentListProps {
  initialFilter?: DocumentFilter;
  /** Only this shipment's documents; hides the shipment column. */
  shipmentReference?: string;
}

export function DocumentList({ initialFilter = 'all', shipmentReference }: DocumentListProps) {
  const store = useSessionStore();
  const [filter, setFilter] = useState<DocumentFilter>(initialFilter);
  const [type, setType] = useState<DocumentType | 'all'>('all');
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const documents = useMemo(
    () => (shipmentReference ? store.documents.filter((d) => d.shipmentReference === shipmentReference) : store.documents),
    [store.documents, shipmentReference],
  );
  const counts = useMemo(() => {
    const result = {} as Record<DocumentFilter, number>;
    for (const key of documentFilters) result[key] = documents.filter((d) => matches(d, key)).length;
    return result;
  }, [documents]);
  const visible = documents.filter((d) => matches(d, filter) && (type === 'all' || d.type === type));

  function open(doc: ShipmentDocument, download: boolean) {
    const ok = download ? store.downloadDocumentFile(doc.id) : store.openDocumentFile(doc.id);
    setMessage(ok ? null : `The file for ${documentTypeLabel[doc.type]} is no longer available in this tab.`);
  }

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {documentFilters.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                filter === key ? 'bg-blue-700 text-white ring-blue-700' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
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
            className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-2 focus:outline-offset-1 focus:outline-blue-600 sm:w-auto"
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

      {message && (
        <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900 sm:px-5">
          {message}
        </p>
      )}

      {visible.length === 0 ? (
        <EmptyState
          title={documents.length === 0 ? 'No documents recorded' : 'No documents match this filter'}
          description={documents.length === 0 ? 'Upload documents to record them against this shipment.' : undefined}
        />
      ) : (
        <Table caption={shipmentReference ? `Documents for ${shipmentReference}` : 'Shipment documents'}>
          <thead>
            <tr>
              <Th>Document</Th>
              {!shipmentReference && <Th>Shipment</Th>}
              <Th>Status</Th>
              <Th>Received / uploaded</Th>
              <Th>Note</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50">
                <Td>
                  <p className="font-medium text-slate-900">{documentTypeLabel[d.type]}</p>
                  {d.file ? (
                    <p className="text-xs break-all text-slate-600">
                      {d.file.name} · {formatBytes(d.file.sizeBytes)}
                      <span className="ml-1 font-medium text-amber-800">(this tab only)</span>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">{d.status === 'missing' ? 'Not received' : 'No file in demo data'}</p>
                  )}
                </Td>
                {!shipmentReference && (
                  <Td>
                    <Link
                      href={`/shipments/${encodeURIComponent(d.shipmentReference)}`}
                      className="rounded font-mono text-[13px] text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
                    >
                      {d.shipmentReference}
                    </Link>
                    <p className="text-xs text-slate-500">{d.customerName}</p>
                  </Td>
                )}
                <Td>
                  <StatusBadge meta={documentStatusMeta[d.status]} />
                  {d.reviewedAt && (
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDateTime(d.reviewedAt)} · {d.reviewedBy}
                    </p>
                  )}
                </Td>
                <Td className="whitespace-nowrap">
                  {d.file ? formatDateTime(d.file.uploadedAt) : d.receivedAt ? formatDate(d.receivedAt) : '—'}
                </Td>
                <Td className="text-slate-600">
                  {d.note ?? '—'}
                  {reviewing === d.id && <ReviewForm doc={d} onDone={() => setReviewing(null)} />}
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <div className="flex flex-wrap justify-end gap-1">
                    {d.file && (
                      <>
                        <button type="button" className={smallAction} onClick={() => open(d, false)}>
                          Open<span className="sr-only"> {d.file.name}</span>
                        </button>
                        <button type="button" className={smallAction} onClick={() => open(d, true)}>
                          Download<span className="sr-only"> {d.file.name}</span>
                        </button>
                      </>
                    )}
                    {d.status === 'received' && reviewing !== d.id && (
                      <button type="button" className={smallAction} onClick={() => setReviewing(d.id)}>
                        Review<span className="sr-only"> {documentTypeLabel[d.type]}</span>
                      </button>
                    )}
                    {(d.status === 'missing' || d.status === 'rejected') && (
                      <Link
                        href={`/documents/upload?shipment=${encodeURIComponent(d.shipmentReference)}&type=${d.type}`}
                        className={smallAction}
                      >
                        Upload<span className="sr-only"> {documentTypeLabel[d.type]}</span>
                      </Link>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
