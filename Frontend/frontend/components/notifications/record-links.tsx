'use client';

// Links from a notification or task to the shipment, quotation, document or
// invoice it concerns. Document labels come from the session's document records.

import Link from 'next/link';
import { useSessionStore } from '@/lib/data/session-store';
import { documentTypeLabel } from '@/lib/labels';
import { documentHref, invoiceHref, quotationHref, shipmentHref, type RecordLinks as Links } from '@/lib/notifications';

const chip =
  'inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-blue-700 hover:bg-blue-50 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600';

export function RecordLinks({ links }: { links: Links }) {
  const { documents } = useSessionStore();
  const doc = links.documentId ? documents.find((d) => d.id === links.documentId) : undefined;
  const items = [
    links.shipmentReference && { href: shipmentHref(links.shipmentReference), label: links.shipmentReference, kind: 'Shipment', mono: true },
    links.quotationReference && { href: quotationHref(links.quotationReference), label: links.quotationReference, kind: 'Quotation', mono: true },
    links.documentId && {
      href: documentHref(links.documentId),
      label: doc ? documentTypeLabel[doc.type] : links.documentId,
      kind: 'Document',
      mono: false,
    },
    links.invoiceNumber && { href: invoiceHref(links.invoiceNumber), label: links.invoiceNumber, kind: 'Invoice', mono: true },
  ].filter((x): x is { href: string; label: string; kind: string; mono: boolean } => Boolean(x));
  if (items.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={`${chip} ${i.mono ? 'font-mono' : ''}`}>
          <span className="sr-only">{i.kind} </span>
          {i.label}
        </Link>
      ))}
    </span>
  );
}
