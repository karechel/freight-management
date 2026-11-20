import { ConflictException } from '@nestjs/common';
import { validationFailed } from '../common/validation-exception.js';
import type { Tx } from '../prisma/prisma.service.js';
import type { PartyRole } from './parties.dto.js';

/**
 * Loads a party that must hold `role`, for linking to new work (quotations, bookings, later
 * shipments). A missing party or a party without the role is a field error on `field`.
 */
export async function requirePartyWithRole(
  tx: Tx,
  id: number,
  role: PartyRole,
  field: string,
) {
  const party = await tx.orm.public.Party.first({ id });
  const holds =
    party !== null &&
    (await tx.orm.public.PartyRole.where({ partyId: id, role }).first()) !==
      null;
  if (!party || !holds) {
    throw validationFailed([
      { field, messages: [`Select an existing ${role}.`] },
    ]);
  }
  return party;
}

/**
 * Archived customers cannot receive new work (Phase 1 note in docs/backend-implementation-plan.md
 * §6). They must be restored first.
 */
export async function requireActiveCustomer(
  tx: Tx,
  id: number,
  field = 'customerId',
) {
  const customer = await requirePartyWithRole(tx, id, 'customer', field);
  if (customer.archivedAt !== null) {
    throw new ConflictException({
      message:
        'This customer is archived. Restore the customer before creating new work for them.',
      details: [{ field, messages: ['This customer is archived.'] }],
    });
  }
  return customer;
}
