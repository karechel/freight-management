'use client';

// Select files, associate them with a shipment (and its customer) and a
// document type. Files are checked, then copied into the tab's memory. They
// are not uploaded anywhere; see docs/api-contracts.md for the storage API.

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DateField, ErrorSummary, fieldId, FormSection, SelectField, TextAreaField, type SummaryError } from '@/components/ui/form';
import { CloseIcon, FileIcon } from '@/components/ui/icons';
import { PendingNotice } from '@/components/ui/states';
import { useSessionStore } from '@/lib/data/session-store';
import { fromDateInput } from '@/lib/dates';
import { openRequirement } from '@/lib/document-changes';
import {
  acceptAttribute,
  allowedSummary,
  checkFile,
  formatBytes,
  MAX_FILES_PER_UPLOAD,
  MAX_SESSION_BYTES,
  type FileFormat,
} from '@/lib/document-upload';
import { documentStatusMeta, documentTypeLabel } from '@/lib/labels';
import type { DocumentType } from '@/lib/types';

const FORM_ID = 'upload';

interface StagedFile {
  key: string;
  file: File;
  state: 'checking' | 'ok' | 'error';
  error?: string;
  format?: FileFormat;
}

type UploadField = 'shipment' | 'type' | 'files' | 'expiresAt' | 'note';
const fieldLabel: Record<UploadField, string> = { shipment: 'Shipment', type: 'Document type', files: 'Files', expiresAt: 'Valid until', note: 'Note' };

let stagedCounter = 0;

