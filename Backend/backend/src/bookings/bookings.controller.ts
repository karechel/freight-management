import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  CurrentUser,
  type Principal,
  RequirePermission,
} from '../auth/auth.decorators.js';
import {
  QUOTATIONS_MANAGE,
  QUOTATIONS_VIEW,
} from '../quotations/quotations.service.js';
import { CREDIT_OVERRIDE } from '../credit/credit.service.js';
import {
  CancelBookingDto,
  ConvertQuotationDto,
  CreateBookingDto,
  CreditApprovalDto,
  ListBookingsQueryDto,
} from './bookings.dto.js';
import { BookingsService } from './bookings.service.js';

// Bookings use the quotation permissions, seeded as "View quotations and bookings" and
// "Create and edit quotations and bookings".

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @RequirePermission(QUOTATIONS_VIEW)
  @Get()
  list(@Query() query: ListBookingsQueryDto, @CurrentUser() user: Principal) {
    return this.bookings.list(query, user);
  }

  @RequirePermission(QUOTATIONS_VIEW)
  @Get(':reference')
  getOne(
    @Param('reference') reference: string,
    @CurrentUser() user: Principal,
  ) {
    return this.bookings.getOne(reference, user);
  }

  @RequirePermission(QUOTATIONS_MANAGE)
  @Post()
  create(@Body() dto: CreateBookingDto, @CurrentUser() user: Principal) {
    return this.bookings.create(dto, user);
  }

  @RequirePermission(QUOTATIONS_MANAGE)
  @Post(':reference/confirm')
  @HttpCode(200)
  confirm(
    @Param('reference') reference: string,
    @CurrentUser() user: Principal,
  ) {
    return this.bookings.confirm(reference, user);
  }

  /**
   * Approve or reject a booking awaiting credit approval (2026-11-20). Needs `credit.override`
   * (finance, management, admin), not `quotations.manage`: approvers decide on bookings that
   * others created.
   */
  @RequirePermission(CREDIT_OVERRIDE, QUOTATIONS_VIEW)
  @Post(':reference/credit-approval')
  @HttpCode(200)
  decideCreditApproval(
    @Param('reference') reference: string,
    @Body() dto: CreditApprovalDto,
    @CurrentUser() user: Principal,
  ) {
    return this.bookings.decideCreditApproval(reference, dto, user);
  }

  @RequirePermission(QUOTATIONS_MANAGE)
  @Post(':reference/cancel')
  @HttpCode(200)
  cancel(
    @Param('reference') reference: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: Principal,
  ) {
    return this.bookings.cancel(reference, dto, user);
  }
}

/** `POST /api/quotations/:reference/convert` creates the quotation's booking. */
@Controller('quotations')
export class QuotationConversionController {
  constructor(private readonly bookings: BookingsService) {}

  @RequirePermission(QUOTATIONS_MANAGE)
  @Post(':reference/convert')
  convert(
    @Param('reference') reference: string,
    @Body() dto: ConvertQuotationDto,
    @CurrentUser() user: Principal,
  ) {
    return this.bookings.convert(reference, dto, user);
  }
}
