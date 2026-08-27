"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { requireAuthContext, assertPermission, assertOwner, assertBranchAccess, AuthError } from "@/server/auth/context";
import { recordAudit } from "@/server/services/audit";
import { increaseStock } from "@/server/services/inventory";
import {
  createCategorySchema,
  createBrandSchema,
  createProductSchema,
  updateProductSchema,
  addVariantSchema,
} from "@/lib/validation/products";
import type { ActionResult } from "./auth";

export async function createCategory(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuthContext();
    assertPermission(ctx, "PRODUCTS_CREATE");

    const parsed = createCategorySchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    if (parsed.data.parentId && !(await ctx.db.category.findFirst({ where: { id: parsed.data.parentId } }))) {
      return { ok: false, error: "Parent category not found." };
    }

    const category = await ctx.db.category.create({
      data: {
        organizationId: ctx.organizationId,
        name: parsed.data.name,
        parentId: parsed.data.parentId || null,
      },
    });

    revalidatePath("/dashboard/products");
    return { ok: true, data: { id: category.id } };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function createBrand(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuthContext();
    assertPermission(ctx, "PRODUCTS_CREATE");

    const parsed = createBrandSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const brand = await ctx.db.brand.create({ data: { organizationId: ctx.organizationId, name: parsed.data.name } });

    revalidatePath("/dashboard/products");
    return { ok: true, data: { id: brand.id } };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    throw e;
  }
}

/**
 * Creates a product with its first variant, and — if an opening warehouse
 * and quantity were given — records that opening stock as a proper
 * `OPENING_BALANCE` inventory movement (never a bare quantity write; see
 * DATABASE.md).
 */
