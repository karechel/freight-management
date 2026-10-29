'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DateField, ErrorSummary, FormSection, SelectField, TextField } from '@/components/ui/form';
import { PendingNotice } from '@/components/ui/states';
import { useValidatedForm } from '@/components/ui/use-validated-form';
import type { ShipmentFormOptions } from '@/lib/data';
import { useSessionStore } from '@/lib/data/session-store';
import { nowDateTimeInput, nowIso } from '@/lib/dates';
import { directionLabel, modeLabel, shipmentStatusMeta, shipmentStatusOrder } from '@/lib/labels';
import { linkQuotationToShipment } from '@/lib/quotation-changes';
import { applyShipmentUpdate } from '@/lib/shipment-changes';
import {
  emptyShipmentForm,
  quotationToShipmentForm,
  shipmentFieldLabel,
  shipmentToForm,
  validateShipmentForm,
  type ShipmentFormValues,
} from '@/lib/shipment-form';
import type { Quotation, Shipment } from '@/lib/types';
import { shipmentHref } from './shipment-table';

const toOptions = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));

interface ShipmentFormProps {
  shipment?: Shipment;
  options: ShipmentFormOptions;
  /** Accepted quotation to convert: prefills the form and is marked booked on save. */
  fromQuotation?: Quotation;
}

