import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PERCENT_PATTERN, QUANTITY_PATTERN } from '../common/decimal-fields.js';
import { PaginationQueryDto } from '../common/pagination.dto.js';
import { OptionalText, RequiredText, trim } from '../common/text-fields.js';
import { MONEY_PATTERN } from '../parties/party-rules.js';
import { TRANSPORT_MODES } from '../references/reference.types.js';
import {
  MAX_LINES,
  STORED_STATUSES,
  TARGET_STATUSES,
  type QuotationStatus,
  type TargetStatus,
} from './quotation-rules.js';

export const DIRECTIONS = ['import', 'export', 'transit'] as const;
export type Direction = (typeof DIRECTIONS)[number];
export type Mode = (typeof TRANSPORT_MODES)[number];

export const TAX_CATEGORIES = [
  'standard',
  'zero_rated',
  'exempt',
  'outside_vat',
] as const;
export type TaxCategory = (typeof TAX_CATEGORIES)[number];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'Enter a date as YYYY-MM-DD.';

const present = (_: object, value: unknown) => value !== undefined;

export class QuotationLineDto {
  @IsOptional()
  @IsInt({ message: 'Send the charge type id as a whole number.' })
  @Min(1)
  chargeTypeId?: number | null;

  @RequiredText(200)
  description: string;

  @IsString({ message: 'Send the quantity as a decimal string.' })
  @Matches(QUANTITY_PATTERN, {
    message: 'Enter a quantity with up to 3 decimal places.',
  })
  quantity: string;

  @IsString({ message: 'Send the unit price as a decimal string.' })
  @Matches(MONEY_PATTERN, {
    message: 'Enter an amount with up to 2 decimal places, without commas.',
  })
  unitPrice: string;

  /** Defaults to the charge type's tax category, or `standard` without one. */
  @IsOptional()
  @IsIn(TAX_CATEGORIES)
  taxCategory?: TaxCategory;

  @IsString({ message: 'Send the tax rate as a decimal string.' })
  @Matches(PERCENT_PATTERN, { message: 'Enter a rate such as 0 or 16.' })
  taxRate: string;
}

/** Header fields shared by create and update. */
class QuotationFieldsDto {
  @IsOptional()
  @IsInt({ message: 'Send the agent id as a whole number.' })
  @Min(1)
  agentId?: number | null;

  @OptionalText(20)
  incoterm?: string | null;

  @IsOptional()
  @IsInt({ message: 'Enter a whole number of packages.' })
  @Min(0)
  @Max(1_000_000)
  packages?: number | null;

  @IsOptional()
  @IsString({ message: 'Send the weight as a decimal string.' })
  @Matches(QUANTITY_PATTERN, {
    message: 'Enter a weight with up to 3 decimal places.',
  })
  grossWeightKg?: string | null;

  @IsOptional()
  @IsString({ message: 'Send the volume as a decimal string.' })
  @Matches(QUANTITY_PATTERN, {
    message: 'Enter a volume with up to 3 decimal places.',
  })
  volumeCbm?: string | null;

  @OptionalText(2000)
  terms?: string | null;

  @OptionalText(1000)
  internalNote?: string | null;
}

export class CreateQuotationDto extends QuotationFieldsDto {
  @IsInt({ message: 'Select the customer.' })
  @Min(1)
  customerId: number;

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

  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  issueDate: string;

  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  validUntil: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Add at least one line item.' })
  @ArrayMaxSize(MAX_LINES, {
    message: `Use ${MAX_LINES} line items or fewer.`,
  })
  @ValidateNested({ each: true })
  @Type(() => QuotationLineDto)
  lines: QuotationLineDto[];

  /** Reference of the quotation this one was copied from, if any. */
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  duplicatedFrom?: string;
}

export class UpdateQuotationDto extends QuotationFieldsDto {
  @ValidateIf(present)
  @IsInt({ message: 'Select the customer.' })
  @Min(1)
  customerId?: number;

  @ValidateIf(present)
  @IsIn(TRANSPORT_MODES, { message: 'Select the transport mode.' })
  mode?: Mode;

  @ValidateIf(present)
  @IsIn(DIRECTIONS, { message: 'Select import, export or transit.' })
  direction?: Direction;

  @RequiredText(120, true)
  origin?: string;

  @RequiredText(120, true)
  destination?: string;

  @RequiredText(200, true)
  cargoSummary?: string;

  @ValidateIf(present)
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  issueDate?: string;

  @ValidateIf(present)
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  validUntil?: string;

  /** When sent, replaces every line. */
  @ValidateIf(present)
  @IsArray()
  @ArrayMinSize(1, { message: 'Add at least one line item.' })
  @ArrayMaxSize(MAX_LINES, {
    message: `Use ${MAX_LINES} line items or fewer.`,
  })
  @ValidateNested({ each: true })
  @Type(() => QuotationLineDto)
  lines?: QuotationLineDto[];
}

export class ChangeQuotationStatusDto {
  @IsIn(TARGET_STATUSES, { message: 'Choose sent, accepted or declined.' })
  status: TargetStatus;

  @IsOptional()
  @IsISO8601(
    { strict: true },
    { message: 'Send the time as an ISO 8601 date and time.' },
  )
  sentAt?: string;

  @OptionalText(120)
  sentTo?: string | null;

  @IsOptional()
  @IsISO8601(
    { strict: true },
    { message: 'Send the time as an ISO 8601 date and time.' },
  )
  decidedAt?: string;

  @OptionalText(300)
  note?: string | null;
}

export class ListQuotationsQueryDto extends PaginationQueryDto {
  /** The status callers see, so `expired` finds draft and sent quotations past their validity. */
  @IsOptional()
  @IsIn(STORED_STATUSES)
  status?: QuotationStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customerId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  agentId?: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
