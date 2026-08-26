import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(1).max(80),
  parentId: z.string().optional().or(z.literal("")),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const createBrandSchema = z.object({
  name: z.string().min(1).max(80),
});
export type CreateBrandInput = z.infer<typeof createBrandSchema>;

const decimalString = (label: string, opts?: { allowZero?: boolean }) =>
  z
    .string()
    .min(1, `${label} is required`)
    .refine((v) => !Number.isNaN(Number(v)), `${label} must be a number`)
    .refine(
      (v) => (opts?.allowZero ? Number(v) >= 0 : Number(v) > 0),
      opts?.allowZero ? `${label} cannot be negative` : `${label} must be greater than zero`
    );

const imageDataUrl = z
  .string()
  .max(1_500_000, "Image must be smaller than 1 MB")
  .refine(
    (value) => value === "" || /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value),
    "Upload a JPG, PNG, WEBP, or GIF image"
  );

/**
 * Creates a product together with its first ("default") variant in one
 * step — the common case of a simple, non-variant product. Additional
 * variants (size/color) are added afterwards via `addVariantSchema`.
 */
export const createProductSchema = z.object({
  name: z.string().min(1, "Product name is required").max(160),
  description: z.string().max(2000).optional().or(z.literal("")),
  categoryId: z.string().optional().or(z.literal("")),
  brandId: z.string().optional().or(z.literal("")),
  primarySupplierId: z.string().optional().or(z.literal("")),
  unit: z.string().min(1).max(20).default("pc"),
  type: z.enum(["STOCKED", "SERVICE", "BUNDLE"]).default("STOCKED"),
  trackExpiry: z.boolean().default(false),
  imageUrl: imageDataUrl.optional().or(z.literal("")),

  sku: z.string().min(1, "SKU is required").max(60),
  barcode: z.string().max(60).optional().or(z.literal("")),
  costPrice: decimalString("Cost price", { allowZero: true }),
  sellingPrice: decimalString("Selling price"),
  wholesalePrice: z.string().optional().or(z.literal("")),
  taxRateId: z.string().optional().or(z.literal("")),
  minStock: decimalString("Minimum stock", { allowZero: true }).default("0"),
  reorderLevel: decimalString("Reorder level", { allowZero: true }).default("0"),

  openingWarehouseId: z.string().optional().or(z.literal("")),
  openingQuantity: z.string().optional().or(z.literal("")),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1, "Product name is required").max(160),
  description: z.string().max(2000).optional().or(z.literal("")),
  categoryId: z.string().optional().or(z.literal("")),
  brandId: z.string().optional().or(z.literal("")),
  primarySupplierId: z.string().optional().or(z.literal("")),
  unit: z.string().min(1).max(20),
  type: z.enum(["STOCKED", "SERVICE", "BUNDLE"]),
  trackExpiry: z.boolean(),
  imageUrl: imageDataUrl.optional().or(z.literal("")),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const addVariantSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1).max(160),
  sku: z.string().min(1).max(60),
  attributes: z
    .array(z.object({ key: z.string().min(1).max(40), value: z.string().min(1).max(80) }))
    .default([]),
  costPrice: decimalString("Cost price", { allowZero: true }),
  sellingPrice: decimalString("Selling price"),
  wholesalePrice: z.string().optional().or(z.literal("")),
  taxRateId: z.string().optional().or(z.literal("")),
  minStock: decimalString("Minimum stock", { allowZero: true }).default("0"),
  reorderLevel: decimalString("Reorder level", { allowZero: true }).default("0"),
  barcode: z.string().max(60).optional().or(z.literal("")),
});
export type AddVariantInput = z.infer<typeof addVariantSchema>;
