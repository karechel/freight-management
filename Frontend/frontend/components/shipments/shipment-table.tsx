import Link from 'next/link';
import { StatusBadge } from '@/components/ui/badge';
import { AlertIcon, ModeIcon } from '@/components/ui/icons';
import { Table, Td, Th } from '@/components/ui/table';
import { formatShortDate } from '@/lib/format';
import { directionLabel, modeLabel, shipmentStatusMeta } from '@/lib/labels';
import type { Shipment } from '@/lib/types';

export function ShipmentTable({ shipments, caption }: { shipments: Shipment[]; caption: string }) {
  return (
    <Table caption={caption}>
      <thead>
        <tr>
          <Th>Reference</Th>
          <Th>Customer</Th>
          <Th>Route</Th>
          <Th>Status</Th>
          <Th className="text-right">ETA</Th>
        </tr>
      </thead>
      <tbody>
        {shipments.map((s) => (
          <tr key={s.reference} className="hover:bg-slate-50">
            <Td>
              <div className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 rounded-md bg-slate-100 p-1 text-slate-600"
                  title={`${modeLabel[s.mode]} freight`}
                >
                  <ModeIcon mode={s.mode} className="size-4" />
                  <span className="sr-only">{modeLabel[s.mode]} freight</span>
                </span>
                <div>
                  <Link
                    href={`/shipments/${s.reference}`}
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
              </div>
            </Td>
            <Td className="text-right whitespace-nowrap tabular-nums">{formatShortDate(s.eta)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
