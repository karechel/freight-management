'use client';

// The live shipment page (backend Phase 3). Display parts reuse the demo components through
// `toDisplayShipment`; every change is sent to the API, which applies the rules, and the page
// then reloads from the server.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { DetailList } from '@/components/ui/detail-list';
import { CheckboxField, DateField, SelectField, TextAreaField, TextField } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, PendingNotice } from '@/components/ui/states';
import { ApiError, backend } from '@/lib/api/browser';
import { fromDateTimeInput, nowDateTimeInput, toDateTimeInput } from '@/lib/dates';
import { formatDateTime, formatNumber } from '@/lib/format';
import {
  customerNotificationMeta,
  customsStatusMeta,
  delayReasonLabel,
  delayStatusMeta,
  directionLabel,
  modeLabel,
  severityMeta,
  shipmentStatusMeta,
  shipmentStatusOrder,
} from '@/lib/labels';
import { bookingHref } from '@/lib/live-quotations';
import {
  containerTypeLabel,
  issueTypeLabel,
  toDisplayShipment,
  trimQuantity,
  type ContainerType,
  type IssueType,
  type LiveIssue,
  type LiveShipment,
  type PersonRef,
} from '@/lib/live-shipments';
import type { CustomerNotificationStatus, DelayReason, DelayStatus, Severity, ShipmentStatus } from '@/lib/types';
import { MilestoneTimeline } from './milestone-timeline';
import { ShipmentDates } from './shipment-dates';

const linkClass = 'rounded text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600';
const options = <K extends string>(labels: Record<K, string>) =>
  (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }));
const metaOptions = <K extends string>(meta: Record<K, { label: string }>) =>
  (Object.keys(meta) as K[]).map((value) => ({ value, label: meta[value].label }));

/** Sends one change and refreshes the page; field errors come back keyed by API field name. */
function useChange() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  async function run(send: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    setFailure(undefined);
    setErrors({});
    try {
      await send();
      after?.();
      router.refresh();
      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        setFailure(error.message);
      } else {
        setFailure('The change could not be saved. Try again.');
      }
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, failure, errors, run, setErrors };
}

function Failure({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
      {message}
    </p>
  );
}

const iso = (value: string) => (value ? (fromDateTimeInput(value) ?? null) : null);

// --- Status -------------------------------------------------------------------------------

