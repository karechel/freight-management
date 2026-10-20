'use client';

// In-memory store for records edited in the browser during this session.
//
// The backend has no write endpoints yet, so creating or editing a shipment,
// delay, quotation or document changes only this React state. Selected files
// are held as Blobs in memory and opened through temporary blob: URLs that
// work only in this tab; they are never uploaded or written to disk.
// It survives client-side navigation (the provider lives in the root layout)
// and is lost on reload or in another tab. Nothing is written to the backend,
// localStorage or any other storage. When the API exists, replace these
// mutations with API calls (see docs/api-contracts.md) and re-read data from
// lib/data.

import { createContext, use, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { nowIso } from '@/lib/dates';
import { applyReview, attachUploads, type ReviewDecision, type UploadRequest } from '@/lib/document-changes';
import { documentStatusMeta, documentTypeLabel } from '@/lib/labels';
import { createQuotation as buildQuotation } from '@/lib/quotation-changes';
import type { QuotationInput } from '@/lib/quotation-form';
import type { ShipmentInput } from '@/lib/shipment-form';
import { addShipmentEvent, createShipment as buildShipment, SESSION_ACTOR, type ChangeContext } from '@/lib/shipment-changes';
import type { ActivityItem, Quotation, QuotationEvent, Shipment, ShipmentDocument, ShipmentEvent } from '@/lib/types';

export interface SessionNotice {
  message: string;
  /** Path the notice belongs to; it is dropped when the user navigates elsewhere. */
  path: string;
}

interface SessionStore {
  /** Newest update first. */
  shipments: Shipment[];
  /** Newest issue date first. */
  quotations: Quotation[];
  /** Newest first. */
  activity: ActivityItem[];
  documents: ShipmentDocument[];
  /** Total size of the files held in memory this session. */
  sessionFileBytes: number;
  createShipment: (input: ShipmentInput) => Shipment;
  /** Applies `change` to the shipment. Returns false when the shipment is unknown or nothing changed. */
  updateShipment: (reference: string, change: (s: Shipment, ctx: ChangeContext) => Shipment) => boolean;
  createQuotation: (input: QuotationInput, duplicatedFrom?: string) => Quotation;
  /** Applies `change` to the quotation. Returns false when the quotation is unknown or nothing changed. */
  updateQuotation: (reference: string, change: (q: Quotation, ctx: ChangeContext) => Quotation) => boolean;
  /** Keeps the files in memory and records them against the shipment. Returns the affected document ids, in file order. */
  uploadDocuments: (request: UploadRequest, blobs: Blob[]) => string[];
  reviewDocument: (id: string, decision: ReviewDecision, reason: string) => void;
  /** Opens a session file in a new tab (PDF and images display; other formats download). False if no file is held. */
  openDocumentFile: (id: string) => boolean;
  /** Saves a session file through the browser's download. False if no file is held. */
  downloadDocumentFile: (id: string) => boolean;
  notice: SessionNotice | null;
  showNotice: (message: string, path: string) => void;
  dismissNotice: () => void;
}

const SessionStoreContext = createContext<SessionStore | null>(null);

const byNewestUpdate = (a: Shipment, b: Shipment) => b.updatedAt.localeCompare(a.updatedAt);
const byNewestIssue = (a: Quotation, b: Quotation) =>
  b.issuedAt.localeCompare(a.issuedAt) || b.reference.localeCompare(a.reference);

function toActivity(
  events: (ShipmentEvent | QuotationEvent)[],
  link: Pick<ActivityItem, 'shipmentReference' | 'quotationReference'>,
): ActivityItem[] {
  return events.map((e) => ({ id: e.id, at: e.at, actor: e.actor, message: e.message, ...link })).reverse();
}

/** Revoke after a delay: long enough for the new tab or download to read the blob. */
function withObjectUrl(blob: Blob, consume: (url: string) => void, keepMs: number) {
  const url = URL.createObjectURL(blob);
  consume(url);
  setTimeout(() => URL.revokeObjectURL(url), keepMs);
}

export function SessionStoreProvider({
  initialShipments,
  initialQuotations,
  initialActivity,
  initialDocuments,
  children,
}: {
  initialShipments: Shipment[];
  initialQuotations: Quotation[];
  initialActivity: ActivityItem[];
  initialDocuments: ShipmentDocument[];
  children: React.ReactNode;
}) {
  const [shipments, setShipments] = useState(initialShipments);
  const [quotations, setQuotations] = useState(initialQuotations);
  const [activity, setActivity] = useState(initialActivity);
  const [documents, setDocuments] = useState(initialDocuments);
  // Document id → file contents, in memory only.
  const [files, setFiles] = useState<Record<string, Blob>>({});
  const [notice, setNotice] = useState<SessionNotice | null>(null);

  // Drop a notice once the user has moved to a different page
  // (adjusting state during render, as React recommends over an effect).
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (notice && notice.path !== pathname) setNotice(null);
  }

  const store = useMemo<SessionStore>(() => {
    const context = (): ChangeContext => ({ now: nowIso(), actor: SESSION_ACTOR });
    const record = (items: ActivityItem[]) => setActivity((current) => [...items, ...current]);
    const logOnShipment = (reference: string, message: string, ctx: ChangeContext) => {
      const shipment = shipments.find((s) => s.reference === reference);
      if (!shipment) return;
      const next = addShipmentEvent(shipment, 'document', message, ctx);
      setShipments((list) => list.map((s) => (s.reference === reference ? next : s)));
      record(toActivity(next.events.slice(-1), { shipmentReference: reference }));
    };
    return {
      shipments: [...shipments].sort(byNewestUpdate),
      quotations: [...quotations].sort(byNewestIssue),
      activity,
      documents,
      sessionFileBytes: Object.values(files).reduce((sum, b) => sum + b.size, 0),
      createShipment(input) {
        const created = buildShipment(input, shipments, context());
        setShipments((list) => [created, ...list]);
        record(toActivity(created.events, { shipmentReference: created.reference }));
        return created;
      },
      updateShipment(reference, change) {
        const current = shipments.find((s) => s.reference === reference);
        if (!current) return false;
        const next = change(current, context());
        if (next === current) return false;
        setShipments((list) => list.map((s) => (s.reference === reference ? next : s)));
        record(toActivity(next.events.slice(current.events.length), { shipmentReference: reference }));
        return true;
      },
      createQuotation(input, duplicatedFrom) {
        const created = buildQuotation(input, quotations, context(), duplicatedFrom);
        setQuotations((list) => [created, ...list]);
        record(toActivity(created.events, { quotationReference: created.reference }));
        return created;
      },
      updateQuotation(reference, change) {
        const current = quotations.find((q) => q.reference === reference);
        if (!current) return false;
        const next = change(current, context());
        if (next === current) return false;
        setQuotations((list) => list.map((q) => (q.reference === reference ? next : q)));
        record(toActivity(next.events.slice(current.events.length), { quotationReference: reference }));
        return true;
      },
      uploadDocuments(request, blobs) {
        const ctx = context();
        const result = attachUploads(documents, request, ctx);
        setDocuments(result.documents);
        setFiles((current) => ({ ...current, ...Object.fromEntries(result.ids.map((id, i) => [id, blobs[i]])) }));
        const names = request.files.map((f) => f.name).join(', ');
        const fulfilled = result.fulfilledId ? ', fulfilling the outstanding requirement' : '';
        logOnShipment(
          request.shipmentReference,
          `${documentTypeLabel[request.type]} added (${names})${fulfilled}. File kept in this browser tab only.`,
          ctx,
        );
        return result.ids;
      },
      reviewDocument(id, decision, reason) {
        const doc = documents.find((d) => d.id === id);
        if (!doc) return;
        const ctx = context();
        setDocuments((list) => list.map((d) => (d.id === id ? applyReview(d, decision, reason, ctx) : d)));
        const because = reason.trim() ? `: ${reason.trim()}` : '.';
        logOnShipment(doc.shipmentReference, `${documentTypeLabel[doc.type]} marked ${documentStatusMeta[decision].label.toLowerCase()}${because}`, ctx);
      },
      openDocumentFile(id) {
        const blob = files[id];
        if (!blob) return false;
        withObjectUrl(blob, (url) => window.open(url, '_blank', 'noopener'), 60_000);
        return true;
      },
      downloadDocumentFile(id) {
        const blob = files[id];
        const name = documents.find((d) => d.id === id)?.file?.name;
        if (!blob || !name) return false;
        withObjectUrl(
          blob,
          (url) => {
            const link = document.createElement('a');
            link.href = url;
            link.download = name;
            link.click();
          },
          10_000,
        );
        return true;
      },
      notice,
      showNotice: (message, path) => setNotice({ message, path }),
      dismissNotice: () => setNotice(null),
    };
  }, [shipments, quotations, activity, documents, files, notice]);

  return <SessionStoreContext value={store}>{children}</SessionStoreContext>;
}

export function useSessionStore(): SessionStore {
  const store = use(SessionStoreContext);
  if (!store) throw new Error('useSessionStore must be used inside <SessionStoreProvider>');
  return store;
}

export function useSessionShipment(reference: string): Shipment | undefined {
  return useSessionStore().shipments.find((s) => s.reference === reference);
}

export function useSessionQuotation(reference: string): Quotation | undefined {
  return useSessionStore().quotations.find((q) => q.reference === reference);
}
