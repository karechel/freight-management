// Repository owner, 2026-11-27 (CLAUDE.md §17 question 17): a pending booking whose customer is on
// hold or closed cannot be confirmed or credit-approved. The backend refuses both; these texts
// explain it on the booking page.

import type { CustomerNewWorkBlock } from './live-quotations';

export const heldBookingText: Partial<Record<CustomerNewWorkBlock, string>> = {
  on_hold:
    'This customer is on hold, so this booking cannot be confirmed or credit-approved. Management or an administrator must make the account active first. It can still be cancelled.',
  closed:
    "This customer's account is closed, so this booking cannot be confirmed or credit-approved. Management or an administrator must make the account active first. It can still be cancelled.",
};
