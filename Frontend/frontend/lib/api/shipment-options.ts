// Server-only: the choices offered by the live shipment forms and the shipment page.

import type { ShipmentFormChoices } from '@/components/shipments/live-shipment-form';
import type { ListPage, PartyRef } from '@/lib/live-quotations';
import type { PersonRef } from '@/lib/live-shipments';
import { serverGet, type ServerResult } from './server';

const LIMIT = 200;
const pick = ({ id, name }: PartyRef) => ({ id, name });

/** Active staff for assignment and follow-up. */
export async function getShipmentStaff(returnTo: string): Promise<PersonRef[]> {
  const staff = await serverGet<PersonRef[]>('shipments/options/staff', returnTo);
  return staff.ok ? staff.data : [];
}

/**
 * Standalone jobs are new work, so on-hold and closed customers are left out (archived customers
 * are not listed by the API at all); the backend refuses them too.
 */
export async function getShipmentFormChoices(returnTo: string): Promise<ServerResult<ShipmentFormChoices>> {
  const [customers, carriers, agents, staff] = await Promise.all([
    serverGet<ListPage<PartyRef & { accountStatus?: string }>>(`parties?role=customer&limit=${LIMIT}`, returnTo),
    serverGet<ListPage<PartyRef>>(`parties?role=carrier&limit=${LIMIT}`, returnTo),
    serverGet<ListPage<PartyRef>>(`parties?role=agent&limit=${LIMIT}`, returnTo),
    getShipmentStaff(returnTo),
  ]);
  if (!customers.ok) return customers;
  if (!carriers.ok) return carriers;
  if (!agents.ok) return agents;
  return {
    ok: true,
    data: {
      customers: customers.data.items.filter((c) => c.accountStatus === 'active').map(pick),
      carriers: carriers.data.items.map(pick),
      agents: agents.data.items.map(pick),
      staff,
    },
  };
}
