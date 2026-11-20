'use client';

import { Button } from '@/components/ui/button';
import { TextAreaField } from '@/components/ui/form';
import { formatKesExact } from '@/lib/format';
import type { CreditWarning } from '@/lib/live-quotations';

export type CreditChoice = 'proceed' | 'blocked' | 'request_approval';

/**
 * Shown when a new booking would take the customer over their credit limit. Override holders
 * proceed or stop; others stop or book and request approval. Every choice needs a reason.
 */
export function CreditWarningPanel({
  warning,
  reason,
  onReasonChange,
  reasonError,
  busy,
  onChoose,
}: {
  warning: CreditWarning;
  reason: string;
  onReasonChange: (value: string) => void;
  reasonError?: string;
  busy: boolean;
  onChoose: (choice: CreditChoice) => void;
}) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-semibold">Over the credit limit</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
        <dt>Outstanding balance</dt>
        <dd className="text-right tabular-nums">{formatKesExact(warning.exposure)}</dd>
        <dt>This booking</dt>
        <dd className="text-right tabular-nums">{formatKesExact(warning.attemptedAmount)}</dd>
        <dt className="font-semibold">Credit limit</dt>
        <dd className="text-right font-semibold tabular-nums">{formatKesExact(warning.creditLimit)}</dd>
      </dl>
      <TextAreaField
        id="credit-decision-reason"
        label="Reason for your decision"
        required
        value={reason}
        onChange={onReasonChange}
        rows={2}
        maxLength={500}
        error={reasonError}
        hint="Recorded with your name and the time."
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={() => onChoose('blocked')} disabled={busy}>
          Stop, do not book
        </Button>
        {warning.canOverride ? (
          <Button size="sm" onClick={() => onChoose('proceed')} disabled={busy}>
            Proceed past the limit
          </Button>
        ) : (
          <Button size="sm" onClick={() => onChoose('request_approval')} disabled={busy}>
            Book and request approval
          </Button>
        )}
      </div>
      {!warning.canOverride && (
        <p className="text-xs">
          The booking is created as pending and cannot be confirmed until finance, management or an administrator approves
          it. If they reject it, it is cancelled.
        </p>
      )}
    </div>
  );
}