export function ShipmentForm({ shipment, options, fromQuotation }: ShipmentFormProps) {
  const router = useRouter();
  const store = useSessionStore();
  const [unchanged, setUnchanged] = useState(false);
  const form = useValidatedForm(
    'shipment',
    shipment ? shipmentToForm(shipment) : fromQuotation ? quotationToShipmentForm(fromQuotation) : emptyShipmentForm,
    (values: ShipmentFormValues) => validateShipmentForm(values, { ...options, now: nowIso() }),
    shipmentFieldLabel,
  );
  const { values, set, field } = form;

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setUnchanged(false);
    const input = form.submit();
    if (!input) return;
    if (!shipment) {
      const created = store.createShipment(input);
      const href = shipmentHref(created.reference);
      if (fromQuotation) {
        store.updateQuotation(fromQuotation.reference, (q, ctx) => linkQuotationToShipment(q, created.reference, ctx, true));
      }
      store.showNotice(
        fromQuotation
          ? `Shipment ${created.reference} created from quotation ${fromQuotation.reference}, which is now marked booked.`
          : `Shipment ${created.reference} created.`,
        href,
      );
      router.push(href);
      return;
    }
    const changed = store.updateShipment(shipment.reference, (s, ctx) => applyShipmentUpdate(s, input, ctx));
    if (!changed) {
      setUnchanged(true);
      return;
    }
    const href = shipmentHref(shipment.reference);
    store.showNotice(`Shipment ${shipment.reference} updated.`, href);
    router.push(href);
  }

  const cancelHref = shipment ? shipmentHref(shipment.reference) : '/shipments';
  const now = (name: 'atd' | 'ata' | 'deliveredAt') => () => set(name, nowDateTimeInput());

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <ErrorSummary id={form.summaryId} errors={form.summary} />
      {unchanged && (
        <p role="status" className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          No changes to save.
        </p>
      )}

      <Card>
        <FormSection
          title="Job"
          description={
            shipment
              ? `Reference ${shipment.reference} cannot be changed.`
              : 'The reference is assigned when you save, in the existing FMS-<MODE>-<YYMM>-<NUMBER> format.'
          }
        >
          <SelectField
            {...field('customerId')}
            label={shipmentFieldLabel.customerId}
            required
            value={values.customerId}
            onChange={(v) => set('customerId', v)}
            placeholder="Select a customer"
            options={options.customers.map((c) => ({ value: c.id, label: c.name }))}
          />
          <SelectField
            {...field('direction')}
            label={shipmentFieldLabel.direction}
            required
            value={values.direction}
            onChange={(v) => set('direction', v)}
            placeholder="Select a direction"
            options={toOptions(directionLabel)}
          />
          <SelectField
            {...field('mode')}
            label={shipmentFieldLabel.mode}
            required
            value={values.mode}
            onChange={(v) => set('mode', v)}
            placeholder="Select a mode"
            options={toOptions(modeLabel)}
            hint={shipment && values.mode !== shipment.mode ? 'The reference keeps its original mode code.' : undefined}
          />
          <SelectField
            {...field('status')}
            label={shipmentFieldLabel.status}
            required
            value={values.status}
            onChange={(v) => set('status', v)}
            options={shipmentStatusOrder.map((s) => ({ value: s, label: shipmentStatusMeta[s].label }))}
          />
          <SelectField
            {...field('assignedTo')}
            label={shipmentFieldLabel.assignedTo}
            required
            value={values.assignedTo}
            onChange={(v) => set('assignedTo', v)}
            placeholder="Select a staff member"
            options={options.staff.map((s) => ({ value: s, label: s }))}
          />
          <SelectField
            {...field('agentName')}
            label={shipmentFieldLabel.agentName}
            value={values.agentName}
            onChange={(v) => form.update((current) => ({ ...current, agentName: v, agentRouteId: '' }))}
            placeholder="No agent"
            options={options.agents.map((a) => ({ value: a, label: a }))}
          />
          <SelectField
            {...field('agentRouteId')}
            label={shipmentFieldLabel.agentRouteId}
            value={values.agentRouteId}
            onChange={(v) => set('agentRouteId', v)}
            placeholder={values.agentName ? 'No route selected' : 'Select an agent first'}
            options={(options.agentRoutes[values.agentName] ?? []).map((r) => ({ value: r.id, label: r.label }))}
            hint="Lanes this agent handles in the demo data. Not an agreement or rate card."
          />
        </FormSection>

        <FormSection title="Route and carrier">
          <TextField
            {...field('origin')}
            label={shipmentFieldLabel.origin}
            required
            value={values.origin}
            onChange={(v) => set('origin', v)}
            placeholder="e.g. Shanghai, CN"
            maxLength={120}
          />
          <TextField
            {...field('destination')}
            label={shipmentFieldLabel.destination}
            required
            value={values.destination}
            onChange={(v) => set('destination', v)}
            placeholder="e.g. Nairobi ICD"
            maxLength={120}
          />
          <TextField
            {...field('carrier')}
            label={shipmentFieldLabel.carrier}
            required
            value={values.carrier}
            onChange={(v) => set('carrier', v)}
            list="carrier-suggestions"
            maxLength={120}
          />
          <TextField
            {...field('transportDocRef')}
            label={shipmentFieldLabel.transportDocRef}
            value={values.transportDocRef}
            onChange={(v) => set('transportDocRef', v)}
            hint='Leave empty if not issued yet; it is shown as "Pending".'
            maxLength={60}
          />
          <datalist id="carrier-suggestions">
            {options.carriers.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </FormSection>

        <FormSection title="Cargo">
          <TextField
            {...field('cargoDescription')}
            label={shipmentFieldLabel.cargoDescription}
            required
            value={values.cargoDescription}
            onChange={(v) => set('cargoDescription', v)}
            maxLength={200}
            className="sm:col-span-2"
          />
          <TextField
            {...field('equipment')}
            label={shipmentFieldLabel.equipment}
            required
            value={values.equipment}
            onChange={(v) => set('equipment', v)}
            placeholder="e.g. 1 × 40ft HC, 3 pallets"
            maxLength={120}
          />
          <TextField
            {...field('packages')}
            label={shipmentFieldLabel.packages}
            required
            inputMode="numeric"
            value={values.packages}
            onChange={(v) => set('packages', v)}
          />
          <TextField
            {...field('weightKg')}
            label={shipmentFieldLabel.weightKg}
            required
            inputMode="decimal"
            value={values.weightKg}
            onChange={(v) => set('weightKg', v)}
          />
        </FormSection>

        <FormSection title="Estimated dates" description="Planned dates. A delay record can later set a revised ETA without overwriting the planned one.">
          <DateField {...field('etd')} label={shipmentFieldLabel.etd} value={values.etd} onChange={(v) => set('etd', v)} />
          <DateField {...field('eta')} label={shipmentFieldLabel.eta} required value={values.eta} onChange={(v) => set('eta', v)} />
          <DateField
            {...field('estimatedDeliveryAt')}
            label={shipmentFieldLabel.estimatedDeliveryAt}
            value={values.estimatedDeliveryAt}
            onChange={(v) => set('estimatedDeliveryAt', v)}
          />
        </FormSection>

        <FormSection
          title="Actual dates"
          description="Record only what has happened, in Nairobi time. Actual dates cannot be in the future. Matching milestones are completed automatically."
        >
          <DateField {...field('atd')} withTime label={shipmentFieldLabel.atd} value={values.atd} onChange={(v) => set('atd', v)} onNow={now('atd')} />
          <DateField {...field('ata')} withTime label={shipmentFieldLabel.ata} value={values.ata} onChange={(v) => set('ata', v)} onNow={now('ata')} />
          <DateField
            {...field('deliveredAt')}
            withTime
            label={shipmentFieldLabel.deliveredAt}
            value={values.deliveredAt}
            onChange={(v) => set('deliveredAt', v)}
            onNow={now('deliveredAt')}
            hint="Required when the status is Delivered."
          />
        </FormSection>
      </Card>

      <PendingNotice title="Saved in this browser tab only">
        There is no shipment API yet. Saving updates this tab&apos;s demo records so the list, detail page and dashboard
        stay consistent; reloading the page discards the change.
      </PendingNotice>

      <div className="flex flex-wrap justify-end gap-2">
        <ButtonLink href={cancelHref} variant="secondary">
          Cancel
        </ButtonLink>
        <Button type="submit">{shipment ? 'Save changes' : 'Create shipment'}</Button>
      </div>
    </form>
  );
}
