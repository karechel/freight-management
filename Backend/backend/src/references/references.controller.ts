import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  CurrentUser,
  type Principal,
  RequirePermission,
} from '../auth/auth.decorators.js';
import {
  PreviewReferenceFormatDto,
  UpdateReferenceFormatDto,
} from './reference-format.dto.js';
import { ReferencesService } from './references.service.js';
import {
  DOCUMENT_TYPES,
  type ContractDocumentType,
} from './reference.types.js';

export const MANAGE_REFERENCES = 'settings.references.manage';

const documentTypes = Object.fromEntries(
  DOCUMENT_TYPES.map((type) => [type, type]),
);

@Controller('reference-formats')
export class ReferencesController {
  constructor(private readonly references: ReferencesService) {}

  @Get()
  list() {
    return this.references.listFormats();
  }

  @RequirePermission(MANAGE_REFERENCES)
  @Post('preview')
  @HttpCode(200)
  preview(@Body() dto: PreviewReferenceFormatDto) {
    return this.references.preview(
      dto.documentType,
      dto.template,
      dto.resetPolicy,
      dto.mode,
    );
  }

  @RequirePermission(MANAGE_REFERENCES)
  @Patch(':documentType')
  update(
    @Param('documentType', new ParseEnumPipe(documentTypes))
    documentType: ContractDocumentType,
    @Body() dto: UpdateReferenceFormatDto,
    @CurrentUser() user: Principal,
  ) {
    return this.references.updateFormat(
      documentType,
      dto.template,
      dto.resetPolicy,
      user.id,
    );
  }
}
