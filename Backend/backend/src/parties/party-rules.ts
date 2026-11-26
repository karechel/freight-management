/** Fits the `Money` column, Numeric(14, 2). Negative amounts never match. */
export const MONEY_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;

export const PHONE_PATTERN = /^\+?[0-9(][0-9 ()-]{5,18}[0-9]$/;

/** The exact two-decimal text the database returns, so "1250.5" and "1250.50" compare as equal. */
export function normalizeMoney(value: string): string {
  const [whole, fraction = ''] = value.split('.');
  return `${whole.replace(/^0+(?=\d)/, '')}.${fraction.padEnd(2, '0')}`;
}

/** Makes user input match literally inside an ILIKE pattern, then matches it anywhere in the text. */
export function containsPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

/** Why a customer cannot receive new quotations or bookings, or null when they can. */
export type NewWorkBlock = 'archived' | 'on_hold' | 'closed';

/**
 * Archived, on-hold and closed customers cannot receive new quotations or bookings (repository
 * owner, 2026-11-26). Existing records stay readable; only the account status or archive changes.
 */
export function newWorkBlock(party: {
  archivedAt: Date | null;
  accountStatus: 'active' | 'on_hold' | 'closed';
}): NewWorkBlock | null {
  if (party.archivedAt !== null) return 'archived';
  if (party.accountStatus === 'on_hold') return 'on_hold';
  if (party.accountStatus === 'closed') return 'closed';
  return null;
}

export const NEW_WORK_BLOCK_MESSAGES: Record<NewWorkBlock, string> = {
  archived:
    'This customer is archived. Restore the customer before creating new work for them.',
  on_hold:
    'This customer is on hold, so new quotations and bookings are blocked. Management or an administrator must make the account active first.',
  closed:
    "This customer's account is closed, so new quotations and bookings are blocked. Management or an administrator must make the account active first.",
};

/** Open work found for a customer, by reference. */
export interface OpenWork {
  shipments: string[];
  bookings: string[];
  quotations: string[];
  /** Accepted quotations without a booking (repository owner, 2026-11-27, §17 question 18). */
  acceptedQuotations: string[];
}

/** Shows at most this many references per kind in the archive refusal. */
const LISTED = 5;

/**
 * Archiving is refused while a customer has undelivered shipments, pending or confirmed bookings,
 * or open quotations (repository owner, 2026-11-26). Returns the refusal, naming the records, or
 * null when the customer can be archived.
 */
export function archiveBlockers(open: OpenWork): {
  message: string;
  details: { field: string; messages: string[] }[];
} | null {
  const kinds = [
    ['shipments', 'undelivered shipment', open.shipments],
    ['bookings', 'pending or confirmed booking', open.bookings],
    ['quotations', 'open quotation', open.quotations],
    [
      'acceptedQuotations',
      'accepted quotation not yet booked',
      open.acceptedQuotations,
    ],
  ] as const;
  const details = kinds
    .filter(([, , references]) => references.length > 0)
    .map(([field, label, references]) => {
      const listed = references.slice(0, LISTED).join(', ');
      const more =
        references.length > LISTED
          ? ` and ${references.length - LISTED} more`
          : '';
      return {
        field,
        messages: [
          `${references.length} ${label}${references.length === 1 ? '' : 's'}: ${listed}${more}.`,
        ],
      };
    });
  if (details.length === 0) return null;
  return {
    message:
      'This customer has open work, so they cannot be archived yet. Deliver the shipments, complete or cancel the bookings, decline or let the open quotations expire, and convert or decline the accepted quotations first.',
    details,
  };
}
