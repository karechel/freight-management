import { Module } from '@nestjs/common';
import { ReferencesController } from './references.controller.js';
import { ReferencesService } from './references.service.js';

@Module({
  controllers: [ReferencesController],
  providers: [ReferencesService],
  exports: [ReferencesService],
})
export class ReferencesModule {}
