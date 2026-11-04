'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ErrorSummary, TextField } from '@/components/ui/form';
import { EmptyState } from '@/components/ui/states';
import { useValidatedForm } from '@/components/ui/use-validated-form';
import { ApiError, backend } from '@/lib/api/browser';
import {
  contactFieldLabels,
  contactFormValues,
  validateContactForm,
  type ContactField,
  type ContactFormValues,
} from '@/lib/customer-form';
import type { CustomerContact } from '@/lib/customers';

const failureMessage = (error: unknown) =>
  error instanceof ApiError ? error.message : 'That did not work. Try again.';

function ContactForm({
  partyId,
  contact,
  onDone,
}: {
  partyId: number;
  contact?: CustomerContact;
  onDone: () => void;
}) {
  const router = useRouter();
  const formId = `contact-${contact?.id ?? 'new'}`;
  const form = useValidatedForm<ContactFormValues, ContactField, ContactFormValues>(
    formId,
    contactFormValues(contact),
    validateContactForm,
    contactFieldLabels,
  );
  const [serverErrors, setServerErrors] = useState<Partial<Record<ContactField, string>>>({});
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);

  function bind(name: ContactField) {
    const { id, error } = form.field(name);
    return {
      id,
      error: error ?? serverErrors[name],
      label: contactFieldLabels[name],
      value: form.values[name],
      onChange: (value: string) => {
        setServerErrors((current) => ({ ...current, [name]: undefined }));
        form.set(name, value);
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
      if (contact) await backend.patch(`parties/${partyId}/contacts/${contact.id}`, input);
      else await backend.post(`parties/${partyId}/contacts`, input);
      onDone();
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) setServerErrors(error.fieldErrors as Partial<Record<ContactField, string>>);
      setFailure(failureMessage(error));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-5">
      <p className="text-sm font-semibold text-slate-900">{contact ? `Edit ${contact.name}` : 'Add a contact'}</p>
      <ErrorSummary id={form.summaryId} errors={form.summary} />
      {failure && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {failure}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField {...bind('name')} required maxLength={200} />
        <TextField {...bind('title')} maxLength={200} />
        <TextField {...bind('email')} type="email" maxLength={254} />
        <TextField {...bind('phone')} maxLength={20} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? 'Saving…' : contact ? 'Save contact' : 'Add contact'}
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ContactRow({
  partyId,
  contact,
  canManage,
  onEdit,
}: {
  partyId: number;
  contact: CustomerContact;
  canManage: boolean;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setFailure(undefined);
    try {
      await action();
      setConfirming(false);
      router.refresh();
    } catch (error) {
      setFailure(failureMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const path = `parties/${partyId}/contacts/${contact.id}`;
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
          {contact.name}
          {contact.isPrimary && <Badge tone="info">Primary</Badge>}
        </p>
        {contact.title && <p className="text-xs text-slate-500">{contact.title}</p>}
        <p className="text-xs break-all text-slate-600">
          {[contact.email, contact.phone].filter(Boolean).join(' · ') || 'No email or phone recorded'}
        </p>
        {failure && (
          <p role="alert" className="mt-1 text-sm font-medium text-red-700">
            {failure}
          </p>
        )}
      </div>
      {canManage &&
        (confirming ? (
          <div role="group" aria-label={`Confirm removing ${contact.name}`} className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-slate-700">Remove this contact?</p>
            <Button size="sm" disabled={busy} onClick={() => run(() => backend.delete(path))}>
              Yes, remove
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {!contact.isPrimary && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                aria-label={`Make ${contact.name} the primary contact`}
                onClick={() => run(() => backend.patch(path, { isPrimary: true }))}
              >
                Make primary
              </Button>
            )}
            <Button variant="ghost" size="sm" aria-label={`Edit ${contact.name}`} onClick={onEdit}>
              Edit
            </Button>
            <Button variant="ghost" size="sm" aria-label={`Remove ${contact.name}`} onClick={() => setConfirming(true)}>
              Remove
            </Button>
          </div>
        ))}
    </li>
  );
}

export function CustomerContacts({
  partyId,
  contacts,
  canManage,
}: {
  partyId: number;
  contacts: CustomerContact[];
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<number | 'new'>();
  const editingContact = contacts.find((contact) => contact.id === editing);

  return (
    <Card>
      <CardHeader title="Contacts" description="People at this company">
        {canManage && editing !== 'new' && (
          <Button variant="secondary" size="sm" onClick={() => setEditing('new')}>
            Add contact
          </Button>
        )}
      </CardHeader>
      {contacts.length === 0 ? (
        <EmptyState title="No contacts recorded" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {contacts.map((contact) => (
            <ContactRow
              key={contact.id}
              partyId={partyId}
              contact={contact}
              canManage={canManage}
              onEdit={() => setEditing(contact.id)}
            />
          ))}
        </ul>
      )}
      {(editing === 'new' || editingContact) && (
        <ContactForm
          key={editing}
          partyId={partyId}
          contact={editingContact}
          onDone={() => setEditing(undefined)}
        />
      )}
    </Card>
  );
}
