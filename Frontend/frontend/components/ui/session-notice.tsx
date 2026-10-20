'use client';

import { usePathname } from 'next/navigation';
import { useSessionStore } from '@/lib/data/session-store';
import { CheckIcon, CloseIcon } from './icons';

/** Success message after a save, shown on the page the user was sent to. */
export function SessionNotice() {
  const { notice, dismissNotice } = useSessionStore();
  const pathname = usePathname();
  if (!notice || notice.path !== pathname) return null;
  return (
    <div
      role="status"
      className="mb-6 flex items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
    >
      <CheckIcon className="mt-0.5 size-5 shrink-0 text-emerald-700" />
      <div className="flex-1">
        <p className="font-medium">{notice.message}</p>
        <p className="mt-0.5 text-emerald-900">
          Saved in this browser tab only. It is not stored in the backend and is lost when the page is reloaded.
        </p>
      </div>
      <button
        type="button"
        onClick={dismissNotice}
        className="rounded p-0.5 text-emerald-800 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-700"
        aria-label="Dismiss message"
      >
        <CloseIcon className="size-4" />
      </button>
    </div>
  );
}
