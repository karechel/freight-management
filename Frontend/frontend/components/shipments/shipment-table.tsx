'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/ui/badge';
import { AlertIcon, ClockIcon, ModeIcon } from '@/components/ui/icons';
import { Table, Td, Th } from '@/components/ui/table';
import { formatDuration, formatShortDate } from '@/lib/format';
import { directionLabel, modeLabel, shipmentStatusMeta } from '@/lib/labels';
import { currentEta, delayDurationMs, unresolvedDelays } from '@/lib/metrics';
import type { Shipment } from '@/lib/types';

export const shipmentHref = (reference: string) => `/shipments/${encodeURIComponent(reference)}`;

export function ShipmentTable({ shipments, caption }: { shipments: Shipment[]; caption: string }) {
  const router = useRouter();

  // The whole row opens the shipment for pointer users. Keyboard and screen
  // reader users use the reference link, which is the row's real link.
  function onRowClick(event: React.MouseEvent<HTMLTableRowElement>, reference: string) {
    if ((event.target as HTMLElement).closest('a, button, input, select, textarea')) return;
    if (window.getSelection()?.toString()) return;
    router.push(shipmentHref(reference));
  }

  return (
    <Table caption={caption}>
      <thead>
        <tr>
          <Th>Reference</Th>
          <Th>Customer</Th>
          <Th>Route</Th>
          <Th>Status</Th>
          <Th className="text-right">ETA / actual</Th>
        </tr>
      </thead>
      <tbody>
        {shipments.map((s) => {
          const eta = currentEta(s);
          const delays = s.status === 'delivered' ? [] : unresolvedDelays(s);
          const latestDuration = delays[0] ? delayDurationMs(delays[0]) : undefined;
          return (
            <tr key={s.reference} className="cursor-pointer hover:bg-slate-50" onClick={(e) => onRowClick(e, s.reference)}>
              <Td>
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 rounded-md bg-slate-100 p-1 text-slate-600" title={`${modeLabel[s.mode]} freight`}>
                    <ModeIcon mode={s.mode} className="size-4" />
                    <span className="sr-only">{modeLabel[s.mode]} freight</span>
                  </span>
                  <div>
                    <Link
                      href={shipmentHref(s.reference)}
                      className="rounded font-mono text-[13px] font-medium text-blue-700 hover:text-blue-900 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
                    >
                      {s.reference}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {directionLabel[s.direction]} · {s.equipment}
                    </p>
                  </div>
                </div>
              </Td>
              <Td>
                <p className="font-medium text-slate-900">{s.customerName}</p>
                <p className="text-xs text-slate-500">{s.cargoDescription}</p>
              </Td>
              <Td>
                <p>{s.origin}</p>
                <p className="text-xs text-slate-500">to {s.destination}</p>
              </Td>
              <Td>
                <div className="flex flex-col items-start gap-1">
                  <StatusBadge meta={shipmentStatusMeta[s.status]} />
                  {s.exceptions.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
                      <AlertIcon className="size-3.5" />
                      {s.exceptions.length === 1 ? '1 exception' : `${s.exceptions.length} exceptions`}
                    </span>
                  )}
                  {delays.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800">
                      <ClockIcon className="size-3.5" />
                      {delays.length === 1 ? 'Delayed' : `${delays.length} open delays`}
                      {latestDuration !== undefined ? ` · +${formatDuration(latestDuration)}` : ' · revised date not set'}
                    </span>
                  )}
                </div>
              </Td>
              <Td className="text-right whitespace-nowrap tabular-nums">
                {s.deliveredAt ? (
                  <>
                    <p>{formatShortDate(s.deliveredAt)}</p>
                    <p className="text-xs text-emerald-700">Delivered (actual)</p>
                  </>
                ) : s.ata ? (
                  <>
                    <p>{formatShortDate(s.ata)}</p>
                    <p className="text-xs text-slate-500">Arrived (actual)</p>
                  </>
                ) : (
                  <>
                    <p>{formatShortDate(eta.at)}</p>
                    <p className={`text-xs ${eta.revised ? 'font-medium text-amber-800' : 'text-slate-500'}`}>
                      {eta.revised ? `Revised ETA · planned ${formatShortDate(s.eta)}` : 'ETA (estimated)'}
                    </p>
                  </>
                )}
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
