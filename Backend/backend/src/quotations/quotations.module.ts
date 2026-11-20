import { Module } from '@nestjs/common';
import { ReferencesModule } from '../references/references.module.js';
import { QuotationsController } from './quotations.controller.js';
import { QuotationsService } from './quotations.service.js';

@Module({
  imports: [ReferencesModule],
  controllers: [QuotationsController],
  providers: [QuotationsService],
  exports: [QuotationsService],
})
export class QuotationsModule {}
