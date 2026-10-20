'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DateField, ErrorSummary, fieldId, FormSection, SelectField, TextAreaField, TextField } from '@/components/ui/form';
import { CloseIcon } from '@/components/ui/icons';
import { PendingNotice } from '@/components/ui/states';
import { useValidatedForm } from '@/components/ui/use-validated-form';
import { useSessionStore } from '@/lib/data/session-store';
import { nowIso } from '@/lib/dates';
import { currencyLabel, directionLabel, modeLabel } from '@/lib/labels';
import { formatMoney, lineAmounts, parseMoney } from '@/lib/money';
import { applyQuotationUpdate } from '@/lib/quotation-changes';
import {
  duplicateQuotationForm,
  emptyLine,
  emptyQuotationForm,
  previewTotals,
  quotationErrorLabel,
  quotationFieldLabel,
  quotationToForm,
  validateQuotationForm,
  type QuotationErrorKey,
  type QuotationFormValues,
  type QuotationLineValues,
} from '@/lib/quotation-form';
import type { Currency, Quotation } from '@/lib/types';
import { quotationHref } from './quotation-list';

export interface QuotationFormOptions {
  customers: { id: string; name: string }[];
  agents: string[];
  /** Prefilled terms text for new quotations (editable). */
  defaultTerms: string;
}

const FORM_ID = 'quotation';
const toOptions = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));

function lineTotal(line: QuotationLineValues, currency: Currency): string {
  const unit = parseMoney(line.unitPrice);
  const qty = /^\d+(\.\d{1,3})?$/.test(line.quantity.trim()) ? Number(line.quantity.trim()) : undefined;
  const rate = /^\d+(\.\d{1,2})?$/.test(line.taxRatePercent.trim()) ? Number(line.taxRatePercent.trim()) : undefined;
  if (unit === undefined || qty === undefined || rate === undefined || rate > 100) return '—';
  return formatMoney(lineAmounts(qty, unit, rate).grossMinor, currency);
}

interface QuotationFormProps {
  options: QuotationFormOptions;
  /** Edit this draft. */
  quotation?: Quotation;
  /** Create a new draft copied from this quotation. */
  duplicateOf?: Quotation;
}

export function QuotationForm({ options, quotation, duplicateOf }: QuotationFormProps) {
  const router = useRouter();
  const store = useSessionStore();
  const [unchanged, setUnchanged] = useState(false);
  const form = useValidatedForm<QuotationFormValues, QuotationErrorKey, ReturnType<typeof validateQuotationForm>['input']>(
    FORM_ID,
    quotation
      ? quotationToForm(quotation)
      : duplicateOf
        ? duplicateQuotationForm(duplicateOf)
        : { ...emptyQuotationForm(), terms: options.defaultTerms },
    (values) => validateQuotationForm(values, { ...options, now: nowIso() }),
    quotationFieldLabel,
    quotationErrorLabel,
  );
  const { values, set, update, field, errors } = form;
  const currency = (Object.hasOwn(currencyLabel, values.currency) ? values.currency : 'KES') as Currency;
  const totals = previewTotals(values);

  const setLine = (index: number, patch: Partial<QuotationLineValues>) =>
    update((v) => ({ ...v, lines: v.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)) }));
  const removeLine = (index: number) => update((v) => ({ ...v, lines: v.lines.filter((_, i) => i !== index) }));
  const addLine = () => update((v) => ({ ...v, lines: [...v.lines, emptyLine()] }));

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setUnchanged(false);
    const input = form.submit();
    if (!input) return;
    if (!quotation) {
      const created = store.createQuotation(input, duplicateOf?.reference);
      const href = quotationHref(created.reference);
      store.showNotice(
        duplicateOf ? `Draft ${created.reference} created from ${duplicateOf.reference}.` : `Draft quotation ${created.reference} created.`,
        href,
      );
      router.push(href);
      return;
    }
    if (!store.updateQuotation(quotation.reference, (q, ctx) => applyQuotationUpdate(q, input, ctx))) {
      setUnchanged(true);
      return;
    }
    const href = quotationHref(quotation.reference);
    store.showNotice(`Draft ${quotation.reference} updated.`, href);
    router.push(href);
  }

  const cancelHref = quotation ? quotationHref(quotation.reference) : duplicateOf ? quotationHref(duplicateOf.reference) : '/quotations';

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
          title="Customer and route"
          description={
            quotation
              ? `Reference ${quotation.reference} cannot be changed.`
              : 'The reference is assigned when you save, in the existing QT-<YYMM>-<NUMBER> format. New quotations start as drafts.'
          }
        >
          <SelectField
            {...field('customerId')}
            label={quotationFieldLabel.customerId}
            required
            value={values.customerId}
            onChange={(v) => set('customerId', v)}
            placeholder="Select a customer"
            options={options.customers.map((c) => ({ value: c.id, label: c.name }))}
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
            onChange={(v) => set('destination', v)}
            maxLength={120}
          />
          <SelectField
            {...field('agentName')}
            label={quotationFieldLabel.agentName}
            value={values.agentName}
            onChange={(v) => set('agentName', v)}
            placeholder="No agent"
            options={options.agents.map((a) => ({ value: a, label: a }))}
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

        <FormSection title="Validity and currency">
          <DateField {...field('issuedAt')} label={quotationFieldLabel.issuedAt} required value={values.issuedAt} onChange={(v) => set('issuedAt', v)} />
          <DateField
            {...field('validUntil')}
            label={quotationFieldLabel.validUntil}
            required
            value={values.validUntil}
            onChange={(v) => set('validUntil', v)}
            hint="Valid to the end of this day (Nairobi time)."
          />
          <SelectField
            {...field('currency')}
            label={quotationFieldLabel.currency}
            required
            value={values.currency}
            onChange={(v) => set('currency', v)}
            options={toOptions(currencyLabel)}
            hint="All lines use this currency. No exchange-rate conversion is done."
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
            tax treatment. Line amounts are rounded to the nearest cent.
          </p>
          {errors.lines && (
            <p className="mt-2 text-xs font-medium text-red-700" role="alert">
              {errors.lines}
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
                    label={`Unit price (${currency})`}
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
                      {lineTotal(line, currency)}
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
              <dd className="text-right tabular-nums">{formatMoney(totals.subtotalMinor, currency)}</dd>
              <dt className="text-slate-600">Tax</dt>
              <dd className="text-right tabular-nums">{formatMoney(totals.taxMinor, currency)}</dd>
              <dt className="border-t border-slate-200 pt-1 font-semibold text-slate-900">Total</dt>
              <dd className="border-t border-slate-200 pt-1 text-right font-semibold text-slate-900 tabular-nums">
                {formatMoney(totals.totalMinor, currency)}
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

      <PendingNotice title="Saved in this browser tab only">
        There is no quotation API yet. Saving updates this tab&apos;s demo records; reloading the page discards the change.
        Nothing is emailed to the customer.
      </PendingNotice>

      <div className="flex flex-wrap justify-end gap-2">
        <ButtonLink href={cancelHref} variant="secondary">
          Cancel
        </ButtonLink>
        <Button type="submit">{quotation ? 'Save draft' : 'Create draft'}</Button>
      </div>
    </form>
  );
}
