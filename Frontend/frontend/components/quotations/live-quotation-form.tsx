'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DateField, ErrorSummary, fieldId, FormSection, SelectField, TextAreaField, TextField } from '@/components/ui/form';
import { CloseIcon } from '@/components/ui/icons';
import { useValidatedForm } from '@/components/ui/use-validated-form';
import { ApiError, backend } from '@/lib/api/browser';
import { nowIso } from '@/lib/dates';
import { directionLabel, modeLabel } from '@/lib/labels';
import {
  formFieldOf,
  liveQuotationHref,
  liveQuotationToForm,
  quotationRequestBody,
  type LiveFormOptions,
  type LiveQuotation,
} from '@/lib/live-quotations';
import { formatMoney, lineAmounts, parseMoney } from '@/lib/money';
import {
  emptyLine,
  emptyQuotationForm,
  previewTotals,
  quotationErrorLabel,
  quotationFieldLabel,
  validateQuotationForm,
  type QuotationErrorKey,
  type QuotationFormValues,
  type QuotationLineValues,
} from '@/lib/quotation-form';

const FORM_ID = 'quotation';
const toOptions = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));

/** A preview only: the backend calculates the saved totals. */
function lineTotal(line: QuotationLineValues): string {
  const unit = parseMoney(line.unitPrice);
  const qty = /^\d+(\.\d{1,3})?$/.test(line.quantity.trim()) ? Number(line.quantity.trim()) : undefined;
  const rate = /^\d+(\.\d{1,2})?$/.test(line.taxRatePercent.trim()) ? Number(line.taxRatePercent.trim()) : undefined;
  if (unit === undefined || qty === undefined || rate === undefined || rate > 100) return '—';
  return formatMoney(lineAmounts(qty, unit, rate).grossMinor, 'KES');
}

/**
 * Creates (or duplicates) and edits live quotations. Validation is the same as the demo form
 * (`lib/quotation-form.ts`); the backend repeats every check and calculates the totals.
 */
