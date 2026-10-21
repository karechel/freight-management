'use client';

import { useRouter } from 'next/navigation';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DateField, ErrorSummary, FormSection, SelectField, TextField } from '@/components/ui/form';
import { useValidatedForm } from '@/components/ui/use-validated-form';
import { useSessionStore } from '@/lib/data/session-store';
import { nowIso } from '@/lib/dates';
import { emptyExpenseForm, expenseFieldLabel, parseKes, validateExpenseForm, type ExpenseFormValues } from '@/lib/expense-form';
import { formatKes } from '@/lib/format';
import { expenseCategoryLabel, expenseStatusMeta } from '@/lib/labels';

export function ExpenseForm({ initialShipment }: { initialShipment?: string }) {
  const router = useRouter();
  const store = useSessionStore();
  const references = store.shipments.map((s) => s.reference);
  const form = useValidatedForm(
    'expense',
    emptyExpenseForm(initialShipment && references.includes(initialShipment) ? initialShipment : ''),
    (values: ExpenseFormValues) => validateExpenseForm(values, { shipmentReferences: references, now: nowIso() }),
    expenseFieldLabel,
  );
  const { values, set, field } = form;
  const amount = parseKes(values.amountKes);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const input = form.submit();
    if (!input) return;
    store.recordExpense(input);
    store.showNotice(`Expense of ${formatKes(input.amountKes)} recorded against ${input.shipmentReference}.`, '/expenses');
    router.push('/expenses');
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <ErrorSummary id={form.summaryId} errors={form.summary} />
      <Card>
        <FormSection title="Shipment and cost type">
          <SelectField
            {...field('shipmentReference')}
            label={expenseFieldLabel.shipmentReference}
            required
            value={values.shipmentReference}
            onChange={(v) => set('shipmentReference', v)}
            placeholder="Select a shipment"
            options={store.shipments.map((s) => ({ value: s.reference, label: `${s.reference} · ${s.customerName}` }))}
          />
          <SelectField
            {...field('category')}
            label={expenseFieldLabel.category}
            required
            value={values.category}
            onChange={(v) => set('category', v)}
            placeholder="Select a category"
            options={Object.entries(expenseCategoryLabel).map(([value, label]) => ({ value, label }))}
          />
          <SelectField
            {...field('status')}
            label={expenseFieldLabel.status}
            required
            hint="New supplier charges usually start as pending approval."
            value={values.status}
            onChange={(v) => set('status', v)}
            options={Object.entries(expenseStatusMeta).map(([value, meta]) => ({ value, label: meta.label }))}
          />
        </FormSection>
        <FormSection title="Charge details">
          <TextField
            {...field('description')}
            label={expenseFieldLabel.description}
            required
            maxLength={160}
            value={values.description}
            onChange={(v) => set('description', v)}
          />
          <TextField
            {...field('payee')}
            label={expenseFieldLabel.payee}
            required
            maxLength={120}
            value={values.payee}
            onChange={(v) => set('payee', v)}
          />
          <TextField
            {...field('amountKes')}
            label={expenseFieldLabel.amountKes}
            required
            inputMode="numeric"
            hint={amount ? `${formatKes(amount)}` : 'Whole shillings, e.g. 48500'}
            value={values.amountKes}
            onChange={(v) => set('amountKes', v)}
          />
          <DateField
            {...field('incurredAt')}
            label={expenseFieldLabel.incurredAt}
            required
            value={values.incurredAt}
            onChange={(v) => set('incurredAt', v)}
          />
        </FormSection>
      </Card>
      <div className="flex flex-wrap gap-3">
        <Button type="submit">Record expense</Button>
        <ButtonLink href="/expenses" variant="secondary">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
