import { Module } from '@nestjs/common';
import { CreditModule } from '../credit/credit.module.js';
import { QuotationsModule } from '../quotations/quotations.module.js';
import { ReferencesModule } from '../references/references.module.js';
import {
  BookingsController,
  QuotationConversionController,
} from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';

@Module({
  imports: [ReferencesModule, CreditModule, QuotationsModule],
  controllers: [BookingsController, QuotationConversionController],
  providers: [BookingsService],
})
export class BookingsModule {}
