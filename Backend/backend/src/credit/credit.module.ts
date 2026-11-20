import { Module } from '@nestjs/common';
import { CreditService } from './credit.service.js';

/** Credit-limit checks, used at booking (Phase 2) and later at invoicing. */
@Module({
  providers: [CreditService],
  exports: [CreditService],
})
export class CreditModule {}
