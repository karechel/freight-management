'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Table, Td, Th } from '@/components/ui/table';
import { useSessionStore } from '@/lib/data/session-store';
import { formatKes } from '@/lib/format';
import { partyTypeLabel } from '@/lib/labels';
import { isActive } from '@/lib/metrics';
import type { Party, PartyType, Shipment } from '@/lib/types';

/** Customers open under Customers; agents, carriers and transporters under Agents and Partners. */
export const partyHref = (party: Pick<Party, 'id' | 'type'>) =>
  `${party.type === 'customer' ? '/parties' : '/agents'}/${encodeURIComponent(party.id)}`;

/** Shipments a party is involved in: as customer, agent or carrier. */
export function shipmentsForParty(party: Pick<Party, 'id' | 'name' | 'type'>, shipments: Shipment[]): Shipment[] {
  switch (party.type) {
    case 'customer':
      return shipments.filter((s) => s.customerId === party.id);
    case 'agent':
      return shipments.filter((s) => s.agentName === party.name);
    default:
      return shipments.filter((s) => s.carrier === party.name);
  }
}

export function PartyTable({ parties, type }: { parties: Party[]; type: PartyType }) {
  const { shipments } = useSessionStore();
  const showBalance = type === 'customer';
  const showRoutes = type === 'agent';
  return (
    <Table caption={partyTypeLabel[type]}>
      <thead>
        <tr>
          <Th>Name</Th>
          <Th>Location</Th>
          <Th>Contact</Th>
          {showRoutes && <Th>Routes</Th>}
          <Th className="text-right">Active shipments</Th>
          {showBalance && <Th className="text-right">Outstanding</Th>}
        </tr>
      </thead>
      <tbody>
        {parties.map((p) => (
          <tr key={p.id} className="hover:bg-slate-50">
            <Td>
              <Link
                href={partyHref(p)}
                className="rounded font-medium text-blue-700 hover:text-blue-900 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                {p.name}
              </Link>
            </Td>
            <Td>{p.location}</Td>
            <Td>
              <p>{p.contactName}</p>
              <p className="text-xs text-slate-500">{p.email}</p>
            </Td>
            {showRoutes && <Td className="tabular-nums">{p.routes?.length ?? 0}</Td>}
            <Td className="text-right tabular-nums">{shipmentsForParty(p, shipments).filter(isActive).length}</Td>
            {showBalance && (
              <Td className="text-right tabular-nums">
                {p.outstandingKes ? formatKes(p.outstandingKes) : <Badge tone="success">Settled</Badge>}
              </Td>
            )}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
