import Link from 'next/link';
import type { Tone } from '@/lib/labels';

interface KpiCardProps {
  label: string;
  value: string;
  /** Short context line under the value. */
  detail: string;
  href: string;
  icon: React.ReactNode;
  /** Highlights the card when the figure needs attention. */
  attention?: Extract<Tone, 'warning' | 'danger'>;
}

const attentionRing = {
  warning: 'border-amber-300',
  danger: 'border-red-300',
};

const iconTone = {
  default: 'bg-blue-50 text-blue-800',
  warning: 'bg-amber-50 text-amber-800',
  danger: 'bg-red-50 text-red-700',
};

export function KpiCard({ label, value, detail, href, icon, attention }: KpiCardProps) {
  return (
    <Link
      href={href}
      className={`group flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-xs transition-colors hover:border-blue-300 hover:bg-blue-50/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${attention ? attentionRing[attention] : 'border-slate-200'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <span className={`rounded-lg p-1.5 ${iconTone[attention ?? 'default']}`}>{icon}</span>
      </div>
      <span className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
        {value}
      </span>
      <span className="text-xs text-slate-500 group-hover:text-slate-700">{detail}</span>
    </Link>
  );
}
