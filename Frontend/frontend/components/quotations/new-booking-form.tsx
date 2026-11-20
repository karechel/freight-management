'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DateField, FormSection, SelectField, TextField } from '@/components/ui/form';
import { ApiError, backend } from '@/lib/api/browser';
import { fromDateTimeInput } from '@/lib/dates';
import { directionLabel, modeLabel } from '@/lib/labels';
import { bookingHref, creditWarningOf, type CreditWarning, type LiveBooking, type PartyRef } from '@/lib/live-quotations';
import { CreditWarningPanel, type CreditChoice } from './credit-warning-panel';

const FORM_ID = 'booking';
const toOptions = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));
const MONEY = /^\d{1,12}(\.\d{1,2})?$/;

type Field =
  | 'customerId'
  | 'agentId'
  | 'mode'
  | 'direction'
  | 'origin'
  | 'destination'
  | 'cargoSummary'
  | 'carrierId'
  | 'carrierBookingNumber'
  | 'plannedEtd'
  | 'plannedEta'
  | 'estimatedValue';

const empty: Record<Field, string> = {
  customerId: '',
  agentId: '',
  mode: '',
  direction: '',
  origin: '',
  destination: '',
  cargoSummary: '',
  carrierId: '',
  carrierBookingNumber: '',
  plannedEtd: '',
  plannedEta: '',
  estimatedValue: '',
};

/**
 * A booking agreed without a quotation (POST /api/bookings). The same checks as the backend; the
 * backend repeats them. Over the credit limit, the shared warning panel asks for a decision.
 */
