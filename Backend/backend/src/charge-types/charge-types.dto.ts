import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { PERCENT_PATTERN } from '../common/decimal-fields.js';
import {
  TAX_CATEGORIES,
  type TaxCategory,
} from '../quotations/quotations.dto.js';

/** Tax settings an administrator may change on a charge type. Send at least one. */
export class UpdateChargeTypeTaxDto {
  @IsOptional()
  @IsIn(TAX_CATEGORIES, { message: 'Select a tax category.' })
  defaultTaxCategory?: TaxCategory;

  @IsOptional()
  @IsString({ message: 'Send the tax rate as a decimal string.' })
  @Matches(PERCENT_PATTERN, { message: 'Enter a rate such as 0 or 16.' })
  defaultTaxRate?: string;
}
