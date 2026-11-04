import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  DOCUMENT_TYPES,
  RESET_POLICIES,
  TRANSPORT_MODES,
  type ContractDocumentType,
  type ContractResetPolicy,
  type ContractTransportMode,
} from './reference.types.js';

export class UpdateReferenceFormatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  template: string;

  @IsIn(RESET_POLICIES)
  resetPolicy: ContractResetPolicy;
}

export class PreviewReferenceFormatDto extends UpdateReferenceFormatDto {
  @IsIn(DOCUMENT_TYPES)
  documentType: ContractDocumentType;

  @IsOptional()
  @IsIn(TRANSPORT_MODES)
  mode?: ContractTransportMode;
}
