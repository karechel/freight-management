'use client';

import { useCallback, useEffect, useState } from 'react';
import { useCurrentUser } from '@/components/layout/current-user';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { SelectField, TextField } from '@/components/ui/form';
import { Table, Td, Th } from '@/components/ui/table';
import { ApiError, backend } from '@/lib/api/browser';

const MANAGE_REFERENCES = 'settings.references.manage';

type ResetPolicy = 'never' | 'yearly' | 'monthly';

interface ReferenceFormat {
  documentType: string;
  template: string;
  resetPolicy: ResetPolicy;
}

export interface StaticNumberingRow {
  record: string;
  pattern: string;
  example: string;
  note: string;
}

const documentLabels: Record<string, string> = {
  shipment: 'Shipments',
  quotation: 'Quotations',
  invoice: 'Invoices',
  booking: 'Bookings',
  credit_note: 'Credit notes',
  payment: 'Payment receipts',
  customs_entry: 'Customs entries',
};

const resetLabels: Record<ResetPolicy, string> = {
  never: 'Never (keeps counting)',
  yearly: 'Every year',
  monthly: 'Every month',
};

const resetOptions = (Object.keys(resetLabels) as ResetPolicy[]).map((value) => ({
  value,
  label: resetLabels[value],
}));

const orderOf = (type: string) => Object.keys(documentLabels).indexOf(type);

function FormatEditor({
  format,
  onSaved,
  onCancel,
}: {
  format: ReferenceFormat;
  onSaved: (saved: ReferenceFormat) => void;
  onCancel: () => void;
}) {
  const [template, setTemplate] = useState(format.template);
  const [resetPolicy, setResetPolicy] = useState(format.resetPolicy);
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const idPrefix = `numbering-${format.documentType}`;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    setPreview(undefined);
    try {
      await action();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? (caught.fieldErrors.template ?? caught.message)
          : 'The request failed. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  const showPreview = () =>
    run(async () => {
      const result = await backend.post<{ reference: string }>('reference-formats/preview', {
        documentType: format.documentType,
        template,
        resetPolicy,
      });
      setPreview(result.reference);
    });

  const save = () =>
    run(async () => {
      onSaved(
        await backend.patch<ReferenceFormat>(`reference-formats/${format.documentType}`, { template, resetPolicy }),
      );
    });

  return (
    <div className="space-y-3 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-5">
      <p className="text-sm font-semibold text-slate-900">Change the format for {documentLabels[format.documentType]}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          id={`${idPrefix}-template`}
          label="Format"
          required
          value={template}
          onChange={setTemplate}
          error={error}
          maxLength={100}
          hint={
            <>
              Capital letters, digits and hyphens, plus {'{SEQ:4}'} (running number, once, padded to 4 digits),{' '}
              {'{YYMM}'}, {'{YYYY}'}, {'{YY}'}, {'{MM}'}
              {format.documentType === 'shipment' ? <> and {'{MODE}'}</> : null}.
            </>
          }
        />
        <SelectField
          id={`${idPrefix}-reset`}
          label="Restart the running number"
          required
          value={resetPolicy}
          onChange={(value) => setResetPolicy(value as ResetPolicy)}
          options={resetOptions}
        />
      </div>
      {preview && (
        <p role="status" className="text-sm text-slate-700">
          The next reference would be <span className="font-mono font-medium text-slate-900">{preview}</span>.
        </p>
      )}
      <p className="text-xs text-slate-600">Only new records use a changed format. References already issued never change.</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={busy}>
          Save format
        </Button>
        <Button variant="secondary" onClick={showPreview} disabled={busy}>
          Preview next reference
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function NumberingEditor({ fallback }: { fallback: StaticNumberingRow[] }) {
  const { session, can } = useCurrentUser();
  const signedIn = session.status === 'signed_in';
  const canManage = can(MANAGE_REFERENCES);
  const [formats, setFormats] = useState<ReferenceFormat[]>();
  const [editing, setEditing] = useState<string>();
  const [loadFailed, setLoadFailed] = useState(false);
  const [savedType, setSavedType] = useState<string>();

  const onSaved = useCallback((saved: ReferenceFormat) => {
    setFormats((list) => list?.map((f) => (f.documentType === saved.documentType ? saved : f)));
    setEditing(undefined);
    setSavedType(saved.documentType);
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    backend.get<ReferenceFormat[]>('reference-formats').then(
      (list) => {
        if (active) setFormats([...list].sort((a, b) => orderOf(a.documentType) - orderOf(b.documentType)));
      },
      () => {
        if (active) setLoadFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [signedIn]);

  if (!signedIn || !formats) {
    return (
      <Card>
        <CardHeader
          title="Document and transaction numbering"
          description="YYMM is the year and month of creation; NNNN is a running number"
          action={
            session.status === 'signed_out'
              ? { href: '/login?next=%2Fsettings', label: 'Sign in to see live formats' }
              : undefined
          }
        />
        {loadFailed && (
          <CardBody>
            <p role="alert" className="text-sm text-red-700">
              The live formats could not be loaded. Showing the defaults.
            </p>
          </CardBody>
        )}
        <Table caption="Numbering formats">
          <thead>
            <tr>
              <Th>Record</Th>
              <Th>Format</Th>
              <Th>Example</Th>
              <Th>Notes</Th>
            </tr>
          </thead>
          <tbody>
            {fallback.map((row) => (
              <tr key={row.record}>
                <Td className="font-medium text-slate-900">{row.record}</Td>
                <Td className="font-mono text-xs">{row.pattern}</Td>
                <Td className="font-mono text-xs">{row.example}</Td>
                <Td>{row.note}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    );
  }

  const editingFormat = formats.find((f) => f.documentType === editing);
  return (
    <Card>
      <CardHeader
        title="Document and transaction numbering"
        description={
          canManage
            ? 'Live formats. Changes apply to new records only.'
            : 'Live formats. Only an administrator can change them.'
        }
      />
      <Table caption="Numbering formats">
        <thead>
          <tr>
            <Th>Record</Th>
            <Th>Format</Th>
            <Th>Restart</Th>
            {canManage && <Th>Change</Th>}
          </tr>
        </thead>
        <tbody>
          {formats.map((format) => (
            <tr key={format.documentType}>
              <Td className="font-medium text-slate-900">{documentLabels[format.documentType] ?? format.documentType}</Td>
              <Td className="font-mono text-xs">
                {format.template}
                {savedType === format.documentType && (
                  <span role="status" className="ml-2 font-sans font-medium text-emerald-700">
                    Saved
                  </span>
                )}
              </Td>
              <Td>{resetLabels[format.resetPolicy]}</Td>
              {canManage && (
                <Td>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Change format for ${documentLabels[format.documentType]}`}
                    onClick={() => {
                      setSavedType(undefined);
                      setEditing(format.documentType);
                    }}
                  >
                    Change
                  </Button>
                </Td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>
      {editingFormat && (
        <FormatEditor
          key={editingFormat.documentType}
          format={editingFormat}
          onSaved={onSaved}
          onCancel={() => setEditing(undefined)}
        />
      )}
    </Card>
  );
}
