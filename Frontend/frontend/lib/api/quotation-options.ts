// Server-only: the live customers and agents offered by the quotation form.

import { DEMO_QUOTATION_TERMS } from '@/lib/data/demo-data';
import type { ListPage, LiveFormOptions, PartyRef } from '@/lib/live-quotations';
import { serverGet, type ServerResult } from './server';

/** The backend's largest page; enough for the form's dropdowns at this stage. */
const LIMIT = 200;

export async function getLiveQuotationFormOptions(returnTo: string): Promise<ServerResult<LiveFormOptions>> {
  const [customers, agents] = await Promise.all([
    serverGet<ListPage<PartyRef>>(`parties?role=customer&limit=${LIMIT}`, returnTo),
    serverGet<ListPage<PartyRef>>(`parties?role=agent&limit=${LIMIT}`, returnTo),
  ]);
  if (!customers.ok) return customers;
  if (!agents.ok) return agents;
  const pick = ({ id, name }: PartyRef) => ({ id, name });
  return {
    ok: true,
    data: {
      customers: customers.data.items.map(pick),
      agents: agents.data.items.map(pick),
      // A placeholder, not reviewed legal terms (as in the demo form).
      defaultTerms: DEMO_QUOTATION_TERMS,
    },
  };
}
