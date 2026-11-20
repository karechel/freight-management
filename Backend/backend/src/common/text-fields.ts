import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

// Shared DTO field decorators (moved unchanged from src/parties/parties.dto.ts in Phase 2).

export const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Blank means "no value": forms send empty strings, which are stored as null. */
export const blankToNull = ({ value }: { value: unknown }) => {
  const trimmed = trim({ value });
  return trimmed === '' ? null : trimmed;
};

/** A text value that may be left out or cleared. */
export const OptionalText = (maxLength: number) =>
  applyDecorators(
    Transform(blankToNull),
    IsOptional(),
    IsString(),
    MaxLength(maxLength),
  );

/** A required text value. On updates it may be left out, but never cleared. */
export const RequiredText = (maxLength: number, updating = false) =>
  applyDecorators(
    Transform(trim),
    ...(updating
      ? [ValidateIf((_: object, value: unknown) => value !== undefined)]
      : []),
    IsString(),
    IsNotEmpty({ message: 'This field is required.' }),
    MaxLength(maxLength),
  );
