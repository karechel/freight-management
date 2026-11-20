import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../common/pagination.dto.js';
import { OptionalText, RequiredText, trim } from '../common/text-fields.js';
import { MONEY_PATTERN } from '../parties/party-rules.js';
import { TRANSPORT_MODES } from '../references/reference.types.js';
import {
  DIRECTIONS,
  type Direction,
  type Mode,
} from '../quotations/quotations.dto.js';

export const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

const ISO_MESSAGE = 'Send the time as an ISO 8601 date and time.';

/** Sent after a credit-limit warning: proceed (needs `credit.override`) or stop. */
export class CreditDecisionDto {
  @IsIn(['proceed', 'blocked'], { message: 'Choose proceed or blocked.' })
  decision: 'proceed' | 'blocked';

  @RequiredText(500)
  reason: string;
}

/** Optional details staff may add when a booking is created. */
class BookingExtrasDto {
  @IsOptional()
  @IsInt({ message: 'Send the carrier id as a whole number.' })
  @Min(1)
  carrierId?: number | null;

  @OptionalText(60)
  carrierBookingNumber?: string | null;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: ISO_MESSAGE })
  plannedEtd?: string | null;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: ISO_MESSAGE })
  plannedEta?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreditDecisionDto)
  creditDecision?: CreditDecisionDto;
}

/** Converting an accepted quotation copies its customer, agent, route and cargo. */
export class ConvertQuotationDto extends BookingExtrasDto {}

/** A booking agreed without a quotation. */
export class CreateBookingDto extends BookingExtrasDto {
  @IsInt({ message: 'Select the customer.' })
  @Min(1)
  customerId: number;

  @IsOptional()
  @IsInt({ message: 'Send the agent id as a whole number.' })
  @Min(1)
  agentId?: number | null;

  @IsIn(TRANSPORT_MODES, { message: 'Select the transport mode.' })
  mode: Mode;

  @IsIn(DIRECTIONS, { message: 'Select import, export or transit.' })
  direction: Direction;

  @RequiredText(120)
  origin: string;

  @RequiredText(120)
  destination: string;

  @RequiredText(200)
  cargoSummary: string;

  /**
   * Estimated value of the work, used only for the credit-limit check (decided 2026-11-20).
   * Required when the customer has a credit limit; recorded in `CreditCheck`, not on the booking.
   */
  @IsOptional()
  @IsString({ message: 'Send the estimated value as a decimal string.' })
  @Matches(MONEY_PATTERN, {
    message: 'Enter an amount with up to 2 decimal places, without commas.',
  })
  estimatedValue?: string;
}

export class CancelBookingDto {
  @RequiredText(500)
  reason: string;
}

export class ListBookingsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(BOOKING_STATUSES)
  status?: BookingStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customerId?: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
