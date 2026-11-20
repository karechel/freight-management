import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { ChargeTypesModule } from './charge-types/charge-types.module.js';
import { PartiesModule } from './parties/parties.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { QuotationsModule } from './quotations/quotations.module.js';
import { ReferencesModule } from './references/references.module.js';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthModule,
    ReferencesModule,
    PartiesModule,
    ChargeTypesModule,
    QuotationsModule,
    BookingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
