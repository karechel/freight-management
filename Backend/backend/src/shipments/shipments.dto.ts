import { applyDecorators } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { QUANTITY_PATTERN } from '../common/decimal-fields.js';
import { PaginationQueryDto } from '../common/pagination.dto.js';
import { OptionalText, RequiredText, trim } from '../common/text-fields.js';
import {
  DIRECTIONS,
  type Direction,
  type Mode,
} from '../quotations/quotations.dto.js';
import { TRANSPORT_MODES } from '../references/reference.types.js';
import {
  CONTAINER_TYPES,
  CUSTOMER_NOTIFICATIONS,
  DELAY_REASONS,
  ISSUE_STATUSES,
  ISSUE_TYPES,
  SEVERITIES,
  SHIPMENT_STATUSES,
  SHIPMENT_VIEWS,
  type ShipmentStatus,
  type ShipmentView,
} from './shipment-rules.js';

const ISO_MESSAGE = 'Send the time as an ISO 8601 date and time.';

/** An optional ISO 8601 time; null clears it on an update. */
const OptionalInstant = () =>
  applyDecorators(
    IsOptional(),
    IsISO8601({ strict: true }, { message: ISO_MESSAGE }),
  );

const OptionalId = (message: string) =>
  applyDecorators(IsOptional(), IsInt({ message }), Min(1));

const OptionalQuantity = applyDecorators(
  IsOptional(),
  IsString({ message: 'Send the value as a decimal string.' }),
  Matches(QUANTITY_PATTERN, {
    message: 'Enter a number with up to 3 decimal places, without commas.',
  }),
);

/** Details that can be given when a shipment is created and changed later. */
class ShipmentDetailsDto {
  @OptionalId('Send the carrier id as a whole number.')
  carrierId?: number | null;

  @OptionalId('Send the agent id as a whole number.')
  agentId?: number | null;

  @OptionalId('Select a staff member from the list.')
  assignedToId?: number | null;

  /** B/L, AWB, CMR or rail consignment number. */
  @OptionalText(60)
  transportDocRef?: string | null;

  @OptionalText(120)
  vesselOrFlight?: string | null;

  @OptionalText(60)
  voyageNumber?: string | null;

  @OptionalText(120)
  equipment?: string | null;

  @IsOptional()
  @IsInt({ message: 'Enter a whole number of packages.' })
  @Min(0)
  @Max(1_000_000)
  packages?: number | null;

  @OptionalQuantity
  grossWeightKg?: string | null;

  @OptionalQuantity
  volumeCbm?: string | null;

  @OptionalInstant()
  etd?: string | null;

  @OptionalInstant()
  eta?: string | null;

  @OptionalInstant()
  estimatedDeliveryAt?: string | null;
}

/**
 * A shipment from a confirmed booking (customer, mode, direction, route, cargo, carrier and agent
 * come from the booking unless given), or a standalone job such as clearing only.
 */
export class CreateShipmentDto extends ShipmentDetailsDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  bookingReference?: string;

  @IsOptional()
  @IsInt({ message: 'Select the customer.' })
  @Min(1)
  customerId?: number;

  @IsOptional()
  @IsIn(TRANSPORT_MODES, { message: 'Select the transport mode.' })
  mode?: Mode;

  @IsOptional()
  @IsIn(DIRECTIONS, { message: 'Select import, export or transit.' })
  direction?: Direction;

  @OptionalText(120)
  origin?: string;

  @OptionalText(120)
  destination?: string;

  @OptionalText(200)
  cargoDescription?: string;
}

/** Customer, mode and direction are fixed once a job exists (the reference carries the mode). */
export class UpdateShipmentDto extends ShipmentDetailsDto {
  @RequiredText(120, true)
  origin?: string;

  @RequiredText(120, true)
  destination?: string;

  @RequiredText(200, true)
  cargoDescription?: string;

  /** Corrections to recorded actual times; null clears one. */
  @OptionalInstant()
  atd?: string | null;

  @OptionalInstant()
  ata?: string | null;
}