export function UploadForm({ initialShipment, initialType }: { initialShipment?: string; initialType?: DocumentType }) {
  const router = useRouter();
  const store = useSessionStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [shipmentReference, setShipmentReference] = useState(initialShipment ?? '');
  const [type, setType] = useState<DocumentType | ''>(initialType ?? '');
  const [note, setNote] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [errors, setErrors] = useState<Partial<Record<UploadField, string>>>({});
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);

  const shipment = store.shipments.find((s) => s.reference === shipmentReference);
  const open = shipment
    ? store.documents.filter((d) => d.shipmentReference === shipment.reference && !d.file && (d.status === 'missing' || d.status === 'rejected'))
    : [];
  const fulfils = shipment && type ? openRequirement(store.documents, shipment.reference, type) : undefined;

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const room = MAX_FILES_PER_UPLOAD - staged.length;
    const accepted = incoming.slice(0, Math.max(0, room));
    const entries: StagedFile[] = accepted.map((file) => {
      stagedCounter += 1;
      const duplicate = staged.some((s) => s.file.name === file.name && s.file.size === file.size);
      return duplicate
        ? { key: `f${stagedCounter}`, file, state: 'error', error: 'This file is already selected.' }
        : { key: `f${stagedCounter}`, file, state: 'checking' };
    });
    setStaged((current) => [...current, ...entries]);
    setErrors((e) => ({
      ...e,
      files: incoming.length > accepted.length ? `Only ${MAX_FILES_PER_UPLOAD} files can be added at once; ${incoming.length - accepted.length} were not added.` : undefined,
    }));
    for (const entry of entries.filter((e) => e.state === 'checking')) {
      void checkFile(entry.file).then((result) =>
        setStaged((current) =>
          current.map((s) => (s.key === entry.key ? { ...s, state: result.format ? 'ok' : 'error', error: result.error, format: result.format } : s)),
        ),
      );
    }
    // Allow selecting the same file again after removing it.
    if (inputRef.current) inputRef.current.value = '';
  }

  const removeFile = (key: string) => setStaged((current) => current.filter((s) => s.key !== key));

  function validate(): Partial<Record<UploadField, string>> {
    const found: Partial<Record<UploadField, string>> = {};
    if (!shipmentReference) found.shipment = 'Select the shipment these documents belong to.';
    else if (!shipment) found.shipment = 'Select a shipment from the list.';
    if (!type) found.type = 'Select the document type.';
    if (staged.length === 0) found.files = `Select at least one file (${allowedSummary}).`;
    else if (staged.some((s) => s.state === 'checking')) found.files = 'Wait until all files have been checked.';
    else if (staged.some((s) => s.state === 'error')) found.files = 'Remove the files that cannot be added, then try again.';
    else {
      const total = staged.reduce((sum, s) => sum + s.file.size, 0);
      if (store.sessionFileBytes + total > MAX_SESSION_BYTES) {
        found.files = `This tab can hold ${formatBytes(MAX_SESSION_BYTES)} of files; ${formatBytes(store.sessionFileBytes)} is already used. Reload the page to clear it, or add fewer files.`;
      }
    }
    if (expiresAt && !fromDateInput(expiresAt)) found.expiresAt = 'Enter a valid date, or leave it empty.';
    if (note.trim().length > 300) found.note = 'Use 300 characters or fewer.';
    return found;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0 || !shipment || !type) {
      requestAnimationFrame(() => document.getElementById(`${FORM_ID}-error-summary`)?.focus());
      return;
    }
    setSaving(true);
    // Copy each file into memory now, so later changes to the file on disk do not matter.
    const copies = await Promise.all(
      staged.map(async (s) => {
        try {
          return { s, blob: new Blob([await s.file.arrayBuffer()], { type: s.format!.mimeTypes[0] }) };
        } catch {
          return { s, blob: undefined };
        }
      }),
    );
    const failed = copies.filter((c) => !c.blob);
    if (failed.length > 0) {
      setStaged((current) =>
        current.map((s) =>
          failed.some((f) => f.s.key === s.key)
            ? { ...s, state: 'error', error: 'The file could not be read. It may have been moved, deleted or locked. Select it again.' }
            : s,
        ),
      );
      setErrors({ files: 'Some files could not be read. Nothing was added. Remove or reselect them and try again.' });
      setSaving(false);
      return;
    }
    store.uploadDocuments(
      {
        shipmentReference: shipment.reference,
        customerName: shipment.customerName,
        type,
        note: note.trim() || undefined,
        // End of the chosen day, Nairobi time.
        expiresAt: expiresAt ? fromDateInput(expiresAt)?.replace('T00:00:00', 'T23:59:00') : undefined,
        files: copies.map((c) => ({ name: c.s.file.name, sizeBytes: c.s.file.size, mimeType: c.s.format!.mimeTypes[0] })),
      },
      copies.map((c) => c.blob!),
    );
    const href = `/shipments/${encodeURIComponent(shipment.reference)}`;
    store.showNotice(`${copies.length} file${copies.length === 1 ? '' : 's'} added to ${shipment.reference} as ${documentTypeLabel[type]}.`, href);
    router.push(href);
  }

  const summary: SummaryError[] = (Object.keys(fieldLabel) as UploadField[])
    .filter((k) => errors[k])
    .map((k) => ({ id: k === 'files' ? fieldId(FORM_ID, 'files') : fieldId(FORM_ID, k), label: fieldLabel[k], message: errors[k]! }));

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <ErrorSummary id={`${FORM_ID}-error-summary`} errors={summary} />
      <Card>
        <FormSection title="Shipment and document type" description="The customer is taken from the shipment.">
          <SelectField
            id={fieldId(FORM_ID, 'shipment')}
            label={fieldLabel.shipment}
            required
            value={shipmentReference}
            onChange={setShipmentReference}
            error={errors.shipment}
            placeholder="Select a shipment"
            options={store.shipments.map((s) => ({ value: s.reference, label: `${s.reference} · ${s.customerName}` }))}
          />
          <SelectField
            id={fieldId(FORM_ID, 'type')}
            label={fieldLabel.type}
            required
            value={type}
            onChange={(v) => setType(v as DocumentType)}
            error={errors.type}
            placeholder="Select a type"
            options={(Object.keys(documentTypeLabel) as DocumentType[]).map((t) => ({ value: t, label: documentTypeLabel[t] }))}
            hint={fulfils ? `The first file will fulfil the ${documentStatusMeta[fulfils.status].label.toLowerCase()} ${documentTypeLabel[fulfils.type]} requirement.` : undefined}
          />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-800">Customer</span>
            <span className="flex h-9 items-center rounded-lg bg-slate-50 px-3 text-sm text-slate-700">{shipment?.customerName ?? '—'}</span>
          </div>
          {shipment && (
            <div className="text-xs text-slate-600 sm:col-span-2 lg:col-span-3">
              {open.length === 0 ? (
                'No documents are outstanding for this shipment.'
              ) : (
                <>
                  Outstanding for {shipment.reference}:{' '}
                  {open.map((d, i) => (
                    <span key={d.id}>
                      {i > 0 && ', '}
                      <button type="button" onClick={() => setType(d.type)} className="rounded font-medium text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">
                        {documentTypeLabel[d.type]}
                      </button>{' '}
                      ({documentStatusMeta[d.status].label.toLowerCase()})
                    </span>
                  ))}
                </>
              )}
            </div>
          )}
        </FormSection>

        <section aria-labelledby={`${FORM_ID}-files-heading`} className="border-t border-slate-200 px-4 py-5 sm:px-5">
          <h2 id={`${FORM_ID}-files-heading`} className="text-sm font-semibold text-slate-900">
            Files
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {allowedSummary}. Up to {MAX_FILES_PER_UPLOAD} files at a time. Each file becomes its own document record.
          </p>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(e.dataTransfer.files);
            }}
            className={`mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-600 ${
              dragging ? 'border-blue-500 bg-blue-50' : errors.files ? 'border-red-400 bg-red-50/40' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
            }`}
          >
            <FileIcon className="size-6 text-slate-500" />
            <span className="font-medium text-blue-700">Choose files</span>
            <span className="text-xs text-slate-500">or drag them here</span>
            <input
              ref={inputRef}
              id={fieldId(FORM_ID, 'files')}
              type="file"
              multiple
              accept={acceptAttribute}
              onChange={(e) => addFiles(e.target.files)}
              aria-invalid={errors.files ? true : undefined}
              aria-describedby={errors.files ? `${fieldId(FORM_ID, 'files')}-error` : undefined}
              className="sr-only"
            />
          </label>
          {errors.files && (
            <p id={`${fieldId(FORM_ID, 'files')}-error`} className="mt-2 text-xs font-medium text-red-700">
              {errors.files}
            </p>
          )}
          {staged.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200" aria-live="polite">
              {staged.map((s) => (
                <li key={s.key} className="flex items-start gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm break-all text-slate-900">{s.file.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatBytes(s.file.size)}
                      {s.format ? ` · ${s.format.label}` : ''}
                    </p>
                    {s.error && <p className="text-xs font-medium text-red-700">{s.error}</p>}
                  </div>
                  {s.state === 'checking' && <Badge tone="neutral">Checking…</Badge>}
                  {s.state === 'ok' && <Badge tone="success">Ready</Badge>}
                  {s.state === 'error' && <Badge tone="danger">Cannot be added</Badge>}
                  <button
                    type="button"
                    onClick={() => removeFile(s.key)}
                    className="rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-blue-600"
                  >
                    <CloseIcon className="size-4" />
                    <span className="sr-only">Remove {s.file.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <FormSection title="Validity and note">
          <DateField
            id={fieldId(FORM_ID, 'expiresAt')}
            label={fieldLabel.expiresAt}
            hint="For permits, declarations or certificates that expire. Used for expiry notifications."
            value={expiresAt}
            onChange={setExpiresAt}
            error={errors.expiresAt}
          />
          <TextAreaField
            id={fieldId(FORM_ID, 'note')}
            label={fieldLabel.note}
            value={note}
            onChange={setNote}
            rows={2}
            maxLength={300}
            error={errors.note}
            className="sm:col-span-2 lg:col-span-3"
          />
        </FormSection>
      </Card>

      <PendingNotice title="Demo only: files are not uploaded or stored">
        Files are kept in this browser tab&apos;s memory and can be opened or downloaded here until the page is reloaded.
        They are not sent to the backend, shared with anyone, or saved permanently. Real uploads need private,
        access-controlled storage.
      </PendingNotice>

      <div className="flex flex-wrap justify-end gap-2">
        <ButtonLink href={shipment ? `/shipments/${encodeURIComponent(shipment.reference)}` : '/documents'} variant="secondary">
          Cancel
        </ButtonLink>
        <Button type="submit" disabled={saving}>
          {saving ? 'Adding files…' : 'Add documents'}
        </Button>
      </div>
    </form>
  );
}