export function LiveQuotationForm({
  options,
  quotation,
  duplicateOf,
}: {
  options: LiveFormOptions;
  /** Edit this quotation. */
  quotation?: LiveQuotation;
  /** Create a new draft copied from this quotation. */
  duplicateOf?: LiveQuotation;
}) {
  const router = useRouter();
  const customers = options.customers.map((c) => ({ id: String(c.id), name: c.name }));
  const agentNames = options.agents.map((a) => a.name);
  const initial: QuotationFormValues = quotation
    ? liveQuotationToForm(quotation)
    : duplicateOf
      ? liveQuotationToForm(duplicateOf, true)
      : { ...emptyQuotationForm(), terms: options.defaultTerms };
  const form = useValidatedForm<QuotationFormValues, QuotationErrorKey, ReturnType<typeof validateQuotationForm>['input']>(
    FORM_ID,
    initial,
    (values) => validateQuotationForm({ ...values, currency: 'KES' }, { customers, agents: agentNames, now: nowIso() }),
    quotationFieldLabel,
    quotationErrorLabel,
  );
  const { values, set, update } = form;
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);
  const totals = previewTotals(values);

  /** Field id and whichever error applies: the form's own, or the server's. */
  function field(name: QuotationErrorKey) {
    const own = form.field(name);
    return { id: own.id, error: own.error ?? serverErrors[name] };
  }
  function clearServer(name: string) {
    if (serverErrors[name]) {
      setServerErrors((current) => {
        const next = { ...current };
        delete next[name];
        return next;
      });
    }
  }

  const setLine = (index: number, patch: Partial<QuotationLineValues>) =>
    update((v) => ({ ...v, lines: v.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)) }));
  const removeLine = (index: number) => update((v) => ({ ...v, lines: v.lines.filter((_, i) => i !== index) }));
  const addLine = () => update((v) => ({ ...v, lines: [...v.lines, emptyLine()] }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFailure(undefined);
    setServerErrors({});
    const input = form.submit();
    if (!input) return;
    const body = quotationRequestBody(input, options.agents);
    setBusy(true);
    try {
      const saved = quotation
        ? await backend.patch<LiveQuotation>(`quotations/${encodeURIComponent(quotation.reference)}`, body)
        : await backend.post<LiveQuotation>('quotations', duplicateOf ? { ...body, duplicatedFrom: duplicateOf.reference } : body);
      router.push(liveQuotationHref(saved.reference));
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        setServerErrors(Object.fromEntries(Object.entries(error.fieldErrors).map(([f, m]) => [formFieldOf(f), m])));
        setFailure(error.message);
      } else {
        setFailure('The quotation could not be saved. Try again.');
      }
      setBusy(false);
    }
  }

  const cancelHref = quotation
    ? liveQuotationHref(quotation.reference)
    : duplicateOf
      ? liveQuotationHref(duplicateOf.reference)
      : '/quotations';

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <ErrorSummary id={form.summaryId} errors={form.summary} />
      {failure && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {failure}
        </p>
      )}

      <Card>
        <FormSection
          title="Customer and route"
          description={
            quotation
              ? `Reference ${quotation.reference} cannot be changed.`
              : 'The reference is assigned when you save, from the numbering format in Settings. New quotations start as drafts.'
          }
        >
          <SelectField
            {...field('customerId')}
            label={quotationFieldLabel.customerId}
            required
            value={values.customerId}
            onChange={(v) => {
              clearServer('customerId');
              set('customerId', v);
            }}
            placeholder="Select a customer"
            options={customers.map((c) => ({ value: c.id, label: c.name }))}
          />
          <SelectField
            {...field('mode')}
            label={quotationFieldLabel.mode}
            required
            value={values.mode}
            onChange={(v) => set('mode', v)}
            placeholder="Select a mode"
            options={toOptions(modeLabel)}
          />
          <SelectField
            {...field('direction')}
            label={quotationFieldLabel.direction}
            required
            value={values.direction}
            onChange={(v) => set('direction', v)}
            placeholder="Select a direction"
            options={toOptions(directionLabel)}
          />
          <TextField {...field('origin')} label={quotationFieldLabel.origin} required value={values.origin} onChange={(v) => set('origin', v)} maxLength={120} />
          <TextField
            {...field('destination')}
            label={quotationFieldLabel.destination}
            required
            value={values.destination}
            onChange={(v) => {
              clearServer('destination');
              set('destination', v);
            }}
            maxLength={120}
          />
          <SelectField
            {...field('agentName')}
            label={quotationFieldLabel.agentName}
            value={values.agentName}
            onChange={(v) => set('agentName', v)}
            placeholder="No agent"
            options={agentNames.map((a) => ({ value: a, label: a }))}
          />
          <TextField
            {...field('cargoSummary')}
            label={quotationFieldLabel.cargoSummary}
            required
            value={values.cargoSummary}
            onChange={(v) => set('cargoSummary', v)}
            placeholder="e.g. 2 × 20ft GP, steel products"
            maxLength={200}
            className="sm:col-span-2 lg:col-span-3"
          />
        </FormSection>

        <FormSection title="Validity" description="Amounts are in Kenyan shillings (KES), the only currency the system records.">
          <DateField
            {...field('issuedAt')}
            label={quotationFieldLabel.issuedAt}
            required
            value={values.issuedAt}
            onChange={(v) => {
              clearServer('issuedAt');
              set('issuedAt', v);
            }}
          />
          <DateField
            {...field('validUntil')}
            label={quotationFieldLabel.validUntil}
            required
            value={values.validUntil}
            onChange={(v) => {
              clearServer('validUntil');
              set('validUntil', v);
            }}
            hint="Valid to the end of this day (Nairobi time)."
          />
        </FormSection>

        <section aria-labelledby={fieldId(FORM_ID, 'lines')} className="min-w-0 border-t border-slate-200 px-4 py-5 sm:px-5">
          {/* Focus target for the "lines" error in the summary. */}
          <h2
            id={fieldId(FORM_ID, 'lines')}
            tabIndex={-1}
            className="rounded text-sm font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            Line items
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Freight, handling, clearing and other charges. Enter each tax or levy rate yourself; the system does not decide
            tax treatment. Line amounts are rounded to the nearest cent. The totals shown are a preview: the saved totals are
            calculated by the server.
          </p>
          {(form.errors.lines ?? serverErrors.lines) && (
            <p className="mt-2 text-xs font-medium text-red-700" role="alert">
              {form.errors.lines ?? serverErrors.lines}
            </p>
          )}
          <ol className="mt-4 flex flex-col gap-3">
            {values.lines.map((line, i) => (
              <li key={line.key} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600">Line {i + 1}</p>
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    disabled={values.lines.length === 1}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <CloseIcon className="size-3.5" />
                    Remove<span className="sr-only"> line {i + 1}</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_6rem_9rem_6rem_9rem]">
                  <TextField
                    {...field(`lines.${i}.description`)}
                    label="Description"
                    required
                    value={line.description}
                    onChange={(v) => setLine(i, { description: v })}
                    maxLength={200}
                    className="col-span-2 sm:col-span-1"
                  />
                  <TextField {...field(`lines.${i}.quantity`)} label="Qty" required inputMode="decimal" value={line.quantity} onChange={(v) => setLine(i, { quantity: v })} />
                  <TextField
                    {...field(`lines.${i}.unitPrice`)}
                    label="Unit price (KES)"
                    required
                    inputMode="decimal"
                    value={line.unitPrice}
                    onChange={(v) => setLine(i, { unitPrice: v })}
                  />
                  <TextField
                    {...field(`lines.${i}.taxRatePercent`)}
                    label="Tax %"
                    required
                    inputMode="decimal"
                    value={line.taxRatePercent}
                    onChange={(v) => setLine(i, { taxRatePercent: v })}
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-slate-800">Line total</span>
                    <span className="flex h-9 items-center justify-end rounded-lg bg-slate-50 px-3 text-sm font-medium text-slate-900 tabular-nums" aria-live="polite">
                      {lineTotal(line)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <Button variant="secondary" size="sm" onClick={addLine} disabled={values.lines.length >= 50}>
              Add line
            </Button>
            <dl className="grid w-full max-w-xs grid-cols-2 gap-x-4 gap-y-1 text-sm sm:ml-auto" aria-live="polite">
              <dt className="text-slate-600">Subtotal</dt>
              <dd className="text-right tabular-nums">{formatMoney(totals.subtotalMinor, 'KES')}</dd>
              <dt className="text-slate-600">Tax</dt>
              <dd className="text-right tabular-nums">{formatMoney(totals.taxMinor, 'KES')}</dd>
              <dt className="border-t border-slate-200 pt-1 font-semibold text-slate-900">Total</dt>
              <dd className="border-t border-slate-200 pt-1 text-right font-semibold text-slate-900 tabular-nums">
                {formatMoney(totals.totalMinor, 'KES')}
              </dd>
            </dl>
          </div>
        </section>

        <FormSection title="Terms and notes">
          <TextAreaField
            {...field('terms')}
            label={quotationFieldLabel.terms}
            value={values.terms}
            onChange={(v) => set('terms', v)}
            rows={4}
            maxLength={2000}
            hint="Printed on the quotation. The prefilled text is a placeholder, not reviewed legal terms."
            className="sm:col-span-2 lg:col-span-3"
          />
          <TextAreaField
            {...field('internalNote')}
            label={quotationFieldLabel.internalNote}
            value={values.internalNote}
            onChange={(v) => set('internalNote', v)}
            rows={2}
            maxLength={1000}
            hint="Not printed."
            className="sm:col-span-2 lg:col-span-3"
          />
        </FormSection>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <ButtonLink href={cancelHref} variant="secondary">
          Cancel
        </ButtonLink>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : quotation ? 'Save changes' : 'Create draft'}
        </Button>
      </div>
    </form>
  );
}
