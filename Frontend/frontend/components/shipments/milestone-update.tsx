'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DateField, SelectField, TextField } from '@/components/ui/form';
import { useSessionStore } from '@/lib/data/session-store';
import { fromDateTimeInput, nowDateTimeInput, nowIso, toDateTimeInput } from '@/lib/dates';
import { applyMilestoneUpdate, validateMilestoneUpdate, type MilestoneField } from '@/lib/shipment-changes';
import type { MilestoneState, Shipment } from '@/lib/types';
import type { FieldErrors } from '@/lib/validation';

const FORM_ID = 'milestone-update';

const stateOptions: { value: MilestoneState; label: string }[] = [
  { value: 'done', label: 'Completed' },
  { value: 'current', label: 'In progress' },
  { value: 'pending', label: 'Not started' },
];

/** Form values for a milestone: completing the current one is the usual next step. */
function initialFor(s: Shipment, index: number) {
  const m = s.milestones[index];
  return {
    state: m.state === 'pending' ? 'current' : 'done',
    at: toDateTimeInput(m.at),
    location: m.location ?? '',
  };
}

export function MilestoneUpdateForm({ shipment }: { shipment: Shipment }) {
  const store = useSessionStore();
  const defaultIndex = Math.max(0, shipment.milestones.findIndex((m) => m.state === 'current'));
  const [index, setIndex] = useState(defaultIndex);
  const [values, setValues] = useState(() => initialFor(shipment, defaultIndex));
  const [errors, setErrors] = useState<FieldErrors<MilestoneField>>({});
  const [result, setResult] = useState<string | null>(null);

  function selectMilestone(next: number) {
    setIndex(next);
    setValues(initialFor(shipment, next));
    setErrors({});
    setResult(null);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setResult(null);
    const at = values.at ? fromDateTimeInput(values.at) : undefined;
    if (values.at && !at) {
      setErrors({ at: 'Enter a valid date and time.' });
      return;
    }
    const update = { state: values.state as MilestoneState, at, location: values.location.trim() };
    const found = validateMilestoneUpdate(shipment, index, update, nowIso());
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const label = shipment.milestones[index].label;
    store.updateShipment(shipment.reference, (s, ctx) => applyMilestoneUpdate(s, index, update, ctx));
    setResult(`"${label}" updated in this browser tab.`);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <SelectField
        id={`${FORM_ID}-milestone`}
        label="Milestone"
        required
        value={String(index)}
        onChange={(v) => selectMilestone(Number(v))}
        options={shipment.milestones.map((m, i) => ({ value: String(i), label: m.label }))}
      />
      <SelectField
        id={`${FORM_ID}-state`}
        label="State"
        required
        value={values.state}
        onChange={(v) => setValues({ ...values, state: v })}
        error={errors.state}
        options={stateOptions}
      />
      {values.state !== 'pending' && (
        <DateField
          id={`${FORM_ID}-at`}
          withTime
          required={values.state === 'done'}
          label={values.state === 'done' ? 'Actual date completed' : 'Date started'}
          value={values.at}
          onChange={(v) => setValues({ ...values, at: v })}
          onNow={() => setValues({ ...values, at: nowDateTimeInput() })}
          error={errors.at}
        />
      )}
      <TextField
        id={`${FORM_ID}-location`}
        label="Location"
        value={values.location}
        onChange={(v) => setValues({ ...values, location: v })}
        maxLength={120}
        error={errors.location}
      />
      <p className="text-xs text-slate-500">
        Milestones are a tracking log. Change the shipment status separately if it should move on too.
      </p>
      <div className="flex items-center justify-between gap-3">
        <p role="status" className="text-xs font-medium text-emerald-800">
          {result}
        </p>
        <Button type="submit" size="sm">
          Update milestone
        </Button>
      </div>
    </form>
  );
}
