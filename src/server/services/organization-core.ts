import type { Prisma, PrismaClient } from "@prisma/client";
import {
  SYSTEM_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
} from "@/lib/rbac/permissions";

type Tx = Prisma.TransactionClient | PrismaClient;

const DEFAULT_EXPENSE_CATEGORIES = [
  "Rent",
  "Salaries",
  "Electricity",
  "Water",
  "Internet",
  "Transport",
  "Marketing",
  "Repairs",
  "Fuel",
  "Packaging",
  "Bank charges",
  "M-Pesa fees",
  "Other",
];

const DEFAULT_NOTIFICATION_EVENTS = [
  "LOW_STOCK",
  "OUT_OF_STOCK",
  "EXPIRING_STOCK",
  "LARGE_REFUND",
  "CASH_VARIANCE",
  "FAILED_PAYMENT",
];

export async function provisionDefaultSettings(tx: Tx, organizationId: string) {
  await tx.receiptSettings.upsert({
    where: { organizationId },
    update: {},
    create: { organizationId, footerMessage: "Thank you for shopping with us!" },
  });
  await tx.notificationSetting.createMany({
    data: DEFAULT_NOTIFICATION_EVENTS.map((eventKey) => ({ organizationId, eventKey })),
    skipDuplicates: true,
  });
}

export async function provisionSystemRoles(tx: Tx, organizationId: string) {
  const allPermissions = await tx.permission.findMany();
  const permissionIdByKey = new Map(allPermissions.map((p) => [p.key, p.id]));

  const rolesBySlug: Record<string, { id: string }> = {};

  for (const roleDef of SYSTEM_ROLES) {
    const role = await tx.role.create({
      data: {
        organizationId,
        name: roleDef.name,
        slug: roleDef.slug,
        isSystem: true,
      },
    });
    rolesBySlug[roleDef.slug] = role;

    const keys = DEFAULT_ROLE_PERMISSIONS[roleDef.slug] ?? [];
    const rolePermissionRows = keys
      .map((key) => permissionIdByKey.get(key))
      .filter((id): id is string => Boolean(id))
      .map((permissionId) => ({ roleId: role.id, permissionId }));

    if (rolePermissionRows.length > 0) {
      await tx.rolePermission.createMany({ data: rolePermissionRows });
    }
  }

  return rolesBySlug;
}

export async function provisionDefaultExpenseCategories(
  tx: Tx,
  organizationId: string
) {
  await tx.expenseCategory.createMany({
    data: DEFAULT_EXPENSE_CATEGORIES.map((name) => ({
      organizationId,
      name,
      isSystem: true,
    })),
  });
}

export async function provisionDefaultBranchStructure(
  tx: Tx,
  organizationId: string
) {
  const branch = await tx.branch.create({
    data: {
      organizationId,
      name: "Main Branch",
      code: "MAIN",
    },
  });

  const warehouse = await tx.warehouse.create({
    data: {
      branchId: branch.id,
      organizationId,
      name: "Main Warehouse",
      isDefault: true,
    },
  });

  const register = await tx.register.create({
    data: {
      branchId: branch.id,
      name: "Register 1",
    },
  });

  const taxRate = await tx.taxRate.create({
    data: {
      organizationId,
      name: "VAT 16%",
      rate: 16,
      isDefault: true,
    },
  });

  return { branch, warehouse, register, taxRate };
}