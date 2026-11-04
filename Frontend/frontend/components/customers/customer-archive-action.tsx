'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError, backend } from '@/lib/api/browser';

/** Archiving only hides a customer from everyday lists. Nothing is deleted, and it can be undone. */
export function CustomerArchiveAction({ id, name, archived }: { id: number; name: string; archived: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();

  async function run(action: 'archive' | 'restore') {
    setBusy(true);
    setFailure(undefined);
    try {
      await backend.post(`parties/${id}/${action}`, {});
      setConfirming(false);
      router.refresh();
    } catch (error) {
      setFailure(error instanceof ApiError ? error.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const problem = failure && (
    <p role="alert" className="w-full text-sm font-medium text-red-700">
      {failure}
    </p>
  );

  if (archived) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => run('restore')}>
          Restore customer
        </Button>
        {problem}
      </div>
    );
  }
  if (!confirming) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
        Archive
      </Button>
    );
  }
  return (
    <div
      role="group"
      aria-label={`Confirm archiving ${name}`}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2"
    >
      <p className="text-sm text-amber-950">Archive {name}? It can be restored later.</p>
      <Button size="sm" disabled={busy} onClick={() => run('archive')}>
        Yes, archive
      </Button>
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(false)}>
        Keep it
      </Button>
      {problem}
    </div>
  );
}
