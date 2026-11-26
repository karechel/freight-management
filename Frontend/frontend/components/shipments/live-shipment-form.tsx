'use client';

// Create (from a confirmed booking, or standalone such as clearing only) and edit a live shipment.
// The API checks everything again; its field errors are shown next to the fields.

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { DateField, FormSection, SelectField, TextAreaField, TextField } from '@/components/ui/form';
import { ApiError, backend } from '@/lib/api/browser';
import { fromDateInput, fromDateTimeInput, nowDateTimeInput, toDateInput, toDateTimeInput } from '@/lib/dates';
import { directionLabel, modeLabel } from '@/lib/labels';
import type { LiveBooking, PartyRef } from '@/lib/live-quotations';
import { liveShipmentHref, trimQuantity, type LiveShipment, type PersonRef } from '@/lib/live-shipments';

export interface ShipmentFormChoices {
  customers: PartyRef[];
  carriers: PartyRef[];
  agents: PartyRef[];
  staff: PersonRef[];
}

const idOptions = (items: { id: number; name: string }[]) => items.map((i) => ({ value: String(i.id), label: i.name }));
const labelOptions = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));

function Fixed({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="flex h-9 items-center rounded-lg bg-slate-50 px-3 text-sm text-slate-900">{value}</p>
    </div>
  );
}

