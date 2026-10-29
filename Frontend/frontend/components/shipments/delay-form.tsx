'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckboxField, DateField, ErrorSummary, FormSection, SelectField, TextAreaField } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { DataSourceNotice, PendingNotice, RecordNotFound, SESSION_EDIT_NOTE } from '@/components/ui/states';
import { useValidatedForm } from '@/components/ui/use-validated-form';
import { useSessionShipment, useSessionStore } from '@/lib/data/session-store';
import { fromDateTimeInput, nowDateTimeInput, nowIso } from '@/lib/dates';
import { delayFieldLabel, delayToForm, emptyDelayForm, validateDelayForm, type DelayFormValues } from '@/lib/delay-form';
import { formatDuration } from '@/lib/format';
import { customerNotificationMeta, delayReasonLabel, delayStatusMeta, severityMeta } from '@/lib/labels';
import { applyDelay } from '@/lib/shipment-changes';
import type { DataSource, Shipment, ShipmentDelay } from '@/lib/types';
import { shipmentHref } from './shipment-table';

const toOptions = (meta: Record<string, string | { label: string }>) =>
  Object.entries(meta).map(([value, m]) => ({ value, label: typeof m === 'string' ? m : m.label }));

/** Live duration from the two dates in the form, or an explanation of why it is unknown. */
function durationPreview(values: DelayFormValues): string {
  const original = fromDateTimeInput(values.originalExpectedAt);
  const revised = fromDateTimeInput(values.revisedExpectedAt);
  if (!original || !revised) return 'Calculated once both the original and revised dates are entered.';
  const ms = new Date(revised).getTime() - new Date(original).getTime();
  return ms > 0 ? `Delay duration: ${formatDuration(ms)}` : 'The revised date must be later than the original date.';
}

