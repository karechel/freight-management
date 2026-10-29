'use client';

// Audit log preview built from the change histories the session store already
// keeps (shipments, delays, documents, expenses, quotations and tasks), plus the demo
// activity entries. It is not a tamper-proof production audit log: everything
// lives in this browser tab and is lost on reload.

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { inputClass } from '@/components/ui/form';
import { EmptyState } from '@/components/ui/states';
import { Table, Td, Th } from '@/components/ui/table';
import { useSessionStore } from '@/lib/data/session-store';
import { formatDateTime } from '@/lib/format';
import { SESSION_ACTOR } from '@/lib/shipment-changes';

type RecordKind = 'shipment' | 'quotation' | 'task' | 'other';

interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  kind: RecordKind;
  record?: string;
  href?: string;
  message: string;
  session: boolean;
}

const kindLabel: Record<RecordKind, string> = { shipment: 'Shipment', quotation: 'Quotation', task: 'Task', other: 'Other' };

/** Rows shown before "show more". */
const PAGE = 25;

export function AuditLog() {
  const { shipments, quotations, tasks, activity } = useSessionStore();
  const [kind, setKind] = useState<'' | RecordKind>('');
  const [origin, setOrigin] = useState<'' | 'session' | 'demo'>('');
  const [limit, setLimit] = useState(PAGE);

  const entries: AuditEntry[] = [
    ...shipments.flatMap((s) =>
      s.events.map((e) => ({
        id: e.id,
        at: e.at,
        actor: e.actor,
        kind: 'shipment' as const,
        record: s.reference,
        href: `/shipments/${encodeURIComponent(s.reference)}`,
        message: e.message,
        session: e.actor === SESSION_ACTOR,
      })),
    ),
    ...quotations.flatMap((q) =>
      q.events.map((e) => ({
        id: e.id,
        at: e.at,
        actor: e.actor,
        kind: 'quotation' as const,
        record: q.reference,
        href: `/quotations/${encodeURIComponent(q.reference)}`,
        message: e.message,
        session: e.actor === SESSION_ACTOR,
      })),
    ),
    ...tasks.flatMap((t) =>
      t.notes.map((n) => ({
        id: n.id,
        at: n.at,
        actor: n.actor,
        kind: 'task' as const,
        record: t.title,
        href: `/notifications/tasks/${encodeURIComponent(t.id)}`,
        message: n.note,
        session: n.actor === SESSION_ACTOR,
      })),
    ),
    // Demo activity entries; activity created in this tab is already listed above from the record histories.
    ...activity
      .filter((a) => a.actor !== SESSION_ACTOR)
      .map((a) => {
        const record = a.shipmentReference ?? a.quotationReference;
        const kind: RecordKind = a.shipmentReference ? 'shipment' : a.quotationReference ? 'quotation' : 'other';
        return {
          id: a.id,
          at: a.at,
          actor: a.actor,
          kind,
          record,
          href: a.shipmentReference
            ? `/shipments/${encodeURIComponent(a.shipmentReference)}`
            : a.quotationReference
              ? `/quotations/${encodeURIComponent(a.quotationReference)}`
              : undefined,
          message: a.message,
          session: false,
        };
      }),
  ]
    .filter((e) => (!kind || e.kind === kind) && (!origin || (origin === 'session') === e.session))
    .sort((a, b) => b.at.localeCompare(a.at));

  return (
    <Card>
      <CardHeader
        title="Audit log"
        description="Who created or changed records, and when. Newest first."
      />
      <CardBody className="grid grid-cols-1 gap-3 border-b border-slate-200 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-kind" className="text-xs font-medium text-slate-600">
            Record type
          </label>
          <select id="audit-kind" value={kind} onChange={(e) => setKind(e.target.value as '' | RecordKind)} className={`${inputClass} w-full`}>
            <option value="">All records</option>
            <option value="shipment">Shipments (incl. delays, documents, expenses)</option>
            <option value="quotation">Quotations</option>
            <option value="task">Tasks</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-origin" className="text-xs font-medium text-slate-600">
            Source
          </label>
          <select id="audit-origin" value={origin} onChange={(e) => setOrigin(e.target.value as '' | 'session' | 'demo')} className={`${inputClass} w-full`}>
            <option value="">All entries</option>
            <option value="session">Changes made in this tab</option>
            <option value="demo">Demo entries</option>
          </select>
        </div>
        <p className="self-end text-sm text-slate-600" role="status">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </p>
      </CardBody>
      {entries.length === 0 ? (
        <EmptyState
          title="No entries"
          description={origin === 'session' ? 'Nothing has been changed in this tab yet. Edit a shipment, quotation, document or expense and it appears here.' : undefined}
        />
      ) : (
        <>
          <Table caption="Audit log">
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>Record</Th>
                <Th>Change</Th>
              </tr>
            </thead>
            <tbody>
              {entries.slice(0, limit).map((e) => (
                <tr key={`${e.kind}-${e.id}`}>
                  <Td className="whitespace-nowrap">{formatDateTime(e.at)}</Td>
                  <Td>
                    <p>{e.actor}</p>
                    <Badge tone={e.session ? 'info' : 'neutral'} className="mt-1">
                      {e.session ? 'This tab' : 'Demo entry'}
                    </Badge>
                  </Td>
                  <Td>
                    <p className="text-xs text-slate-500">{kindLabel[e.kind]}</p>
                    {e.record && e.href ? (
                      <Link href={e.href} className="rounded font-mono text-xs text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">
                        {e.record}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td className="max-w-lg">{e.message}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {entries.length > limit && (
            <div className="px-4 py-3 sm:px-5">
              <button
                type="button"
                onClick={() => setLimit((l) => l + PAGE)}
                className="rounded text-sm font-medium text-blue-700 hover:text-blue-900 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                Show {Math.min(PAGE, entries.length - limit)} more
              </button>
            </div>
          )}
        </>
      )}
      <p className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500 sm:px-5">
        Preview only. Without sign-in, changes made here are attributed to &ldquo;{SESSION_ACTOR}&rdquo;. A production audit log
        must be written by the backend, record the signed-in user, and be impossible to edit or delete from the interface.
      </p>
    </Card>
  );
}
