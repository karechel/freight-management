import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
} from '@nestjs/common';
import type { Numeric } from '@prisma/orm-postgres/target/codec-types';
import { AuditService } from '../audit/audit.service.js';
import {
  CurrentUser,
  type Principal,
  RequirePermission,
} from '../auth/auth.decorators.js';
import { normalizeDecimal } from '../common/decimal-fields.js';
import { ParseIdPipe } from '../common/parse-id.pipe.js';
import { validationFailed } from '../common/validation-exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { taxRateProblem } from './charge-type-rules.js';
import { UpdateChargeTypeTaxDto } from './charge-types.dto.js';

/** Admin-only (seeded): changes the provisional tax defaults on charge types. */
export const MANAGE_TAX = 'settings.tax.manage';

type Percent = Numeric<5, 2>;

const view = (c: {
  id: number;
  code: string;
  name: string;
  category: string;
  defaultTaxCategory: string;
  defaultTaxRate: Percent;
  isDisbursement: boolean;
  isActive: boolean;
}) => ({
  id: c.id,
  code: c.code,
  name: c.name,
  category: c.category,
  defaultTaxCategory: c.defaultTaxCategory,
  defaultTaxRate: c.defaultTaxRate,
  isDisbursement: c.isDisbursement,
  isActive: c.isActive,
});

/**
 * The charge catalogue for quotation lines. Listing active charge types is open to every signed-in
 * user; the tax settings (every charge type, and changing their tax defaults) need `settings.tax.manage`.
 */
@Controller('charge-types')
export class ChargeTypesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list() {
    const rows = await this.prisma.client.orm.public.ChargeType.where({
      isActive: true,
    })
      .orderBy((c) => c.name.asc())
      .all();
    return rows.map(view);
  }

  /** Every charge type, active or not, for the tax settings page. */
  @RequirePermission(MANAGE_TAX)
  @Get('tax-settings')
  async taxSettings() {
    const rows = await this.prisma.client.orm.public.ChargeType.all();
    return rows.map(view).sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Changes a charge type's default tax category and rate. Saved quotation lines keep their own
   * values; only lines added afterwards pick up the new defaults. Every change is audited.
   */
  @RequirePermission(MANAGE_TAX)
  @Patch(':id/tax')
  async updateTax(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: UpdateChargeTypeTaxDto,
    @CurrentUser() user: Principal,
  ) {
    if (
      dto.defaultTaxCategory === undefined &&
      dto.defaultTaxRate === undefined
    ) {
      throw validationFailed([
        {
          field: 'defaultTaxCategory',
          messages: ['Send a tax category, a tax rate or both.'],
        },
      ]);
    }
    const rate =
      dto.defaultTaxRate === undefined
        ? undefined
        : (normalizeDecimal(dto.defaultTaxRate, 2) as Percent);
    const problem = rate === undefined ? null : taxRateProblem(rate);
    if (problem) {
      throw validationFailed([
        { field: 'defaultTaxRate', messages: [problem] },
      ]);
    }

    await this.prisma.client.transaction(async (tx) => {
      const before = await tx.orm.public.ChargeType.first({ id });
      if (!before) throw new NotFoundException('Record not found.');
      const patch = {
        ...(dto.defaultTaxCategory === undefined
          ? {}
          : { defaultTaxCategory: dto.defaultTaxCategory }),
        ...(rate === undefined ? {} : { defaultTaxRate: rate }),
      };
      const unchanged =
        (patch.defaultTaxCategory ?? before.defaultTaxCategory) ===
          before.defaultTaxCategory &&
        (patch.defaultTaxRate ?? before.defaultTaxRate) ===
          before.defaultTaxRate;
      if (unchanged) {
        throw new ConflictException(
          'These are already the tax settings for this charge type.',
        );
      }
      await tx.orm.public.ChargeType.where({ id }).update(patch);
      await this.audit.record(tx, {
        actorUserId: user.id,
        entityType: 'ChargeType',
        entityId: id,
        action: 'tax_update',
        summary: `${before.name} tax settings changed`,
        changes: {
          before: {
            defaultTaxCategory: before.defaultTaxCategory,
            defaultTaxRate: before.defaultTaxRate,
          },
          after: {
            defaultTaxCategory:
              patch.defaultTaxCategory ?? before.defaultTaxCategory,
            defaultTaxRate: patch.defaultTaxRate ?? before.defaultTaxRate,
          },
        },
      });
    });
    const row = await this.prisma.client.orm.public.ChargeType.first({ id });
    return view(row!);
  }
}
