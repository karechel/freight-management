'use client';

import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/components/layout/current-user';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { SelectField, TextField } from '@/components/ui/form';
import { Table, Td, Th } from '@/components/ui/table';
import { ApiError, backend } from '@/lib/api/browser';

/** Admin only (seeded). The backend checks it again on every request. */
const MANAGE_TAX = 'settings.tax.manage';

type TaxCategory = 'standard' | 'zero_rated' | 'exempt' | 'outside_vat';

interface ChargeType {
  id: number;
  code: string;
  name: string;
  defaultTaxCategory: TaxCategory;
  defaultTaxRate: string;
  isDisbursement: boolean;
  isActive: boolean;
}

const categoryLabels: Record<TaxCategory, string> = {
  standard: 'Standard rated',
  zero_rated: 'Zero rated',
  exempt: 'Exempt',
  outside_vat: 'Outside the scope of VAT',
};

const categoryOptions = (Object.keys(categoryLabels) as TaxCategory[]).map((value) => ({
  value,
  label: categoryLabels[value],
}));

const RATE = /^\d{1,3}(\.\d{1,2})?$/;

/** Shows "16.00" as "16" and "8.50" as "8.5". */
const shortRate = (rate: string) => rate.replace(/\.?0+$/, '') || '0';

function TaxEditor({
  chargeType,
  onSaved,
  onCancel,
}: {
  chargeType: ChargeType;
  onSaved: (saved: ChargeType) => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState<TaxCategory>(chargeType.defaultTaxCategory);
  const [rate, setRate] = useState(shortRate(chargeType.defaultTaxRate));
  const [errors, setErrors] = useState<{ category?: string; rate?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const idPrefix = `tax-${chargeType.code}`;

  async function save() {
    const value = rate.trim();
    if (!RATE.test(value) || Number(value) > 100) {
      setErrors({ rate: 'Enter a rate from 0 to 100, with up to 2 decimal places.' });
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      onSaved(
        await backend.patch<ChargeType>(`charge-types/${chargeType.id}/tax`, {
          defaultTaxCategory: category,
          defaultTaxRate: value,
        }),
      );
    } catch (caught) {
      if (caught instanceof ApiError) {
        const fields = caught.fieldErrors;
        setErrors({
          category: fields.defaultTaxCategory,
          rate: fields.defaultTaxRate,
          form: fields.defaultTaxCategory || fields.defaultTaxRate ? undefined : caught.message,
        });
      } else {
        setErrors({ form: 'The request failed. Try again.' });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-5">
      <p className="text-sm font-semibold text-slate-900">Change the tax defaults for {chargeType.name}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          id={`${idPrefix}-category`}
          label="Tax category"
          required
          value={category}
          onChange={(value) => setCategory(value as TaxCategory)}
          options={categoryOptions}
          error={errors.category}
        />
        <TextField
          id={`${idPrefix}-rate`}
          label="Tax rate (%)"
          required
          inputMode="decimal"
          value={rate}
          onChange={(value) => {
            setRate(value);
            setErrors((e) => ({ ...e, rate: undefined }));
          }}
          error={errors.rate}
          maxLength={6}
        />
      </div>
      {errors.form && (
        <p role="alert" className="text-sm text-red-700">
          {errors.form}
        </p>
      )}
      <p className="text-xs text-slate-600">
        Only quotation lines added after the change use the new defaults. Saved lines keep their own category and rate.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={busy}>
          Save tax settings
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/**
 * Charge-type tax categories and rates. They are provisional until the company accountant reviews
 * them (repository owner, 2026-11-26), so an administrator can change them here.
 */
export function TaxSettingsEditor() {
  const { session, can } = useCurrentUser();
  const canManage = session.status === 'signed_in' && can(MANAGE_TAX);
  const [types, setTypes] = useState<ChargeType[]>();
  const [editing, setEditing] = useState<number>();
  const [savedId, setSavedId] = useState<number>();
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!canManage) return;
    let active = true;
    backend.get<ChargeType[]>('charge-types/tax-settings').then(
      (list) => {
        if (active) setTypes(list);
      },
      () => {
        if (active) setLoadFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [canManage]);

  const header = (
    <CardHeader
      title="Tax settings"
      description="Default VAT category and rate for each charge type, used for new quotation lines"
    />
  );
  const provisional = (
    <CardBody>
      <p className="text-sm text-amber-900">
        <Badge tone="warning">Provisional</Badge>{' '}
        These defaults have not been reviewed by the company&apos;s accountant. Tax is calculated per line and rounded
        half away from zero.
      </p>
    </CardBody>
  );

  if (!canManage) {
    return (
      <Card>
        {header}
        {provisional}
        <CardBody>
          <p className="text-sm text-slate-600">Only an administrator can view and change the tax settings.</p>
        </CardBody>
      </Card>
    );
  }
  if (!types) {
    return (
      <Card>
        {header}
        <CardBody>
          {loadFailed ? (
            <p role="alert" className="text-sm text-red-700">
              The tax settings could not be loaded.
            </p>
          ) : (
            <p className="text-sm text-slate-600">Loading…</p>
          )}
        </CardBody>
      </Card>
    );
  }

  const editingType = types.find((t) => t.id === editing);
  return (
    <Card>
      {header}
      {provisional}
      <Table caption="Charge-type tax settings">
        <thead>
          <tr>
            <Th>Charge type</Th>
            <Th>Tax category</Th>
            <Th>Rate</Th>
            <Th>Change</Th>
          </tr>
        </thead>
        <tbody>
          {types.map((t) => (
            <tr key={t.id}>
              <Td className="font-medium text-slate-900">
                {t.name}
                {!t.isActive && <span className="ml-2 text-xs font-normal text-slate-500">(inactive)</span>}
              </Td>
              <Td>
                {categoryLabels[t.defaultTaxCategory]}
                {savedId === t.id && (
                  <span role="status" className="ml-2 font-medium text-emerald-700">
                    Saved
                  </span>
                )}
              </Td>
              <Td>{shortRate(t.defaultTaxRate)}%</Td>
              <Td>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Change tax for ${t.name}`}
                  onClick={() => {
                    setEditing(t.id);
                    setSavedId(undefined);
                  }}
                >
                  Change
                </Button>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {editingType && (
        <TaxEditor
          key={editingType.id}
          chargeType={editingType}
          onCancel={() => setEditing(undefined)}
          onSaved={(saved) => {
            setTypes((list) => list?.map((t) => (t.id === saved.id ? saved : t)));
            setEditing(undefined);
            setSavedId(saved.id);
          }}
        />
      )}
    </Card>
  );
}