export function LiveShipmentForm({
  shipment,
  booking,
  choices,
}: {
  /** Editing an existing shipment. */
  shipment?: LiveShipment;
  /** Creating from this confirmed booking. */
  booking?: LiveBooking;
  choices: ShipmentFormChoices;
}) {
  const router = useRouter();
  const source = shipment ?? booking;
  const fixed = Boolean(shipment || booking);
  const [v, setV] = useState({
    customerId: String(shipment?.customer.id ?? booking?.customer.id ?? ''),
    mode: shipment?.mode ?? booking?.mode ?? '',
    direction: shipment?.direction ?? booking?.direction ?? '',
    origin: source?.origin ?? '',
    destination: source?.destination ?? '',
    cargoDescription: shipment?.cargoDescription ?? booking?.cargoSummary ?? '',
    carrierId: String(shipment?.carrier?.id ?? booking?.carrier?.id ?? ''),
    agentId: String(shipment?.agent?.id ?? booking?.agent?.id ?? ''),
    assignedToId: String(shipment?.assignedTo?.id ?? ''),
    transportDocRef: shipment?.transportDocRef ?? '',
    vesselOrFlight: shipment?.vesselOrFlight ?? '',
    voyageNumber: shipment?.voyageNumber ?? '',
    equipment: shipment?.equipment ?? '',
    packages: shipment?.packages != null ? String(shipment.packages) : '',
    grossWeightKg: trimQuantity(shipment?.grossWeightKg ?? null),
    volumeCbm: trimQuantity(shipment?.volumeCbm ?? null),
    etd: toDateInput(shipment?.etd ?? booking?.plannedEtd ?? undefined),
    eta: toDateInput(shipment?.eta ?? booking?.plannedEta ?? undefined),
    estimatedDeliveryAt: toDateInput(shipment?.estimatedDeliveryAt ?? undefined),
    atd: toDateTimeInput(shipment?.atd ?? undefined),
    ata: toDateTimeInput(shipment?.ata ?? undefined),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);
  const set = (field: keyof typeof v) => (value: string) => setV((current) => ({ ...current, [field]: value }));

  const text = (value: string) => value.trim() || null;
  const id = (value: string) => (value ? Number(value) : null);
  const day = (value: string) => (value ? (fromDateInput(value) ?? value) : null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const local: Record<string, string> = {};
    if (v.packages && !/^\d+$/.test(v.packages)) local.packages = 'Enter a whole number, without commas.';
    for (const field of ['grossWeightKg', 'volumeCbm'] as const) {
      if (v[field] && !/^\d{1,9}(\.\d{1,3})?$/.test(v[field])) local[field] = 'Enter a number with up to 3 decimal places, without commas.';
    }
    if (!v.eta) local.eta = 'Enter the estimated arrival date.';
    if (Object.keys(local).length) {
      setErrors(local);
      setFailure('Check the highlighted fields.');
      return;
    }
    const details = {
      carrierId: id(v.carrierId),
      agentId: id(v.agentId),
      assignedToId: id(v.assignedToId),
      transportDocRef: text(v.transportDocRef),
      vesselOrFlight: text(v.vesselOrFlight),
      voyageNumber: text(v.voyageNumber),
      equipment: text(v.equipment),
      packages: v.packages ? Number(v.packages) : null,
      grossWeightKg: text(v.grossWeightKg),
      volumeCbm: text(v.volumeCbm),
      etd: day(v.etd),
      eta: day(v.eta),
      estimatedDeliveryAt: day(v.estimatedDeliveryAt),
      origin: v.origin.trim(),
      destination: v.destination.trim(),
      cargoDescription: v.cargoDescription.trim(),
    };
    setBusy(true);
    setErrors({});
    setFailure(undefined);
    try {
      let reference: string;
      if (shipment) {
        const actual = (value: string) => (value ? (fromDateTimeInput(value) ?? value) : null);
        await backend.patch(`shipments/${encodeURIComponent(shipment.reference)}`, {
          ...details,
          atd: actual(v.atd),
          ata: actual(v.ata),
        });
        reference = shipment.reference;
      } else {
        const created = await backend.post<LiveShipment>('shipments', {
          ...details,
          ...(booking
            ? { bookingReference: booking.reference }
            : { customerId: id(v.customerId) ?? undefined, mode: v.mode || undefined, direction: v.direction || undefined }),
          origin: details.origin || undefined,
          destination: details.destination || undefined,
          cargoDescription: details.cargoDescription || undefined,
        });
        reference = created.reference;
      }
      router.push(liveShipmentHref(reference));
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        setFailure(error.message);
      } else {
        setFailure('The shipment could not be saved. Try again.');
      }
      setBusy(false);
    }
  }

  const cancelHref = shipment ? liveShipmentHref(shipment.reference) : booking ? `/bookings/${encodeURIComponent(booking.reference)}` : '/shipments';
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      {failure && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {failure}
        </p>
      )}
      <Card>
        <CardBody className="flex flex-col gap-6">
          <FormSection title="Job" description={fixed ? 'Customer, mode and direction come from the booking and cannot change.' : 'A shipment without a booking, for example clearing only.'}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {fixed ? (
                <>
                  <Fixed label="Customer" value={(shipment?.customer ?? booking?.customer)!.name} />
                  <Fixed label="Transport mode" value={modeLabel[(shipment?.mode ?? booking?.mode)!]} />
                  <Fixed label="Direction" value={directionLabel[(shipment?.direction ?? booking?.direction)!]} />
                </>
              ) : (
                <>
                  <SelectField id="shipment-customer" label="Customer" required value={v.customerId} onChange={set('customerId')} placeholder="Select the customer" options={idOptions(choices.customers)} error={errors.customerId} />
                  <SelectField id="shipment-mode" label="Transport mode" required value={v.mode} onChange={set('mode')} placeholder="Select the mode" options={labelOptions(modeLabel)} error={errors.mode} />
                  <SelectField id="shipment-direction" label="Direction" required value={v.direction} onChange={set('direction')} placeholder="Select the direction" options={labelOptions(directionLabel)} error={errors.direction} />
                </>
              )}
              <TextField id="shipment-origin" label="Origin" required value={v.origin} onChange={set('origin')} maxLength={120} error={errors.origin} />
              <TextField id="shipment-destination" label="Destination" required value={v.destination} onChange={set('destination')} maxLength={120} error={errors.destination} />
              <SelectField id="shipment-assigned" label="Assigned to" value={v.assignedToId} onChange={set('assignedToId')} placeholder="Unassigned" options={idOptions(choices.staff)} error={errors.assignedToId} />
            </div>
          </FormSection>
          <FormSection title="Cargo and transport">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <TextAreaField id="shipment-cargo" label="Cargo description" required value={v.cargoDescription} onChange={set('cargoDescription')} rows={2} maxLength={200} className="sm:col-span-3" error={errors.cargoDescription} />
              <TextField id="shipment-equipment" label="Equipment" value={v.equipment} onChange={set('equipment')} maxLength={120} placeholder="e.g. 2 × 40ft HC" error={errors.equipment} />
              <TextField id="shipment-packages" label="Packages" inputMode="numeric" value={v.packages} onChange={set('packages')} error={errors.packages} />
              <TextField id="shipment-weight" label="Gross weight (kg)" inputMode="decimal" value={v.grossWeightKg} onChange={set('grossWeightKg')} error={errors.grossWeightKg} />
              <TextField id="shipment-volume" label="Volume (m³)" inputMode="decimal" value={v.volumeCbm} onChange={set('volumeCbm')} error={errors.volumeCbm} />
              <SelectField id="shipment-carrier" label="Carrier" value={v.carrierId} onChange={set('carrierId')} placeholder="Not recorded" options={idOptions(choices.carriers)} error={errors.carrierId} />
              <SelectField id="shipment-agent" label="Overseas / partner agent" value={v.agentId} onChange={set('agentId')} placeholder="None" options={idOptions(choices.agents)} error={errors.agentId} />
              <TextField id="shipment-docref" label="B/L, AWB or consignment number" value={v.transportDocRef} onChange={set('transportDocRef')} maxLength={60} error={errors.transportDocRef} />
              <TextField id="shipment-vessel" label="Vessel or flight" value={v.vesselOrFlight} onChange={set('vesselOrFlight')} maxLength={120} error={errors.vesselOrFlight} />
              <TextField id="shipment-voyage" label="Voyage number" value={v.voyageNumber} onChange={set('voyageNumber')} maxLength={60} error={errors.voyageNumber} />
            </div>
          </FormSection>
          <FormSection title="Dates" description="Estimated dates are planning dates; the ETA is required. Times are Nairobi time.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <DateField id="shipment-etd" label="Estimated departure (ETD)" value={v.etd} onChange={set('etd')} error={errors.etd} />
              <DateField id="shipment-eta" label="Estimated arrival (ETA)" required value={v.eta} onChange={set('eta')} error={errors.eta} />
              <DateField id="shipment-delivery" label="Estimated delivery" value={v.estimatedDeliveryAt} onChange={set('estimatedDeliveryAt')} error={errors.estimatedDeliveryAt} />
              {shipment && (
                <>
                  <DateField id="shipment-atd" label="Actual departure" withTime value={v.atd} onChange={set('atd')} onNow={() => set('atd')(nowDateTimeInput())} hint="Corrections only; use the status change for progress." error={errors.atd} />
                  <DateField id="shipment-ata" label="Actual arrival" withTime value={v.ata} onChange={set('ata')} onNow={() => set('ata')(nowDateTimeInput())} error={errors.ata} />
                </>
              )}
            </div>
          </FormSection>
        </CardBody>
      </Card>
      <div className="flex flex-wrap justify-end gap-2">
        <ButtonLink href={cancelHref} variant="secondary">
          Cancel
        </ButtonLink>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : shipment ? 'Save changes' : 'Create shipment'}
        </Button>
      </div>
    </form>
  );
}
