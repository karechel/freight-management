'use client';

// Quick status change from the shipment page. Uses the same validation as the
// full edit form, so status / actual-date rules cannot drift apart.

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DateField, SelectField, TextAreaField } from '@/components/ui/form';
import type { ShipmentFormOptions } from '@/lib/data';
import { useSessionStore } from '@/lib/data/session-store';
import { nowDateTimeInput, nowIso } from '@/lib/dates';
import { shipmentStatusMeta, shipmentStatusOrder } from '@/lib/labels';
import { applyShipmentUpdate } from '@/lib/shipment-changes';
import { shipmentFieldLabel, shipmentToForm, validateShipmentForm, type ShipmentField } from '@/lib/shipment-form';
import type { Shipment, ShipmentStatus } from '@/lib/types';
import type { FieldErrors } from '@/lib/validation';

const FORM_ID = 'status-change';

export function StatusChangePanel({ shipment, options }: { shipment: Shipment; options: ShipmentFormOptions }) {
  const store = useSessionStore();
  const [status, setStatus] = useState<ShipmentStatus>(shipment.status);
  const [ata, setAta] = useState('');
  const [deliveredAt, setDeliveredAt] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<FieldErrors<ShipmentField | 'note'>>({});
  const [result, setResult] = useState<string | null>(null);

  // Ask for the actual date that the new status requires, when it is not recorded yet.
  const needsAta = status === 'arrived' && !shipment.ata;
  const needsDelivery = status === 'delivered' && !shipment.deliveredAt;

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setResult(null);
    if (status === shipment.status) {
      setErrors({ status: 'Choose a status different from the current one.' });
      return;
    }
    if (note.trim().length > 300) {
      setErrors({ note: 'Use 300 characters or fewer.' });
      return;
    }
    const values = {
      ...shipmentToForm(shipment),
      status,
      ...(needsAta ? { ata } : {}),
      ...(needsDelivery ? { deliveredAt } : {}),
    };
    const validation = validateShipmentForm(values, { ...options, now: nowIso() });
    if (!validation.input) {
      setErrors(validation.errors);
      return;
    }
    const input = validation.input;
    store.updateShipment(shipment.reference, (s, ctx) => applyShipmentUpdate(s, input, ctx, note.trim() || undefined));
    setErrors({});
    setNote('');
    setAta('');
    setDeliveredAt('');
    setResult(`Status changed to "${shipmentStatusMeta[status].label}" in this browser tab.`);
  }

  // Errors on fields this panel does not show (e.g. an existing record that no longer validates).
  const otherErrors = (Object.keys(errors) as (ShipmentField | 'note')[]).filter(
    (k) => !['status', 'note', ...(needsAta ? ['ata'] : []), ...(needsDelivery ? ['deliveredAt'] : [])].includes(k),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <SelectField
        id={`${FORM_ID}-status`}
        label="New status"
        required
        value={status}
        onChange={(v) => {
          setStatus(v as ShipmentStatus);
          setErrors({});
          setResult(null);
        }}
        error={errors.status}
        options={shipmentStatusOrder.map((s) => ({
          value: s,
          label: s === shipment.status ? `${shipmentStatusMeta[s].label} (current)` : shipmentStatusMeta[s].label,
        }))}
      />
      {needsAta && (
        <DateField
          id={`${FORM_ID}-ata`}
          withTime
          required
          label={shipmentFieldLabel.ata}
          value={ata}
          onChange={setAta}
          onNow={() => setAta(nowDateTimeInput())}
          error={errors.ata}
        />
      )}
      {needsDelivery && (
        <DateField
          id={`${FORM_ID}-deliveredAt`}
          withTime
          required
          label={shipmentFieldLabel.deliveredAt}
          value={deliveredAt}
          onChange={setDeliveredAt}
          onNow={() => setDeliveredAt(nowDateTimeInput())}
          error={errors.deliveredAt}
        />
      )}
      <TextAreaField
        id={`${FORM_ID}-note`}
        label="Note for the history"
        value={note}
        onChange={setNote}
        rows={2}
        maxLength={300}
        error={errors.note}
      />
      {otherErrors.length > 0 && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900">
          <p className="font-medium">Fix these in the full edit form first:</p>
          <ul className="mt-1 list-disc pl-5">
            {otherErrors.map((k) => (
              <li key={k}>
                {k === 'note' ? 'Note' : shipmentFieldLabel[k]}: {errors[k]}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <p role="status" className="text-xs font-medium text-emerald-800">
          {result}
        </p>
        <Button type="submit" size="sm">
          Change status
        </Button>
      </div>
    </form>
  );
}
