import type { Numeric } from '@prisma/orm-postgres/target/codec-types';
import { hashPassword, MIN_PASSWORD_LENGTH } from '../auth/password.js';
import type { Db } from '../prisma/prisma.service.js';
import {
  CHARGE_TYPES,
  PERMISSIONS,
  REFERENCE_FORMATS,
  RETENTION_POLICIES,
  ROLE_PERMISSIONS,
  ROLES,
  type RoleCode,
} from './setup-data.js';

export interface SetupSummary {
  roles: number;
  permissions: number;
  grants: number;
  chargeTypes: number;
  retentionPolicies: number;
  referenceFormats: number;
  adminCreated: boolean;
}

/**
 * Adds the reference data every environment needs. Safe to re-run: it only adds what is missing,
 * so administrators' later changes (including removed permissions) are kept.
 */
export async function seedSetup(
  db: Db,
  admin: { email: string; password: string },
): Promise<SetupSummary> {
  const email = admin.email.trim().toLowerCase();
  if (!email.includes('@')) throw new Error('ADMIN_EMAIL must be an email.');
  if (admin.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }
  // Hashing is slow, so it stays outside the transaction.
  const passwordHash = await hashPassword(admin.password);

  return db.transaction(async (tx) => {
    const { orm } = tx;
    const summary: SetupSummary = {
      roles: 0,
      permissions: 0,
      grants: 0,
      chargeTypes: 0,
      retentionPolicies: 0,
      referenceFormats: 0,
      adminCreated: false,
    };

    const roleIds = new Map<string, number>();
    const newRoles = new Set<string>();
    for (const { code, name } of ROLES) {
      let role = await orm.public.Role.where({ code }).first();
      if (!role) {
        role = await orm.public.Role.create({
          code,
          name,
          description: null,
          createdAt: new Date(),
        });
        newRoles.add(code);
        summary.roles += 1;
      }
      roleIds.set(code, role.id);
    }

    const permissionIds = new Map<string, number>();
    const newPermissions = new Set<string>();
    for (const [code, description] of Object.entries(PERMISSIONS)) {
      let permission = await orm.public.Permission.where({ code }).first();
      if (!permission) {
        permission = await orm.public.Permission.create({ code, description });
        newPermissions.add(code);
        summary.permissions += 1;
      }
      permissionIds.set(code, permission.id);
    }

    // Grant only for new roles or new permissions, so removed grants stay removed.
    for (const [role, codes] of Object.entries(ROLE_PERMISSIONS)) {
      for (const code of codes) {
        if (!newRoles.has(role) && !newPermissions.has(code)) continue;
        await orm.public.RolePermission.create({
          roleId: roleIds.get(role as RoleCode)!,
          permissionId: permissionIds.get(code)!,
        });
        summary.grants += 1;
      }
    }

    for (const chargeType of CHARGE_TYPES) {
      const existing = await orm.public.ChargeType.where({
        code: chargeType.code,
      }).first();
      if (existing) continue;
      await orm.public.ChargeType.create({
        ...chargeType,
        defaultTaxRate: chargeType.defaultTaxRate as Numeric<5, 2>,
        isActive: true,
      });
      summary.chargeTypes += 1;
    }

    for (const policy of RETENTION_POLICIES) {
      const existing = await orm.public.RetentionPolicy.where({
        recordCategory: policy.recordCategory,
      }).first();
      if (existing) continue;
      await orm.public.RetentionPolicy.create({
        ...policy,
        updatedById: null,
        updatedAt: new Date(),
      });
      summary.retentionPolicies += 1;
    }

    for (const format of REFERENCE_FORMATS) {
      const existing = await orm.public.ReferenceFormat.where({
        documentType: format.documentType,
      }).first();
      if (existing) continue;
      await orm.public.ReferenceFormat.create({
        ...format,
        updatedById: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      summary.referenceFormats += 1;
    }

    const existingAdmin = await orm.public.User.where({ email }).first();
    if (!existingAdmin) {
      const user = await orm.public.User.create({
        email,
        name: 'Administrator',
        passwordHash,
        status: 'active',
        lastLoginAt: null,
        partyId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await orm.public.UserRole.create({
        userId: user.id,
        roleId: roleIds.get('admin')!,
      });
      summary.adminCreated = true;
    }
    return summary;
  });
}
