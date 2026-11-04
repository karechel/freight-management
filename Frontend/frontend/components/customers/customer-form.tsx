'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorSummary, FormSection, SelectField, TextAreaField, TextField } from '@/components/ui/form';
import { useValidatedForm } from '@/components/ui/use-validated-form';
import { ApiError, backend } from '@/lib/api/browser';
import {
  customerFieldLabels,
  customerFormValues,
  validateCustomerForm,
  type CustomerField,
  type CustomerFormAccess,
  type CustomerFormValues,
} from '@/lib/customer-form';
import type { CustomerDetail } from '@/lib/customers';
import { accountStatusMeta } from '@/lib/labels';
import type { AccountStatus } from '@/lib/types';

const FORM_ID = 'customer';

const statusOptions = (Object.keys(accountStatusMeta) as AccountStatus[]).map((value) => ({
  value,
  label: accountStatusMeta[value].label,
}));

export function CustomerForm({ customer, access }: { customer?: CustomerDetail; access: CustomerFormAccess }) {
  const router = useRouter();
  const form = useValidatedForm<CustomerFormValues, CustomerField, Record<string, unknown>>(
    FORM_ID,
    customerFormValues(customer),
    (values) => validateCustomerForm(values, access),
    customerFieldLabels,
  );
  const [serverErrors, setServerErrors] = useState<Partial<Record<CustomerField, string>>>({});
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);
  const cancelHref = customer ? `/parties/${customer.id}` : '/parties';

  /** Props shared by each field: its value, its label and whichever error applies. */
  function bind(name: CustomerField) {
    const { id, error } = form.field(name);
    return {
      id,
      error: error ?? serverErrors[name],
      label: customerFieldLabels[name],
      value: form.values[name],
      onChange: (value: string) => {
        setServerErrors((current) => ({ ...current, [name]: undefined }));
        form.set(name, value as never);
      },
    };
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFailure(undefined);
    setServerErrors({});
    const input = form.submit();
    if (!input) return;
    setBusy(true);
    try {
      const saved = customer
        ? await backend.patch<CustomerDetail>(`parties/${customer.id}`, input)
        : await backend.post<CustomerDetail>('parties', { ...input, roles: ['customer'] });
      router.push(`/parties/${saved.id}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        setServerErrors(error.fieldErrors as Partial<Record<CustomerField, string>>);
        setFailure(error.message);
      } else {
        setFailure('The customer could not be saved. Try again.');
      }
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <ErrorSummary id={form.summaryId} errors={form.summary} />
      {failure && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {failure}
        </p>
      )}
      <Card>
        {access.details && (
          <>
            <FormSection title="Company">
              <TextField {...bind('name')} required maxLength={200} />
              <TextField {...bind('legalName')} maxLength={200} />
              <TextField {...bind('kraPin')} maxLength={20} />
            </FormSection>
            <FormSection title="Contact details" description="People at this company are added on the customer’s page.">
              <TextField {...bind('email')} type="email" maxLength={254} />
              <TextField {...bind('phone')} maxLength={20} />
              <TextField {...bind('city')} maxLength={100} />
              <TextField {...bind('country')} maxLength={100} />
              <TextAreaField {...bind('address')} maxLength={500} className="sm:col-span-2" />
            </FormSection>
            <FormSection title="Notes">
              <TextAreaField {...bind('notes')} maxLength={2000} className="sm:col-span-2 lg:col-span-3" />
            </FormSection>
          </>
        )}
        {(access.billing || access.status) && (
          <FormSection title="Billing">
            {access.billing && (
              <>
                <TextField {...bind('paymentTermsDays')} inputMode="numeric" maxLength={3} hint="From 0 to 365." />
                <TextField {...bind('creditLimit')} inputMode="decimal" maxLength={15} hint="Leave blank if no limit has been agreed." />
              </>
            )}
            {access.status && (
              <SelectField {...bind('accountStatus')} required options={statusOptions} hint="Only management and administrators can change this." />
            )}
          </FormSection>
        )}
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : customer ? 'Save changes' : 'Create customer'}
        </Button>
        <ButtonLink href={cancelHref} variant="secondary">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
