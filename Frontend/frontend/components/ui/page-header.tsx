import Link from 'next/link';
import { ChevronLeftIcon } from './icons';

interface PageHeaderProps {
  title: string;
  description?: string;
  back?: { href: string; label: string };
  /** Extra content on the right, e.g. a badge or filters. */
  children?: React.ReactNode;
}

export function PageHeader({ title, description, back, children }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="mb-2 inline-flex items-center gap-1 rounded text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <ChevronLeftIcon className="size-4" />
            {back.label}
          </Link>
        )}
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
