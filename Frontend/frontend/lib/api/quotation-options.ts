// Server-only: the live customers and agents offered by the quotation and booking forms.

import { DEMO_QUOTATION_TERMS } from '@/lib/data/demo-data';
import type { ListPage, LiveFormOptions, PartyRef } from '@/lib/live-quotations';
import { serverGet, type ServerResult } from './server';

/** The backend's largest page; enough for the form's dropdowns at this stage. */
const LIMIT = 200;

/**
 * On-hold and closed customers cannot receive new quotations or bookings (repository owner,
 * 2026-11-26), so they are left out of the customer list; archived customers are not listed by
 * the API at all. `keepCustomerId` keeps a quotation's current customer when it is edited.
 */
export async function getLiveQuotationFormOptions(
  returnTo: string,
  keepCustomerId?: number,
): Promise<ServerResult<LiveFormOptions>> {
  const [customers, agents] = await Promise.all([
    serverGet<ListPage<PartyRef & { accountStatus?: string }>>(`parties?role=customer&limit=${LIMIT}`, returnTo),
    serverGet<ListPage<PartyRef>>(`parties?role=agent&limit=${LIMIT}`, returnTo),
  ]);
  if (!customers.ok) return customers;
  if (!agents.ok) return agents;
  const pick = ({ id, name }: PartyRef) => ({ id, name });
  const offered = customers.data.items.filter((c) => c.accountStatus === 'active' || c.id === keepCustomerId);
  return {
    ok: true,
    data: {
      customers: offered.map(pick),
      blockedCustomers: customers.data.items.length - offered.length,
      agents: agents.data.items.map(pick),
      // A placeholder, not reviewed legal terms (as in the demo form).
      defaultTerms: DEMO_QUOTATION_TERMS,
    },
  };
}