export function NewBookingForm({ customers, agents, carriers }: { customers: PartyRef[]; agents: PartyRef[]; carriers: PartyRef[] }) {
  const router = useRouter();
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<CreditWarning>();
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const [stopped, setStopped] = useState(false);

  function bind(name: Field) {
    return {
      id: `${FORM_ID}-${name}`,
      value: values[name],
      error: errors[name],
      onChange: (value: string) => {
        setValues((current) => ({ ...current, [name]: value }));
        setErrors((current) => ({ ...current, [name]: undefined }));
      },
    };
  }

  /** The request body, or field errors. */
  function validate(): { body?: Record<string, unknown>; found: Partial<Record<Field, string>> } {
    const found: Partial<Record<Field, string>> = {};
    const v = Object.fromEntries(Object.entries(values).map(([k, x]) => [k, x.trim()])) as Record<Field, string>;
    if (!v.customerId) found.customerId = 'Select the customer.';
    if (!v.mode) found.mode = 'Select the transport mode.';
    if (!v.direction) found.direction = 'Select import, export or transit.';
    if (!v.origin) found.origin = 'Enter the origin.';
    if (!v.destination) found.destination = 'Enter the destination.';
    if (v.origin && v.destination && v.origin.toLowerCase() === v.destination.toLowerCase()) {
      found.destination = 'Destination must be different from the origin.';
    }
    if (!v.cargoSummary) found.cargoSummary = 'Summarise the cargo.';
    if (v.estimatedValue && !MONEY.test(v.estimatedValue)) {
      found.estimatedValue = 'Enter an amount with up to 2 decimal places, without commas.';
    }
    const etd = v.plannedEtd ? fromDateTimeInput(v.plannedEtd) : undefined;
    const eta = v.plannedEta ? fromDateTimeInput(v.plannedEta) : undefined;
    if (v.plannedEtd && !etd) found.plannedEtd = 'Enter a valid date and time.';
    if (v.plannedEta && !eta) found.plannedEta = 'Enter a valid date and time.';
    if (etd && eta && new Date(eta).getTime() < new Date(etd).getTime()) {
      found.plannedEta = 'The planned arrival cannot be before the planned departure.';
    }
    if (Object.keys(found).length > 0) return { found };
    return {
      found,
      body: {
        customerId: Number(v.customerId),
        ...(v.agentId ? { agentId: Number(v.agentId) } : {}),
        mode: v.mode,
        direction: v.direction,
        origin: v.origin,
        destination: v.destination,
        cargoSummary: v.cargoSummary,
        ...(v.carrierId ? { carrierId: Number(v.carrierId) } : {}),
        ...(v.carrierBookingNumber ? { carrierBookingNumber: v.carrierBookingNumber } : {}),
        ...(etd ? { plannedEtd: etd } : {}),
        ...(eta ? { plannedEta: eta } : {}),
        ...(v.estimatedValue ? { estimatedValue: v.estimatedValue } : {}),
      },
    };
  }

  async function submit(choice?: CreditChoice) {
    setFailure(undefined);
    const { body, found } = validate();
    setErrors(found);
    if (!body) {
      setWarning(undefined);
      return;
    }
    if (choice && !reason.trim()) {
      setReasonError('Give a reason for this decision.');
      return;
    }
    setReasonError(undefined);
    setBusy(true);
    try {
      const booking = await backend.post<LiveBooking>(
        'bookings',
        choice ? { ...body, creditDecision: { decision: choice, reason: reason.trim() } } : body,
      );
      router.push(bookingHref(booking.reference));
      router.refresh();
    } catch (error) {
      const credit = error instanceof ApiError ? creditWarningOf(error.details) : undefined;
      if (credit?.decision === 'blocked') {
        setStopped(true);
      } else if (credit) {
        setWarning(credit);
      } else {
        setWarning(undefined);
        if (error instanceof ApiError) setErrors(error.fieldErrors as Partial<Record<Field, string>>);
        setFailure(error instanceof ApiError ? error.message : 'The booking could not be created. Try again.');
      }
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  if (stopped) {
    return (
      <p role="status" className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        Not booked. Your decision to stop at the credit limit, and your reason, have been recorded.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {failure && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {failure}
        </p>
      )}
      <Card>
        <FormSection title="Customer and route" description="The reference is assigned when you save. New bookings start as pending.">
          <SelectField
            {...bind('customerId')}
            label="Customer"
            required
            placeholder="Select a customer"
            options={customers.map((c) => ({ value: String(c.id), label: c.name }))}
          />
          <SelectField {...bind('mode')} label="Transport mode" required placeholder="Select a mode" options={toOptions(modeLabel)} />
          <SelectField {...bind('direction')} label="Direction" required placeholder="Select a direction" options={toOptions(directionLabel)} />
          <TextField {...bind('origin')} label="Origin" required maxLength={120} />
          <TextField {...bind('destination')} label="Destination" required maxLength={120} />
          <SelectField
            {...bind('agentId')}
            label="Overseas / partner agent"
            placeholder="No agent"
            options={agents.map((a) => ({ value: String(a.id), label: a.name }))}
          />
          <TextField {...bind('cargoSummary')} label="Cargo summary" required maxLength={200} className="sm:col-span-2 lg:col-span-3" />
        </FormSection>
        <FormSection title="Carrier and dates" description="Optional. They cannot be changed after the booking is created.">
          <SelectField
            {...bind('carrierId')}
            label="Carrier"
            placeholder={carriers.length ? 'Not recorded' : 'No carriers recorded'}
            options={carriers.map((c) => ({ value: String(c.id), label: c.name }))}
          />
          <TextField {...bind('carrierBookingNumber')} label="Carrier booking number" maxLength={60} />
          <DateField {...bind('plannedEtd')} withTime label="Planned departure" hint="Nairobi time." />
          <DateField {...bind('plannedEta')} withTime label="Planned arrival" hint="Nairobi time." />
        </FormSection>
        <FormSection title="Credit check" description="Bookings for customers with a credit limit are checked against it.">
          <TextField
            {...bind('estimatedValue')}
            label="Estimated value (KES)"
            inputMode="decimal"
            maxLength={15}
            hint="Required when the customer has a credit limit. Used only for the credit check."
          />
        </FormSection>
      </Card>

      {warning ? (
        <CreditWarningPanel
          warning={warning}
          reason={reason}
          onReasonChange={setReason}
          reasonError={reasonError}
          busy={busy}
          onChoose={(choice) => void submit(choice)}
        />
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          <ButtonLink href="/bookings" variant="secondary">
            Cancel
          </ButtonLink>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Create booking'}
          </Button>
        </div>
      )}
    </form>
  );
}
