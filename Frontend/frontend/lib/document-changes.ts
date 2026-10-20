// Pure operations on document records. Used by the session store; with a
// real backend these rules belong on the server (docs/api-contracts.md).

import { newId, type ChangeContext } from '@/lib/shipment-changes';
import type { DocumentFile, DocumentType, ShipmentDocument } from '@/lib/types';

export interface UploadRequest {
  shipmentReference: string;
  customerName: string;
  type: DocumentType;
  note?: string;
  files: Omit<DocumentFile, 'uploadedAt' | 'uploadedBy'>[];
}

/** An open requirement an upload can fulfil: same shipment and type, no file yet, missing or rejected. */
export function openRequirement(docs: ShipmentDocument[], shipmentReference: string, type: DocumentType) {
  return docs.find(
    (d) => d.shipmentReference === shipmentReference && d.type === type && !d.file && (d.status === 'missing' || d.status === 'rejected'),
  );
}

/**
 * Adds one record per file, with status "received". The first file fulfils an
 * open requirement of the same type (so a missing certificate of origin
 * becomes received instead of being duplicated).
 * Returns the new list and the ids of the affected records, in file order.
 */
export function attachUploads(
  docs: ShipmentDocument[],
  request: UploadRequest,
  ctx: ChangeContext,
): { documents: ShipmentDocument[]; ids: string[]; fulfilledId?: string } {
  const requirement = openRequirement(docs, request.shipmentReference, request.type);
  const ids: string[] = [];
  let result = docs;
  request.files.forEach((meta, i) => {
    const file: DocumentFile = { ...meta, uploadedAt: ctx.now, uploadedBy: ctx.actor };
    const base = { status: 'received' as const, receivedAt: ctx.now, file, note: request.note, reviewedAt: undefined, reviewedBy: undefined };
    if (i === 0 && requirement) {
      result = result.map((d) => (d.id === requirement.id ? { ...d, ...base } : d));
      ids.push(requirement.id);
    } else {
      const id = newId('doc');
      result = [
        ...result,
        { id, shipmentReference: request.shipmentReference, customerName: request.customerName, type: request.type, ...base },
      ];
      ids.push(id);
    }
  });
  return { documents: result, ids, fulfilledId: requirement?.id };
}

export type ReviewDecision = 'verified' | 'rejected';

/** Only received documents can be reviewed; a rejection needs a reason. */
export function validateReview(doc: ShipmentDocument, decision: ReviewDecision, reason: string): string | undefined {
  if (doc.status !== 'received') return 'Only received documents can be verified or rejected.';
  if (decision === 'rejected' && !reason.trim()) return 'Enter the reason for rejecting this document.';
  if (reason.trim().length > 300) return 'Use 300 characters or fewer.';
  return undefined;
}

export function applyReview(doc: ShipmentDocument, decision: ReviewDecision, reason: string, ctx: ChangeContext): ShipmentDocument {
  return {
    ...doc,
    status: decision,
    note: reason.trim() || doc.note,
    reviewedAt: ctx.now,
    reviewedBy: ctx.actor,
  };
}