export async function createProduct(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuthContext();
    assertPermission(ctx, "PRODUCTS_CREATE");

    const parsed = createProductSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please fix the errors below.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    const input = parsed.data;

    const [category, brand, supplier, taxRate, warehouse] = await Promise.all([
      input.categoryId ? ctx.db.category.findFirst({ where: { id: input.categoryId } }) : null,
      input.brandId ? ctx.db.brand.findFirst({ where: { id: input.brandId } }) : null,
      input.primarySupplierId ? ctx.db.supplier.findFirst({ where: { id: input.primarySupplierId } }) : null,
      input.taxRateId ? ctx.db.taxRate.findFirst({ where: { id: input.taxRateId } }) : null,
      input.openingWarehouseId ? ctx.db.warehouse.findFirst({ where: { id: input.openingWarehouseId, isActive: true } }) : null,
    ]);
    if (input.categoryId && !category) return { ok: false, error: "Category not found." };
    if (input.brandId && !brand) return { ok: false, error: "Brand not found." };
    if (input.primarySupplierId && !supplier) return { ok: false, error: "Supplier not found." };
    if (input.taxRateId && !taxRate) return { ok: false, error: "Tax rate not found." };
    if (input.openingWarehouseId && !warehouse) return { ok: false, error: "Opening warehouse not found." };
    if (warehouse) assertBranchAccess(ctx, warehouse.branchId);

    if (input.barcode) {
      const existingBarcode = await ctx.db.productBarcode.findFirst({
        where: { barcode: input.barcode, variant: { product: { organizationId: ctx.organizationId } } },
      });
      if (existingBarcode) {
        return {
          ok: false,
          error: "This barcode is already assigned to another product.",
          fieldErrors: { barcode: ["Already in use"] },
        };
      }
    }

    const productId = await ctx.db.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          organizationId: ctx.organizationId,
          name: input.name,
          description: input.description || null,
          categoryId: input.categoryId || null,
          brandId: input.brandId || null,
          primarySupplierId: input.primarySupplierId || null,
          unit: input.unit,
          type: input.type,
          trackExpiry: input.trackExpiry,
          imageUrl: input.imageUrl || null,
        },
      });

      const variant = await tx.productVariant.create({
        data: {
          productId: product.id,
          sku: input.sku,
          name: product.name,
          costPrice: input.costPrice,
          sellingPrice: input.sellingPrice,
          wholesalePrice: input.wholesalePrice || null,
          taxRateId: input.taxRateId || null,
          minStock: input.minStock,
          reorderLevel: input.reorderLevel,
        },
      });

      if (input.barcode) {
        await tx.productBarcode.create({
          data: { variantId: variant.id, barcode: input.barcode },
        });
      }

      if (input.openingWarehouseId && Number(input.openingQuantity) > 0) {
        await increaseStock(tx as unknown as Prisma.TransactionClient, {
          organizationId: ctx.organizationId,
          warehouseId: input.openingWarehouseId,
          variantId: variant.id,
          quantity: input.openingQuantity!,
          unitCost: input.costPrice,
          type: "OPENING_BALANCE",
          reason: "Opening balance at product creation",
          createdById: ctx.userId,
          referenceType: "ProductCreation",
          referenceId: product.id,
        });
      }

      return product.id;
    });

    await recordAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "PRODUCT_CREATED",
      entityType: "Product",
      entityId: productId,
      metadata: { name: input.name, sku: input.sku },
    });

    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/inventory");
    return { ok: true, data: { id: productId } };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function updateProduct(raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const ctx = await requireAuthContext();
    assertPermission(ctx, "PRODUCTS_UPDATE");
    const parsed = updateProductSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please fix the errors below.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    const input = parsed.data;
    const product = await ctx.db.product.findFirst({ where: { id: input.productId } });
    if (!product) return { ok: false, error: "Product not found." };
    const [category, brand, supplier] = await Promise.all([
      input.categoryId ? ctx.db.category.findFirst({ where: { id: input.categoryId } }) : null,
      input.brandId ? ctx.db.brand.findFirst({ where: { id: input.brandId } }) : null,
      input.primarySupplierId ? ctx.db.supplier.findFirst({ where: { id: input.primarySupplierId } }) : null,
    ]);
    if (input.categoryId && !category) return { ok: false, error: "Category not found." };
    if (input.brandId && !brand) return { ok: false, error: "Brand not found." };
    if (input.primarySupplierId && !supplier) return { ok: false, error: "Supplier not found." };

    await ctx.db.product.update({
      where: { id: input.productId },
      data: {
        name: input.name,
        description: input.description || null,
        categoryId: input.categoryId || null,
        brandId: input.brandId || null,
        primarySupplierId: input.primarySupplierId || null,
        unit: input.unit,
        type: input.type,
        trackExpiry: input.trackExpiry,
        imageUrl: input.imageUrl || null,
      },
    });

    await recordAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "PRODUCT_UPDATED",
      entityType: "Product",
      entityId: input.productId,
      metadata: { name: input.name },
    });
    revalidatePath("/dashboard/products");
    revalidatePath(`/dashboard/products/${input.productId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function deleteProduct(productId: string): Promise<ActionResult<undefined>> {
  try {
    const ctx = await requireAuthContext();
    assertPermission(ctx, "PRODUCTS_DELETE");
    assertOwner(ctx);
    if (!productId) return { ok: false, error: "Product not found." };

    const product = await ctx.db.product.findFirst({ where: { id: productId } });
    if (!product) return { ok: false, error: "Product not found." };

    await ctx.db.product.update({ where: { id: productId }, data: { isActive: false } });
    await recordAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "PRODUCT_ARCHIVED",
      entityType: "Product",
      entityId: productId,
      metadata: { name: product.name },
    });
    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/inventory");
    return { ok: true, data: undefined };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    throw e;
  }
}

/** Adds an additional variant (e.g. a different size/color) to an existing product. */
export async function addProductVariant(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuthContext();
    assertPermission(ctx, "PRODUCTS_CREATE");

    const parsed = addVariantSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please fix the errors below.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    const input = parsed.data;

    const product = await ctx.db.product.findFirst({ where: { id: input.productId } });
    if (!product) {
      return { ok: false, error: "Product not found." };
    }
    if (input.taxRateId && !(await ctx.db.taxRate.findFirst({ where: { id: input.taxRateId } }))) return { ok: false, error: "Tax rate not found." };

    if (input.barcode) {
      const existingBarcode = await ctx.db.productBarcode.findFirst({
        where: { barcode: input.barcode, variant: { product: { organizationId: ctx.organizationId } } },
      });
      if (existingBarcode) {
        return {
          ok: false,
          error: "This barcode is already assigned to another product.",
          fieldErrors: { barcode: ["Already in use"] },
        };
      }
    }

    const attributes = Object.fromEntries(input.attributes.map((a) => [a.key, a.value]));

    const variant = await ctx.db.$transaction(async (tx) => {
      const v = await tx.productVariant.create({
        data: {
          productId: input.productId,
          sku: input.sku,
          name: input.name,
          attributes,
          costPrice: input.costPrice,
          sellingPrice: input.sellingPrice,
          wholesalePrice: input.wholesalePrice || null,
          taxRateId: input.taxRateId || null,
          minStock: input.minStock,
          reorderLevel: input.reorderLevel,
        },
      });

      if (input.barcode) {
        await tx.productBarcode.create({ data: { variantId: v.id, barcode: input.barcode } });
      }

      return v;
    });

    await recordAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "PRODUCT_VARIANT_ADDED",
      entityType: "ProductVariant",
      entityId: variant.id,
      metadata: { productId: input.productId, sku: input.sku },
    });

    revalidatePath(`/dashboard/products/${input.productId}`);
    return { ok: true, data: { id: variant.id } };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    throw e;
  }
}
