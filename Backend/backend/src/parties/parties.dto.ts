import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../common/pagination.dto.js';
import { MONEY_PATTERN, PHONE_PATTERN } from './party-rules.js';

export const PARTY_ROLES = [
  'customer',
  'agent',
  'supplier',
  'carrier',
  'transporter',
] as const;
export type PartyRole = (typeof PARTY_ROLES)[number];

export const ACCOUNT_STATUSES = ['active', 'on_hold', 'closed'] as const;
export type PartyAccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const ARCHIVED_FILTERS = ['exclude', 'only', 'include'] as const;
export type ArchivedFilter = (typeof ARCHIVED_FILTERS)[number];

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Blank means "no value": forms send empty strings, which are stored as null. */
const blankToNull = ({ value }: { value: unknown }) => {
  const trimmed = trim({ value });
  return trimmed === '' ? null : trimmed;
};

const upperCase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toUpperCase() : value;

/** A text value that may be left out or cleared. */
const OptionalText = (maxLength: number) =>
  applyDecorators(
    Transform(blankToNull),
    IsOptional(),
    IsString(),
    MaxLength(maxLength),
  );

/** A required text value. On updates it may be left out, but never cleared. */
const RequiredText = (maxLength: number, updating = false) =>
  applyDecorators(
    Transform(trim),
    ...(updating
      ? [ValidateIf((_: object, value: unknown) => value !== undefined)]
      : []),
    IsString(),
    IsNotEmpty({ message: 'This field is required.' }),
    MaxLength(maxLength),
  );

const OptionalEmail = () =>
  applyDecorators(
    Transform(blankToNull),
    IsOptional(),
    IsEmail({}, { message: 'Enter a valid email address.' }),
    MaxLength(254),
  );

const OptionalPhone = () =>
  applyDecorators(
    Transform(blankToNull),
    IsOptional(),
    IsString(),
    Matches(PHONE_PATTERN, { message: 'Enter a valid phone number.' }),
  );

export class ListPartiesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(PARTY_ROLES)
  role?: PartyRole;

  @IsOptional()
  @IsIn(ACCOUNT_STATUSES)
  status?: PartyAccountStatus;

  @IsOptional()
  @IsIn(ARCHIVED_FILTERS)
  archived: ArchivedFilter = 'exclude';

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

/** Fields anyone with `parties.manage` may change. */
class PartyDetailsDto {
  @OptionalText(200)
  legalName?: string | null;

  @Transform(blankToNull)
  @Transform(upperCase)
  @IsOptional()
  @IsString()
  // No fixed format for now, by decision: only a length limit, and uniqueness in the service.
  @MaxLength(20)
  kraPin?: string | null;

  @OptionalEmail()
  email?: string | null;

  @OptionalPhone()
  phone?: string | null;

  @OptionalText(500)
  address?: string | null;

  @OptionalText(100)
  city?: string | null;

  @OptionalText(100)
  country?: string | null;

  @OptionalText(2000)
  notes?: string | null;

  // The next two need `parties.billing.manage`, which the service checks.

  @IsOptional()
  @IsInt({ message: 'Payment terms must be a whole number of days.' })
  @Min(0, { message: 'Payment terms cannot be negative.' })
  @Max(365, { message: 'Payment terms cannot be more than 365 days.' })
  paymentTermsDays?: number | null;

  @IsOptional()
  @IsString({ message: 'Send the credit limit as a decimal string.' })
  @Matches(MONEY_PATTERN, {
    message:
      'Enter a credit limit of zero or more, with up to two decimal places.',
  })
  creditLimit?: string | null;

  // Needs `parties.status.manage`, which the service checks.
  @ValidateIf((_: object, value: unknown) => value !== undefined)
  @IsIn(ACCOUNT_STATUSES)
  accountStatus?: PartyAccountStatus;
}

export class CreatePartyDto extends PartyDetailsDto {
  @RequiredText(200)
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(PARTY_ROLES, { each: true })
  roles: PartyRole[];
}

export class UpdatePartyDto extends PartyDetailsDto {
  @RequiredText(200, true)
  name?: string;
}

export class CreateContactDto {
  @RequiredText(200)
  name: string;

  @OptionalText(200)
  title?: string | null;

  @OptionalEmail()
  email?: string | null;

  @OptionalPhone()
  phone?: string | null;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class UpdateContactDto {
  @RequiredText(200, true)
  name?: string;

  @OptionalText(200)
  title?: string | null;

  @OptionalEmail()
  email?: string | null;

  @OptionalPhone()
  phone?: string | null;

  @ValidateIf((_: object, value: unknown) => value !== undefined)
  @IsBoolean()
  isPrimary?: boolean;
}
