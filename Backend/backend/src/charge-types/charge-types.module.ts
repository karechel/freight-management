import { Module } from '@nestjs/common';
import { ChargeTypesController } from './charge-types.controller.js';

@Module({ controllers: [ChargeTypesController] })
export class ChargeTypesModule {}
