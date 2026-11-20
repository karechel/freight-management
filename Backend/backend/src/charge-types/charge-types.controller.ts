import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/** Read-only charge catalogue for quotation lines. Open to every signed-in user. */
@Controller('charge-types')
export class ChargeTypesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const rows = await this.prisma.client.orm.public.ChargeType.where({
      isActive: true,
    })
      .orderBy((c) => c.name.asc())
      .all();
    return rows.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      category: c.category,
      defaultTaxCategory: c.defaultTaxCategory,
      defaultTaxRate: c.defaultTaxRate,
      isDisbursement: c.isDisbursement,
    }));
  }
}
