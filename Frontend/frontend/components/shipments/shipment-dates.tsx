// Estimated vs actual dates for departure, arrival and delivery.

import { Badge } from '@/components/ui/badge';
import { toDateInput } from '@/lib/dates';
import { daysBetween, formatDate, formatDateTime } from '@/lib/format';
import { currentEta } from '@/lib/metrics';
import type { Shipment } from '@/lib/types';

/** Calendar-day difference between an estimate and what happened, when both are known. */
function Variance({ estimated, actual }: { estimated?: string; actual?: string }) {
  if (!estimated || !actual) return <span className="text-slate-400">—</span>;
  // Compare Nairobi calendar days: estimates are dates, actuals are date-times.
  const days = daysBetween(toDateInput(estimated), toDateInput(actual));
  if (days === 0) return <Badge tone="success">On the estimated day</Badge>;
  return days > 0 ? (
    <Badge tone="warning">{`${days} day${days === 1 ? '' : 's'} late`}</Badge>
  ) : (
    <Badge tone="info">{`${-days} day${days === -1 ? '' : 's'} early`}</Badge>
  );
}

export function ShipmentDates({ shipment: s }: { shipment: Shipment }) {
  const eta = currentEta(s);
  const rows = [
    { label: 'Departure', estimated: s.etd, estimateNote: undefined, actual: s.atd },
    {
      label: 'Arrival',
      estimated: eta.at,
      estimateNote: eta.revised ? `Revised by a delay · planned ${formatDate(s.eta)}` : undefined,
      actual: s.ata,
    },
    { label: 'Delivery', estimated: s.estimatedDeliveryAt, estimateNote: undefined, actual: s.deliveredAt },
  ];
  return (
    <div role="region" aria-label="Estimated and actual dates" tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-blue-600">
      <table className="w-full min-w-[520px] text-left text-sm">
        <caption className="sr-only">Estimated and actual dates</caption>
        <thead>
          <tr className="text-xs text-slate-500">
            <th scope="col" className="pb-2 font-medium">Event</th>
            <th scope="col" className="pb-2 font-medium">Estimated</th>
            <th scope="col" className="pb-2 font-medium">Actual</th>
            <th scope="col" className="pb-2 font-medium">Difference</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row" className="py-2.5 pr-3 font-medium text-slate-900">{r.label}</th>
              <td className="py-2.5 pr-3 text-slate-700">
                {r.estimated ? formatDate(r.estimated) : <span className="text-slate-400">Not set</span>}
                {r.estimateNote && <p className="text-xs font-medium text-amber-800">{r.estimateNote}</p>}
              </td>
              <td className="py-2.5 pr-3 text-slate-700">
                {r.actual ? formatDateTime(r.actual) : <span className="text-slate-400">Not yet recorded</span>}
              </td>
              <td className="py-2.5">
                <Variance estimated={r.estimated} actual={r.actual} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
