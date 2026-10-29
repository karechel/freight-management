import type { StatusMeta, Tone } from '@/lib/labels';

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-300/70',
  info: 'bg-sky-50 text-sky-800 ring-sky-300/70',
  progress: 'bg-indigo-50 text-indigo-800 ring-indigo-300/70',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-300/70',
  warning: 'bg-amber-50 text-amber-900 ring-amber-300/80',
  danger: 'bg-red-50 text-red-800 ring-red-300/70',
};

const dotClasses: Record<Tone, string> = {
  neutral: 'bg-slate-400',
  info: 'bg-sky-500',
  progress: 'bg-indigo-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
};

interface BadgeProps {
  tone?: Tone;
  children: React.ReactNode;
  /** Show a leading dot. The text label always carries the meaning, not colour. */
  dot?: boolean;
  className?: string;
}

export function Badge({ tone = 'neutral', children, dot = false, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${toneClasses[tone]} ${className}`}
    >
      {dot && <span className={`size-1.5 rounded-full ${dotClasses[tone]}`} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function StatusBadge({ meta }: { meta: StatusMeta }) {
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}
