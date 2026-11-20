import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CurrentUser,
  type Principal,
  RequirePermission,
} from '../auth/auth.decorators.js';
import {
  ChangeQuotationStatusDto,
  CreateQuotationDto,
  ListQuotationsQueryDto,
  UpdateQuotationDto,
} from './quotations.dto.js';
import {
  QUOTATIONS_MANAGE,
  QUOTATIONS_VIEW,
  QuotationsService,
} from './quotations.service.js';

/** Quotations are addressed by their reference, e.g. `/api/quotations/QT-2611-0001`. */
@Controller('quotations')
export class QuotationsController {
  constructor(private readonly quotations: QuotationsService) {}

  @RequirePermission(QUOTATIONS_VIEW)
  @Get()
  list(@Query() query: ListQuotationsQueryDto) {
    return this.quotations.list(query);
  }

  @RequirePermission(QUOTATIONS_VIEW)
  @Get(':reference')
  getOne(@Param('reference') reference: string) {
    return this.quotations.getOne(reference);
  }

  /** Also duplicates: send `duplicatedFrom` with the source quotation's reference. */
  @RequirePermission(QUOTATIONS_MANAGE)
  @Post()
  create(@Body() dto: CreateQuotationDto, @CurrentUser() user: Principal) {
    return this.quotations.create(dto, user);
  }

  @RequirePermission(QUOTATIONS_MANAGE)
  @Patch(':reference')
  update(
    @Param('reference') reference: string,
    @Body() dto: UpdateQuotationDto,
    @CurrentUser() user: Principal,
  ) {
    return this.quotations.update(reference, dto, user);
  }

  @RequirePermission(QUOTATIONS_MANAGE)
  @Post(':reference/status')
  @HttpCode(200)
  changeStatus(
    @Param('reference') reference: string,
    @Body() dto: ChangeQuotationStatusDto,
    @CurrentUser() user: Principal,
  ) {
    return this.quotations.changeStatus(reference, dto, user);
  }
}
