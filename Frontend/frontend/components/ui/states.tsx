// Shared empty / error / loading / notice states.

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
