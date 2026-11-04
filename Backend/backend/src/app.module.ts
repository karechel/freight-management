import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { PartiesModule } from './parties/parties.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReferencesModule } from './references/references.module.js';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthModule,
    ReferencesModule,
    PartiesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
