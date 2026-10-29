'use client';

import { useState } from 'react';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { DetailList } from '@/components/ui/detail-list';
import { DateField, TextAreaField } from '@/components/ui/form';
import { ClockIcon } from '@/components/ui/icons';
import { useSessionStore } from '@/lib/data/session-store';
import { fromDateTimeInput, isBefore, nowDateTimeInput, nowIso } from '@/lib/dates';
import { formatDateTime, formatDuration } from '@/lib/format';
import { customerNotificationMeta, delayReasonLabel, delayStatusMeta, severityMeta } from '@/lib/labels';
import { delayDurationMs } from '@/lib/metrics';
import { addDelayAction } from '@/lib/shipment-changes';
import type { Shipment, ShipmentDelay } from '@/lib/types';

export const delayEditHref = (reference: string, delayId: string) =>
  `/shipments/${encodeURIComponent(reference)}/delays/${encodeURIComponent(delayId)}/edit`;

function DelayDuration({ delay }: { delay: ShipmentDelay }) {
  const ms = delayDurationMs(delay);
  if (ms === undefined) return <span className="text-slate-500">Not known until a revised date is recorded</span>;
  return <span className="font-semibold text-amber-900">+{formatDuration(ms)}</span>;
}

function ActionForm({ shipment, delay }: { shipment: Shipment; delay: ShipmentDelay }) {
  const store = useSessionStore();
  const [at, setAt] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ at?: string; note?: string }>({});
  const formId = `delay-action-${delay.id}`;

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found: { at?: string; note?: string } = {};
    const iso = fromDateTimeInput(at);
    if (!at) found.at = 'Enter when the action was taken.';
    else if (!iso) found.at = 'Enter a valid date and time.';
    else if (isBefore(nowIso(), iso)) found.at = 'This date cannot be in the future.';
    else if (isBefore(iso, delay.identifiedAt)) found.at = 'Cannot be before the delay was identified.';
    if (!note.trim()) found.note = 'Describe the action taken.';
    else if (note.trim().length > 300) found.note = 'Use 300 characters or fewer.';
    setErrors(found);
    if (found.at || found.note || !iso) return;
    store.updateShipment(shipment.reference, (s, ctx) => addDelayAction(s, delay.id, note.trim(), iso, ctx));
    setAt('');
    setNote('');
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-[14rem_1fr_auto] sm:items-end">
      <DateField id={`${formId}-at`} withTime required label="When" value={at} onChange={setAt} onNow={() => setAt(nowDateTimeInput())} error={errors.at} />
      <TextAreaField id={`${formId}-note`} required label="Action taken" value={note} onChange={setNote} rows={1} maxLength={300} error={errors.note} />
      <Button type="submit" variant="secondary" size="sm" className="sm:mb-0.5">
        Add action
      </Button>
    </form>
  );
}

export function DelayCard({ shipment, delay }: { shipment: Shipment; delay: ShipmentDelay }) {
  const resolved = delay.status === 'resolved';
  return (
    <article
      aria-labelledby={`${delay.id}-title`}
      className={`rounded-xl border bg-white shadow-xs ${resolved ? 'border-slate-200' : delay.severity === 'high' ? 'border-red-300' : 'border-amber-300'}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className={`mt-0.5 rounded-lg p-1.5 ${resolved ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-800'}`}>
            <ClockIcon className="size-4" />
          </span>
          <div className="min-w-0">
            <h3 id={`${delay.id}-title`} className="text-sm font-semibold text-slate-900">
              {delayReasonLabel[delay.reason]}
            </h3>
            <p className="mt-0.5 text-sm text-slate-700">{delay.reasonDetail}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge meta={delayStatusMeta[delay.status]} />
          <Badge tone={severityMeta[delay.severity].tone}>{severityMeta[delay.severity].label} severity</Badge>
          <ButtonLink href={delayEditHref(shipment.reference, delay.id)} variant="secondary" size="sm">
            Edit delay
          </ButtonLink>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 px-4 py-4 sm:px-5 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-slate-500">Original expected</p>
              <p className="mt-0.5 text-sm text-slate-900">{formatDateTime(delay.originalExpectedAt)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Revised expected</p>
              <p className="mt-0.5 text-sm text-slate-900">
                {delay.revisedExpectedAt ? formatDateTime(delay.revisedExpectedAt) : <span className="text-slate-500">Not yet known</span>}
              </p>
              {delay.revisedExpectedAt && delay.affectsEta && <p className="text-xs text-slate-500">Used as the shipment&apos;s current ETA</p>}
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Delay duration</p>
              <p className="mt-0.5 text-sm">
                <DelayDuration delay={delay} />
              </p>
            </div>
          </div>
          <DetailList
            columns={2}
            items={[
              { label: 'Affected milestone', value: delay.milestone },
              { label: 'Identified', value: formatDateTime(delay.identifiedAt) },
              { label: 'Follow-up by', value: delay.followUpBy },
              { label: 'Next action', value: delay.nextAction ?? '—' },
              {
                label: 'Customer notification',
                value: (
                  <>
                    <StatusBadge meta={customerNotificationMeta[delay.customerNotification]} />
                    {delay.customerNotifiedAt && <span className="ml-2 text-xs text-slate-500">{formatDateTime(delay.customerNotifiedAt)}</span>}
                  </>
                ),
              },
              { label: 'Resolved', value: delay.resolvedAt ? formatDateTime(delay.resolvedAt) : '—' },
              ...(delay.notes ? [{ label: 'Notes', value: delay.notes }] : []),
            ]}
          />
          <p className="text-xs text-slate-500">
            The system does not send notifications. Record here how and when the customer was told.
          </p>
        </div>

        <div>
          <h4 className="text-xs font-semibold tracking-wide text-slate-600 uppercase">Delay timeline</h4>
          <ol className="mt-2 flex flex-col">
            {delay.actions.map((a, i) => (
              <li key={a.id} className="relative flex gap-3 pb-3 last:pb-0">
                {i < delay.actions.length - 1 && (
                  <span className="absolute top-3 left-[5px] h-full w-px bg-slate-200" aria-hidden="true" />
                )}
                <span
                  className={`relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-white ring-1 ring-slate-300 ${a.automatic ? 'bg-slate-400' : 'bg-amber-600'}`}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-sm text-slate-800">{a.note}</p>
                  <p className="text-xs text-slate-500">
                    <time dateTime={a.at}>{formatDateTime(a.at)}</time> · {a.actor}
                    {a.automatic ? ' · recorded change' : ''}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
      {!resolved && (
        <div className="border-t border-slate-100 px-4 pb-4 sm:px-5">
          <ActionForm shipment={shipment} delay={delay} />
        </div>
      )}
    </article>
  );
}
