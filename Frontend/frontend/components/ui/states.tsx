// Shared empty / error / loading / notice states.

import Link from 'next/link';
import { AlertIcon, InfoIcon } from './icons';
import type { DataSource } from '@/lib/types';

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      {description && <p className="max-w-sm text-sm text-slate-500">{description}</p>}
      {children}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center"
    >
      <AlertIcon className="size-6 text-red-600" />
      <p className="text-sm font-medium text-slate-900">{title}</p>
      {description && <p className="max-w-md text-sm text-slate-600">{description}</p>}
      {children}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`motion-safe:animate-pulse rounded-md bg-slate-200/80 ${className}`} />;
}

/** Wording for the demo banner on pages where records can be edited in the browser session. */
export const SESSION_EDIT_NOTE =
  'Changes you make are kept only in this browser tab until it is reloaded. Nothing is sent to, or saved in, the backend.';

/** Banner stating that the page shows demonstration data, not live records. */
export function DataSourceNotice({ source, children }: { source: DataSource; children?: React.ReactNode }) {
  if (source === 'live') return null;
  return (
    <div className="mb-6 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <InfoIcon className="mt-0.5 size-5 shrink-0 text-amber-700" />
      <div>
        <p className="font-medium">Demonstration data</p>
        <p className="mt-0.5 text-amber-900">
          Records on this page are fictional and are not stored in, or loaded from, the backend.
          {children ? <> {children}</> : null}
        </p>
      </div>
    </div>
  );
}

/** Inline note for features that need an integration that does not exist yet. */
export function PendingNotice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <InfoIcon className="mt-0.5 size-5 shrink-0 text-slate-500" />
      <div>
        <p className="font-medium text-slate-900">{title}</p>
        <p className="mt-0.5">{children}</p>
      </div>
    </div>
  );
}

/**
 * Not-found message for records looked up in the browser session store, where
 * Next.js `notFound()` (server only) cannot be used.
 */
export function RecordNotFound({ title, backHref, backLabel }: { title: string; backHref: string; backLabel: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
      <EmptyState
        title={title}
        description="It may have been mistyped, or it was created in another browser tab or before the page was reloaded. Records created in this demo exist only in the tab where they were made."
      >
        <Link
          href={backHref}
          className="mt-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          {backLabel}
        </Link>
      </EmptyState>
    </div>
  );
}