function StatusPanel({ shipment: s }: { shipment: LiveShipment }) {
  const { busy, failure, errors, run } = useChange();
  const [status, setStatus] = useState<ShipmentStatus | ''>('');
  const [atd, setAtd] = useState('');
  const [ata, setAta] = useState('');
  const [deliveredAt, setDeliveredAt] = useState('');
  const [note, setNote] = useState('');
  if (s.status === 'delivered') {
    return <p className="text-sm text-slate-600">Delivered shipments are final; the status no longer changes.</p>;
  }
  const askAtd = status === 'in_transit' && !s.atd;
  const askAta = (status === 'arrived' || status === 'customs' || status === 'released') && !s.ata;
  const askDelivered = status === 'delivered';

  function submit() {
    if (!status) return;
    void run(
      () =>
        backend.post(`shipments/${encodeURIComponent(s.reference)}/status`, {
          status,
          ...(askAtd && atd ? { atd: iso(atd) } : {}),
          ...(askAta && ata ? { ata: iso(ata) } : {}),
          ...(askDelivered ? { deliveredAt: iso(deliveredAt) } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      () => {
        setStatus('');
        setNote('');
      },
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 pt-4">
      <Failure message={failure} />
      <SelectField
        id="status-new"
        label="Change status to"
        value={status}
        onChange={(v) => setStatus(v as ShipmentStatus)}
        placeholder="Select a status"
        options={shipmentStatusOrder.filter((x) => x !== s.status).map((x) => ({ value: x, label: shipmentStatusMeta[x].label }))}
        error={errors.status}
      />
      {askAtd && (
        <DateField id="status-atd" label="Actual departure" withTime value={atd} onChange={setAtd} onNow={() => setAtd(nowDateTimeInput())} hint="Optional; completes the departure milestone." error={errors.atd} />
      )}
      {askAta && (
        <DateField id="status-ata" label="Actual arrival" withTime required={status === 'arrived'} value={ata} onChange={setAta} onNow={() => setAta(nowDateTimeInput())} error={errors.ata} />
      )}
      {askDelivered && (
        <DateField id="status-delivered" label="Actual delivery" withTime required value={deliveredAt} onChange={setDeliveredAt} onNow={() => setDeliveredAt(nowDateTimeInput())} hint="Delivered is final." error={errors.deliveredAt} />
      )}
      <TextAreaField id="status-note" label="Note" value={note} onChange={setNote} rows={2} maxLength={500} hint="Optional; kept in the history." error={errors.note} />
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={busy || !status}>
          {busy ? 'Saving…' : 'Change status'}
        </Button>
      </div>
    </div>
  );
}

// --- Milestones ---------------------------------------------------------------------------

function MilestonePanel({ shipment: s }: { shipment: LiveShipment }) {
  const { busy, failure, errors, run } = useChange();
  // Delivery is recorded with the status change, so its milestone is not offered here.
  const editable = s.milestones.filter((m) => !/^delivered/i.test(m.label));
  const firstOpen = editable.find((m) => m.state !== 'done') ?? editable[0];
  const [id, setId] = useState(firstOpen ? String(firstOpen.id) : '');
  const selected = s.milestones.find((m) => String(m.id) === id);
  const [actualAt, setActualAt] = useState(toDateTimeInput(selected?.actualAt ?? undefined));
  const [note, setNote] = useState(selected?.note ?? '');

  function choose(value: string) {
    setId(value);
    const m = s.milestones.find((x) => String(x.id) === value);
    setActualAt(toDateTimeInput(m?.actualAt ?? undefined));
    setNote(m?.note ?? '');
  }
  const path = `shipments/${encodeURIComponent(s.reference)}/milestones/${id}`;
  if (!selected) return null;
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 pt-4">
      <h3 className="text-sm font-semibold text-slate-900">Record a milestone</h3>
      <Failure message={failure} />
      <SelectField id="milestone-select" label="Milestone" value={id} onChange={choose} options={editable.map((m) => ({ value: String(m.id), label: `${m.label}${m.state === 'done' ? ' (completed)' : ''}` }))} />
      <DateField id="milestone-actual" label="Completed at" withTime value={actualAt} onChange={setActualAt} onNow={() => setActualAt(nowDateTimeInput())} hint="Departure and arrival are also the shipment's actual times." error={errors.actualAt} />
      <TextField id="milestone-note" label="Note" value={note} onChange={setNote} maxLength={500} error={errors.note} />
      <div className="flex flex-wrap justify-end gap-2">
        {selected.actualAt && (
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => void run(() => backend.patch(path, { actualAt: null }))}>
            Mark not completed
          </Button>
        )}
        <Button size="sm" disabled={busy || !actualAt} onClick={() => void run(() => backend.patch(path, { actualAt: iso(actualAt), note: note.trim() || null }))}>
          {busy ? 'Saving…' : 'Save milestone'}
        </Button>
      </div>
    </div>
  );
}

// --- Delays and issues --------------------------------------------------------------------

function IssueCard({ shipment, issue: i, canManage, staff }: { shipment: LiveShipment; issue: LiveIssue; canManage: boolean; staff: PersonRef[] }) {
  const { busy, failure, errors, run } = useChange();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<DelayStatus>(i.status);
  const [revised, setRevised] = useState(toDateTimeInput(i.revisedExpectedAt ?? undefined));
  const [affectsEta, setAffectsEta] = useState(i.affectsEta);
  const [resolvedAt, setResolvedAt] = useState(toDateTimeInput(i.resolvedAt ?? undefined));
  const [resolution, setResolution] = useState(i.resolution ?? '');
  const [notification, setNotification] = useState<CustomerNotificationStatus>(i.customerNotification);
  const [notifiedAt, setNotifiedAt] = useState(toDateTimeInput(i.customerNotifiedAt ?? undefined));
  const [nextAction, setNextAction] = useState(i.nextAction ?? '');
  const [followUp, setFollowUp] = useState(i.followUpUser ? String(i.followUpUser.id) : '');
  const [actionNote, setActionNote] = useState('');
  const path = `shipments/${encodeURIComponent(shipment.reference)}/issues/${i.id}`;
  const delay = i.type === 'delay';

  function save() {
    void run(
      () =>
        backend.patch(path, {
          status,
          ...(delay ? { revisedExpectedAt: iso(revised), affectsEta } : {}),
          resolvedAt: status === 'resolved' ? iso(resolvedAt) : null,
          resolution: resolution.trim() || null,
          customerNotification: notification,
          customerNotifiedAt: notification === 'informed_manually' ? iso(notifiedAt) : null,
          nextAction: nextAction.trim() || null,
          followUpUserId: followUp ? Number(followUp) : null,
        }),
      () => setEditing(false),
    );
  }

  return (
    <li className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={delay ? 'warning' : 'danger'}>{issueTypeLabel[i.type]}</Badge>
        <StatusBadge meta={severityMeta[i.severity]} />
        <StatusBadge meta={delayStatusMeta[i.status]} />
        {i.reason && <span className="text-sm font-medium text-slate-900">{delayReasonLabel[i.reason]}</span>}
      </div>
      <p className="mt-2 text-sm text-slate-800">{i.reasonDetail}</p>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-slate-600 sm:grid-cols-2">
        <div>
          <dt className="inline font-medium">Identified: </dt>
          <dd className="inline">{formatDateTime(i.identifiedAt)}</dd>
        </div>
        {i.affectedMilestone && (
          <div>
            <dt className="inline font-medium">Affects: </dt>
            <dd className="inline">{i.affectedMilestone.label}</dd>
          </div>
        )}
        {i.originalExpectedAt && (
          <div>
            <dt className="inline font-medium">Originally expected: </dt>
            <dd className="inline">{formatDateTime(i.originalExpectedAt)}</dd>
          </div>
        )}
        {delay && (
          <div>
            <dt className="inline font-medium">Revised: </dt>
            <dd className="inline">
              {i.revisedExpectedAt ? formatDateTime(i.revisedExpectedAt) : 'not set yet'}
              {i.affectsEta && i.status !== 'resolved' && i.revisedExpectedAt ? ' · used as the ETA' : ''}
            </dd>
          </div>
        )}
        <div>
          <dt className="inline font-medium">Follow-up: </dt>
          <dd className="inline">{i.followUpUser?.name ?? 'Unassigned'}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Customer: </dt>
          <dd className="inline">
            {customerNotificationMeta[i.customerNotification].label}
            {i.customerNotifiedAt ? ` (${formatDateTime(i.customerNotifiedAt)})` : ''}
          </dd>
        </div>
        {i.nextAction && (
          <div className="sm:col-span-2">
            <dt className="inline font-medium">Next action: </dt>
            <dd className="inline">{i.nextAction}</dd>
          </div>
        )}
        {i.resolvedAt && (
          <div className="sm:col-span-2">
            <dt className="inline font-medium">Resolved: </dt>
            <dd className="inline">
              {formatDateTime(i.resolvedAt)}
              {i.resolution ? `: ${i.resolution}` : ''}
            </dd>
          </div>
        )}
      </dl>
      {i.actions && i.actions.length > 0 && (
        <ol className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-2 text-xs text-slate-600">
          {i.actions.map((a, index) => (
            <li key={index}>
              <span className="tabular-nums">{formatDateTime(a.at)}</span> · {a.actor}: {a.note}
            </li>
          ))}
        </ol>
      )}
      {canManage && !editing && (
        <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
          <Failure message={editing ? undefined : failure} />
          <div className="flex flex-wrap items-end gap-2">
            <TextField id={`issue-${i.id}-action`} label="Record an action taken" value={actionNote} onChange={setActionNote} maxLength={1000} className="min-w-48 flex-1" error={errors.note} />
            <Button variant="secondary" size="sm" disabled={busy || !actionNote.trim()} onClick={() => void run(() => backend.post(`${path}/actions`, { note: actionNote.trim() }), () => setActionNote(''))}>
              Add action
            </Button>
            <Button size="sm" onClick={() => setEditing(true)}>
              Update
            </Button>
          </div>
        </div>
      )}
      {canManage && editing && (
        <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Failure message={failure} />
          </div>
          <SelectField id={`issue-${i.id}-status`} label="Status" value={status} onChange={(v) => setStatus(v as DelayStatus)} options={metaOptions(delayStatusMeta)} error={errors.status} />
          <SelectField id={`issue-${i.id}-followup`} label="Responsible for follow-up" value={followUp} onChange={setFollowUp} placeholder="Unassigned" options={staff.map((p) => ({ value: String(p.id), label: p.name }))} error={errors.followUpUserId} />
          {delay && (
            <>
              <DateField id={`issue-${i.id}-revised`} label="Revised expected date" withTime value={revised} onChange={setRevised} error={errors.revisedExpectedAt} />
              <CheckboxField id={`issue-${i.id}-eta`} label="Use the revised date as the shipment ETA" checked={affectsEta} onChange={setAffectsEta} hint="Only while the delay is open." />
            </>
          )}
          {status === 'resolved' && (
            <>
              <DateField id={`issue-${i.id}-resolved`} label="Date resolved" withTime required value={resolvedAt} onChange={setResolvedAt} onNow={() => setResolvedAt(nowDateTimeInput())} error={errors.resolvedAt} />
              <TextField id={`issue-${i.id}-resolution`} label="Resolution" value={resolution} onChange={setResolution} maxLength={1000} error={errors.resolution} />
            </>
          )}
          <SelectField id={`issue-${i.id}-notify`} label="Customer notification" value={notification} onChange={(v) => setNotification(v as CustomerNotificationStatus)} options={metaOptions(customerNotificationMeta)} hint="The system sends nothing; record what was done." error={errors.customerNotification} />
          {notification === 'informed_manually' && (
            <DateField id={`issue-${i.id}-notified`} label="Date the customer was informed" withTime required value={notifiedAt} onChange={setNotifiedAt} onNow={() => setNotifiedAt(nowDateTimeInput())} error={errors.customerNotifiedAt} />
          )}
          <TextField id={`issue-${i.id}-next`} label="Next action" value={nextAction} onChange={setNextAction} maxLength={500} className="sm:col-span-2" error={errors.nextAction} />
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button variant="secondary" size="sm" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function NewIssueForm({ shipment: s, staff, onDone }: { shipment: LiveShipment; staff: PersonRef[]; onDone: () => void }) {
  const { busy, failure, errors, run } = useChange();
  const current = s.milestones.find((m) => m.state === 'current');
  const [type, setType] = useState<IssueType>('delay');
  const [severity, setSeverity] = useState<Severity | ''>('');
  const [reason, setReason] = useState<DelayReason | ''>('');
  const [detail, setDetail] = useState('');
  const [identifiedAt, setIdentifiedAt] = useState('');
  const [milestoneId, setMilestoneId] = useState(current ? String(current.id) : '');
  const [original, setOriginal] = useState(toDateTimeInput(current?.plannedAt ?? s.currentEta.at));
  const [revised, setRevised] = useState('');
  const [affectsEta, setAffectsEta] = useState(true);
  const [followUp, setFollowUp] = useState(s.assignedTo ? String(s.assignedTo.id) : '');
  const [nextAction, setNextAction] = useState('');
  const delay = type === 'delay';

  function submit() {
    void run(
      () =>
        backend.post(`shipments/${encodeURIComponent(s.reference)}/issues`, {
          type,
          severity: severity || undefined,
          reasonDetail: detail.trim() || undefined,
          identifiedAt: iso(identifiedAt) ?? undefined,
          affectedMilestoneId: milestoneId ? Number(milestoneId) : null,
          followUpUserId: followUp ? Number(followUp) : null,
          nextAction: nextAction.trim() || null,
          ...(delay
            ? { reason: reason || null, originalExpectedAt: iso(original), revisedExpectedAt: iso(revised), affectsEta }
            : {}),
        }),
      onDone,
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-blue-200 bg-blue-50/40 p-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Failure message={failure} />
      </div>
      <SelectField id="issue-type" label="Kind" required value={type} onChange={(v) => setType(v as IssueType)} options={options(issueTypeLabel)} />
      <SelectField id="issue-severity" label="Severity" required value={severity} onChange={(v) => setSeverity(v as Severity)} placeholder="Select severity" options={metaOptions(severityMeta)} error={errors.severity} />
      {delay && (
        <SelectField id="issue-reason" label="Delay reason" required value={reason} onChange={(v) => setReason(v as DelayReason)} placeholder="Select a reason" options={options(delayReasonLabel)} error={errors.reason} />
      )}
      <DateField id="issue-identified" label="Date identified" required withTime value={identifiedAt} onChange={setIdentifiedAt} onNow={() => setIdentifiedAt(nowDateTimeInput())} error={errors.identifiedAt} />
      <TextAreaField id="issue-detail" label="What happened" required value={detail} onChange={setDetail} rows={2} maxLength={1000} className="sm:col-span-2" error={errors.reasonDetail} />
      <SelectField id="issue-milestone" label="Affected milestone" value={milestoneId} onChange={setMilestoneId} placeholder="None" options={s.milestones.map((m) => ({ value: String(m.id), label: m.label }))} error={errors.affectedMilestoneId} />
      <SelectField id="issue-followup" label="Responsible for follow-up" value={followUp} onChange={setFollowUp} placeholder="Unassigned" options={staff.map((p) => ({ value: String(p.id), label: p.name }))} error={errors.followUpUserId} />
      {delay && (
        <>
          <DateField id="issue-original" label="Original expected date" required withTime value={original} onChange={setOriginal} error={errors.originalExpectedAt} />
          <DateField id="issue-revised" label="Revised expected date" withTime value={revised} onChange={setRevised} hint="Leave empty until it is known; nothing is estimated for you." error={errors.revisedExpectedAt} />
          <CheckboxField id="issue-eta" label="Use the revised date as the shipment ETA" checked={affectsEta} onChange={setAffectsEta} className="sm:col-span-2" />
        </>
      )}
      <TextField id="issue-next" label="Next action" value={nextAction} onChange={setNextAction} maxLength={500} className="sm:col-span-2" error={errors.nextAction} />
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button variant="secondary" size="sm" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : delay ? 'Record delay' : 'Record issue'}
        </Button>
      </div>
    </div>
  );
}

function IssuesCard({ shipment: s, canManage, staff }: { shipment: LiveShipment; canManage: boolean; staff: PersonRef[] }) {
  const [adding, setAdding] = useState(false);
  const open = s.issues.filter((i) => i.status !== 'resolved');
  const resolved = s.issues.filter((i) => i.status === 'resolved');
  return (
    <Card>
      <CardHeader
        title="Delays and issues"
        description="Delays revise the ETA only while open, and only when a revised date is recorded."
      >
        {canManage && !adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            Record delay or issue
          </Button>
        )}
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        {adding && <NewIssueForm shipment={s} staff={staff} onDone={() => setAdding(false)} />}
        {s.issues.length === 0 && !adding && <EmptyState title="No delays or issues" description="Record one when something holds this shipment up." />}
        {[...open, ...resolved].length > 0 && (
          <ul className="flex flex-col gap-3">
            {[...open, ...resolved].map((i) => (
              <IssueCard key={`${i.id}-${i.updatedAt}`} shipment={s} issue={i} canManage={canManage} staff={staff} />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

// --- Containers ---------------------------------------------------------------------------

function ContainersCard({ shipment: s, canManage }: { shipment: LiveShipment; canManage: boolean }) {
  const { busy, failure, errors, run } = useChange();
  const [number, setNumber] = useState('');
  const [type, setType] = useState<ContainerType | ''>('');
  const [seal, setSeal] = useState('');
  const path = `shipments/${encodeURIComponent(s.reference)}/containers`;
  const containers = s.containers ?? [];
  return (
    <Card>
      <CardHeader title="Containers" description="Container numbers use the ISO format: four letters and seven digits." />
      <CardBody className="flex flex-col gap-4">
        <Failure message={failure} />
        {containers.length === 0 ? (
          <p className="text-sm text-slate-600">No containers recorded.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {containers.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-mono font-medium text-slate-900">{c.containerNumber}</span>
                  <span className="text-slate-600"> · {containerTypeLabel[c.type]}</span>
                  {c.sealNumber && <span className="text-slate-500"> · seal {c.sealNumber}</span>}
                </span>
                {canManage && (
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run(() => backend.delete(`${path}/${c.id}`))}>
                    Remove<span className="sr-only"> container {c.containerNumber}</span>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canManage && (
          <div className="grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 sm:grid-cols-3">
            <TextField id="container-number" label="Container number" required value={number} onChange={setNumber} maxLength={15} placeholder="MSCU1234567" error={errors.containerNumber} />
            <SelectField id="container-type" label="Type" required value={type} onChange={(v) => setType(v as ContainerType)} placeholder="Select type" options={options(containerTypeLabel)} error={errors.type} />
            <TextField id="container-seal" label="Seal number" value={seal} onChange={setSeal} maxLength={40} error={errors.sealNumber} />
            <div className="flex justify-end sm:col-span-3">
              <Button
                size="sm"
                variant="secondary"
                disabled={busy || !number.trim() || !type}
                onClick={() =>
                  void run(
                    () => backend.post(path, { containerNumber: number, type, sealNumber: seal.trim() || null }),
                    () => {
                      setNumber('');
                      setType('');
                      setSeal('');
                    },
                  )
                }
              >
                Add container
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// --- Page -----------------------------------------------------------------------------------

export function LiveShipmentDetail({ shipment: s, canManage, staff }: { shipment: LiveShipment; canManage: boolean; staff: PersonRef[] }) {
  const display = toDisplayShipment(s);
  const weight = trimQuantity(s.grossWeightKg);
  const volume = trimQuantity(s.volumeCbm);
  return (
    <>
      <PageHeader title={s.reference} description={`${s.customer.name} · ${s.origin} → ${s.destination}`} back={{ href: '/shipments', label: 'All shipments' }}>
        <StatusBadge meta={shipmentStatusMeta[s.status]} />
        {s.needsAttention && <Badge tone="danger">Needs attention</Badge>}
        {canManage && (
          <ButtonLink href={`/shipments/${encodeURIComponent(s.reference)}/edit`} variant="secondary">
            Edit details
          </ButtonLink>
        )}
      </PageHeader>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader title="Shipment details" />
            <CardBody>
              <DetailList
                items={[
                  {
                    label: 'Customer',
                    value: (
                      <Link href={`/parties/${s.customer.id}`} className={linkClass}>
                        {s.customer.name}
                      </Link>
                    ),
                  },
                  {
                    label: 'Booking',
                    value: s.booking ? (
                      <Link href={bookingHref(s.booking.reference)} className={`${linkClass} font-mono`}>
                        {s.booking.reference}
                      </Link>
                    ) : (
                      'Opened without a booking'
                    ),
                  },
                  { label: 'Mode and direction', value: `${modeLabel[s.mode]} · ${directionLabel[s.direction]}` },
                  { label: 'Route', value: `${s.origin} → ${s.destination}` },
                  { label: 'Cargo', value: s.cargoDescription },
                  { label: 'Equipment', value: s.equipment ?? 'Not recorded' },
                  { label: 'Packages and weight', value: `${s.packages !== null ? formatNumber(s.packages) : '—'} packages · ${weight ? `${formatNumber(Number(weight))} kg` : 'weight not recorded'}${volume ? ` · ${volume} m³` : ''}` },
                  { label: 'B/L, AWB or consignment number', value: s.transportDocRef ?? 'Pending' },
                  { label: 'Vessel or flight', value: [s.vesselOrFlight, s.voyageNumber].filter(Boolean).join(' · ') || 'Not recorded' },
                  { label: 'Carrier', value: s.carrier?.name ?? 'Not recorded' },
                  { label: 'Agent', value: s.agent?.name ?? '—' },
                  { label: 'Assigned to', value: s.assignedTo?.name ?? 'Unassigned' },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Dates" description="Estimated dates against what actually happened, in Nairobi time." />
            <CardBody>
              <ShipmentDates shipment={display} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Milestones" />
            <CardBody className="flex flex-col gap-4">
              <MilestoneTimeline milestones={display.milestones} />
              {canManage && s.status !== 'delivered' && <MilestonePanel key={s.updatedAt} shipment={s} />}
            </CardBody>
          </Card>
          <IssuesCard shipment={s} canManage={canManage} staff={staff} />
          <ContainersCard key={`containers-${s.updatedAt}`} shipment={s} canManage={canManage} />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Status" />
            <CardBody className="flex flex-col gap-4">
              <DetailList
                columns={1}
                items={[
                  { label: 'Current status', value: <StatusBadge meta={shipmentStatusMeta[s.status]} /> },
                  {
                    label: 'ETA to plan with',
                    value: `${formatDateTime(s.currentEta.at)}${s.currentEta.revised ? ' (revised by an open delay)' : ''}`,
                  },
                  { label: 'Created', value: `${formatDateTime(s.createdAt)}${s.createdBy ? ` by ${s.createdBy.name}` : ''}` },
                ]}
              />
              {canManage && <StatusPanel key={`${s.status}-${s.updatedAt}`} shipment={s} />}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Customs" description="A summary only. Customs entries are managed in a later phase." />
            <CardBody>
              {s.customs ? (
                <DetailList
                  columns={1}
                  items={[
                    { label: 'Status', value: <StatusBadge meta={customsStatusMeta[s.customs.status]} /> },
                    { label: 'Internal reference', value: <span className="font-mono">{s.customs.reference}</span> },
                    { label: 'Declaration number', value: s.customs.declarationNumber ?? 'Not recorded' },
                    ...(s.customs.queryDetails ? [{ label: 'Query', value: s.customs.queryDetails }] : []),
                    { label: 'Last updated', value: formatDateTime(s.customs.updatedAt) },
                  ]}
                />
              ) : (
                <p className="text-sm text-slate-600">No customs entry recorded.</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="History" description="Every change, with who made it." />
            <CardBody>
              {(s.history ?? []).length === 0 ? (
                <p className="text-sm text-slate-600">No changes recorded.</p>
              ) : (
                <ol className="flex flex-col gap-3 text-sm">
                  {[...(s.history ?? [])].reverse().map((h) => (
                    <li key={h.id} className="border-l-2 border-slate-200 pl-3">
                      <p className="text-slate-800">{h.summary}</p>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(h.at)} · {h.actor}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
          <PendingNotice title="Documents and invoicing come next">
            Documents, customs work and invoices for live shipments arrive in a later phase. Their demo pages still use demo data.
          </PendingNotice>
        </div>
      </div>
    </>
  );
}