export class ChangeStatusDto {
  @IsIn(SHIPMENT_STATUSES, { message: 'Select a status from the list.' })
  status: ShipmentStatus;

  @OptionalInstant()
  atd?: string | null;

  @OptionalInstant()
  ata?: string | null;

  @OptionalInstant()
  deliveredAt?: string | null;

  @OptionalText(500)
  note?: string | null;
}

export class UpdateMilestoneDto {
  /** Null marks the milestone as not done. */
  @OptionalInstant()
  actualAt?: string | null;

  @OptionalInstant()
  plannedAt?: string | null;

  @OptionalText(120)
  location?: string | null;

  @OptionalText(500)
  note?: string | null;
}

class IssueFieldsDto {
  @IsOptional()
  @IsIn(SEVERITIES, { message: 'Select low, medium or high.' })
  severity?: (typeof SEVERITIES)[number];

  @IsOptional()
  @IsIn(DELAY_REASONS, { message: 'Select a delay reason from the list.' })
  reason?: (typeof DELAY_REASONS)[number] | null;

  @RequiredText(1000, true)
  reasonDetail?: string;

  @OptionalInstant()
  identifiedAt?: string;

  @OptionalId('Select a milestone of this shipment.')
  affectedMilestoneId?: number | null;

  @OptionalInstant()
  originalExpectedAt?: string | null;

  @OptionalInstant()
  revisedExpectedAt?: string | null;

  @IsOptional()
  @IsBoolean({ message: 'Send true or false.' })
  affectsEta?: boolean;

  @OptionalId('Select a staff member from the list.')
  followUpUserId?: number | null;

  @OptionalText(500)
  nextAction?: string | null;

  @OptionalText(2000)
  notes?: string | null;

  @IsOptional()
  @IsIn(CUSTOMER_NOTIFICATIONS, {
    message: 'Select how the customer was informed.',
  })
  customerNotification?: (typeof CUSTOMER_NOTIFICATIONS)[number];

  @OptionalInstant()
  customerNotifiedAt?: string | null;
}

/** Severity, what happened and the date identified are required; the service checks them. */
export class CreateIssueDto extends IssueFieldsDto {
  @IsIn(ISSUE_TYPES, { message: 'Select the kind of issue.' })
  type: (typeof ISSUE_TYPES)[number];
}

export class UpdateIssueDto extends IssueFieldsDto {
  @IsOptional()
  @IsIn(ISSUE_STATUSES, { message: 'Select open, monitoring or resolved.' })
  status?: (typeof ISSUE_STATUSES)[number];

  @OptionalInstant()
  resolvedAt?: string | null;

  @OptionalText(1000)
  resolution?: string | null;
}

/** A note of what was done about an issue, kept in the shipment's history. */
export class IssueActionDto {
  @RequiredText(1000)
  note: string;

  @OptionalInstant()
  at?: string | null;
}

export class AddContainerDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.replace(/[\s-]/g, '').toUpperCase()
      : value,
  )
  @IsString({ message: 'Enter the container number.' })
  @Matches(/^[A-Z]{4}[0-9]{7}$/, {
    message: 'Enter four letters and seven digits, for example MSCU1234567.',
  })
  containerNumber: string;

  @IsIn(CONTAINER_TYPES, { message: 'Select the container type.' })
  type: (typeof CONTAINER_TYPES)[number];

  @OptionalText(40)
  sealNumber?: string | null;

  @OptionalQuantity
  grossWeightKg?: string | null;

  @IsOptional()
  @IsInt({ message: 'Enter a whole number of packages.' })
  @Min(0)
  @Max(1_000_000)
  packages?: number | null;
}

export class ListShipmentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(SHIPMENT_VIEWS)
  view?: ShipmentView;

  @IsOptional()
  @IsIn(SHIPMENT_STATUSES)
  status?: ShipmentStatus;

  @IsOptional()
  @IsIn(TRANSPORT_MODES)
  mode?: Mode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customerId?: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bookingReference?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