function DelayForm({ shipment, delay, staff }: { shipment: Shipment; delay?: ShipmentDelay; staff: string[] }) {
  const router = useRouter();
  const store = useSessionStore();
  const [unchanged, setUnchanged] = useState(false);
  const milestones = shipment.milestones.map((m) => m.label);
  const form = useValidatedForm(
    'delay',
    delay ? delayToForm(delay) : emptyDelayForm(shipment),
    (values: DelayFormValues) => validateDelayForm(values, { milestones, staff, now: nowIso() }),
    delayFieldLabel,
  );
  const { values, set, field } = form;
  const backHref = shipmentHref(shipment.reference);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setUnchanged(false);
    const input = form.submit();
    if (!input) return;
    const changed = store.updateShipment(shipment.reference, (s, ctx) => applyDelay(s, input, ctx, delay?.id));
    if (!changed) {
      setUnchanged(true);
      return;
    }
    store.showNotice(delay ? 'Delay updated.' : 'Delay recorded.', backHref);
    router.push(backHref);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <ErrorSummary id={form.summaryId} errors={form.summary} />
      {unchanged && (
        <p role="status" className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          No changes to save.
        </p>
      )}
      <Card>
        <FormSection title="What happened">
          <SelectField
            {...field('reason')}
            label={delayFieldLabel.reason}
            required
            value={values.reason}
            onChange={(v) => set('reason', v)}
            placeholder="Select a reason"
            options={toOptions(delayReasonLabel)}
          />
          <SelectField
            {...field('severity')}
            label={delayFieldLabel.severity}
            required
            value={values.severity}
            onChange={(v) => set('severity', v)}
            placeholder="Select severity"
            options={toOptions(severityMeta)}
          />
          <DateField
            {...field('identifiedAt')}
            withTime
            required
            label={delayFieldLabel.identifiedAt}
            value={values.identifiedAt}
            onChange={(v) => set('identifiedAt', v)}
            onNow={() => set('identifiedAt', nowDateTimeInput())}
          />
          <TextAreaField
            {...field('reasonDetail')}
            label={delayFieldLabel.reasonDetail}
            required
            value={values.reasonDetail}
            onChange={(v) => set('reasonDetail', v)}
            maxLength={500}
            hint="Who reported it and what is known. Do not guess causes that are not confirmed."
            className="sm:col-span-2 lg:col-span-3"
          />
        </FormSection>

        <FormSection
          title="Dates"
          description="The original date is prefilled from the current milestone's planned date or the shipment's current ETA; change it if the delay concerns a different date."
        >
          <SelectField
            {...field('milestone')}
            label={delayFieldLabel.milestone}
            required
            value={values.milestone}
            onChange={(v) => set('milestone', v)}
            placeholder="Select a milestone"
            options={milestones.map((m) => ({ value: m, label: m }))}
          />
          <DateField
            {...field('originalExpectedAt')}
            withTime
            required
            label={delayFieldLabel.originalExpectedAt}
            value={values.originalExpectedAt}
            onChange={(v) => set('originalExpectedAt', v)}
          />
          <DateField
            {...field('revisedExpectedAt')}
            withTime
            label={delayFieldLabel.revisedExpectedAt}
            value={values.revisedExpectedAt}
            onChange={(v) => set('revisedExpectedAt', v)}
            hint="Leave empty until a new date is confirmed."
          />
          <p className="text-sm font-medium text-slate-800 sm:col-span-2 lg:col-span-3" aria-live="polite">
            {durationPreview(values)}
          </p>
          <CheckboxField
            id="delay-affectsEta"
            label={delayFieldLabel.affectsEta}
            checked={values.affectsEta}
            onChange={(v) => set('affectsEta', v)}
            hint="The planned ETA is kept; lists and the dashboard show the revised date as the current ETA."
            className="sm:col-span-2 lg:col-span-3"
          />
        </FormSection>

        <FormSection title="Follow-up">
          <SelectField
            {...field('followUpBy')}
            label={delayFieldLabel.followUpBy}
            required
            value={values.followUpBy}
            onChange={(v) => set('followUpBy', v)}
            placeholder="Select a staff member"
            options={staff.map((s) => ({ value: s, label: s }))}
          />
          <SelectField
            {...field('status')}
            label={delayFieldLabel.status}
            required
            value={values.status}
            onChange={(v) => set('status', v)}
            options={toOptions(delayStatusMeta)}
          />
          {values.status === 'resolved' && (
            <DateField
              {...field('resolvedAt')}
              withTime
              required
              label={delayFieldLabel.resolvedAt}
              value={values.resolvedAt}
              onChange={(v) => set('resolvedAt', v)}
              onNow={() => set('resolvedAt', nowDateTimeInput())}
            />
          )}
          <TextAreaField
            {...field('nextAction')}
            label={delayFieldLabel.nextAction}
            required={values.status === 'open'}
            value={values.nextAction}
            onChange={(v) => set('nextAction', v)}
            rows={2}
            maxLength={300}
            className="sm:col-span-2 lg:col-span-3"
          />
          <TextAreaField
            {...field('notes')}
            label={delayFieldLabel.notes}
            value={values.notes}
            onChange={(v) => set('notes', v)}
            maxLength={1000}
            className="sm:col-span-2 lg:col-span-3"
          />
        </FormSection>

        <FormSection title="Customer notification" description="Record what was done outside the system. Saving does not contact the customer.">
          <SelectField
            {...field('customerNotification')}
            label={delayFieldLabel.customerNotification}
            required
            value={values.customerNotification}
            onChange={(v) => set('customerNotification', v)}
            options={toOptions(customerNotificationMeta)}
          />
          {values.customerNotification === 'informed_manually' && (
            <DateField
              {...field('customerNotifiedAt')}
              withTime
              required
              label={delayFieldLabel.customerNotifiedAt}
              value={values.customerNotifiedAt}
              onChange={(v) => set('customerNotifiedAt', v)}
              onNow={() => set('customerNotifiedAt', nowDateTimeInput())}
            />
          )}
        </FormSection>
      </Card>

      <PendingNotice title="No notifications are sent">
        There is no email, SMS or customer-portal integration. Saving updates this tab&apos;s demo records only; reloading
        the page discards the change.
      </PendingNotice>

      <div className="flex flex-wrap justify-end gap-2">
        <ButtonLink href={backHref} variant="secondary">
          Cancel
        </ButtonLink>
        <Button type="submit">{delay ? 'Save delay' : 'Record delay'}</Button>
      </div>
    </form>
  );
}

/** Page body for recording (no `delayId`) or editing a delay. */
export function DelayFormView({
  reference,
  delayId,
  staff,
  source,
}: {
  reference: string;
  delayId?: string;
  staff: string[];
  source: DataSource;
}) {
  const shipment = useSessionShipment(reference);
  if (!shipment) {
    return <RecordNotFound title={`Shipment ${reference} was not found`} backHref="/shipments" backLabel="All shipments" />;
  }
  const delay = delayId ? shipment.delays.find((d) => d.id === delayId) : undefined;
  if (delayId && !delay) {
    return <RecordNotFound title="Delay not found" backHref={shipmentHref(reference)} backLabel="Back to shipment" />;
  }
  return (
    <>
      <PageHeader
        title={delay ? 'Edit delay' : 'Record delay'}
        description={`${shipment.reference} · ${shipment.customerName}. Fields marked * are required.`}
        back={{ href: shipmentHref(shipment.reference), label: 'Back to shipment' }}
      />
      <DataSourceNotice source={source}>{SESSION_EDIT_NOTE}</DataSourceNotice>
      <DelayForm shipment={shipment} delay={delay} staff={staff} />
    </>
  );
}
