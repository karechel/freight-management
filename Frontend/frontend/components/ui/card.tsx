import Link from 'next/link';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-xs ${className}`}>
      {children}
    </section>
  );
}

interface CardHeaderProps {
  title: string;
  description?: string;
  /** Optional link shown on the right, e.g. "View all". */
  action?: { href: string; label: string };
  children?: React.ReactNode;
}

export function CardHeader({ title, description, action, children }: CardHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      <div className="flex items-center gap-3">
        {children}
        {action && (
          <Link
            href={action.href}
            className="rounded text-sm font-medium text-blue-700 hover:text-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            {action.label}
          </Link>
        )}
      </div>
    </div>
  );
}

export function CardBody({ children, className = '' }: CardProps) {
  return <div className={`px-4 py-4 sm:px-5 ${className}`}>{children}</div>;
}
