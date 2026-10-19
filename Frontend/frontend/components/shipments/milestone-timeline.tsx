import { CheckIcon } from '@/components/ui/icons';
import { formatDateTime } from '@/lib/format';
import type { Milestone } from '@/lib/types';

const stateText = { done: 'Completed', current: 'In progress', pending: 'Not started' } as const;

export function MilestoneTimeline({ milestones }: { milestones: Milestone[] }) {
  return (
    <ol className="flex flex-col">
      {milestones.map((m, index) => (
        <li key={`${m.label}-${index}`} className="relative flex gap-3 pb-5 last:pb-0">
          {index < milestones.length - 1 && (
            <span
              className={`absolute top-6 left-[11px] h-[calc(100%-1rem)] w-0.5 ${m.state === 'done' ? 'bg-blue-700' : 'bg-slate-200'}`}
              aria-hidden="true"
            />
          )}
          <span
            className={`relative flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${
              m.state === 'done'
                ? 'border-blue-700 bg-blue-700 text-white'
                : m.state === 'current'
                  ? 'border-blue-700 bg-white'
                  : 'border-slate-300 bg-white'
            }`}
            aria-hidden="true"
          >
            {m.state === 'done' && <CheckIcon className="size-3.5" />}
            {m.state === 'current' && <span className="size-2 rounded-full bg-blue-700" />}
          </span>
          <div className="min-w-0 pt-0.5">
            <p className={`text-sm font-medium ${m.state === 'pending' ? 'text-slate-500' : 'text-slate-900'}`}>
              {m.label}
              <span className="sr-only"> ({stateText[m.state]})</span>
            </p>
            <p className="text-xs text-slate-500">
              {m.at ? formatDateTime(m.at) : m.state === 'current' ? 'In progress' : 'Pending'}
              {m.location ? ` · ${m.location}` : ''}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
