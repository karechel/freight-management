import { ConflictException } from '@nestjs/common';
import { validationFailed } from '../common/validation-exception.js';
import type { Tx } from '../prisma/prisma.service.js';
import type { PartyRole } from './parties.dto.js';
import {
  NEW_WORK_BLOCK_MESSAGES,
  newWorkBlock,
  type NewWorkBlock,
} from './party-rules.js';

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

const BLOCK_FIELD_MESSAGES: Record<NewWorkBlock, string> = {
  archived: 'This customer is archived.',
  on_hold: 'This customer is on hold.',
  closed: "This customer's account is closed.",
};

/**
 * Archived customers (Phase 1) and on-hold or closed customers (repository owner, 2026-11-26)
 * cannot receive new quotations or bookings. The refusal explains the status and what must change.
 */
export async function requireActiveCustomer(
  tx: Tx,
  id: number,
  field = 'customerId',
) {
  const customer = await requirePartyWithRole(tx, id, 'customer', field);
  const block = newWorkBlock(customer);
  if (block !== null) {
    throw new ConflictException({
      message: NEW_WORK_BLOCK_MESSAGES[block],
      details: [{ field, messages: [BLOCK_FIELD_MESSAGES[block]] }],
    });
  }
  return customer;
}
