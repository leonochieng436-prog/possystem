import { z } from "zod";

export const adjustStockSchema = z
  .object({
    warehouseId: z.string().min(1, "Select a warehouse"),
    variantId: z.string().min(1, "Select a product"),
    direction: z.enum(["INCREASE", "DECREASE"]),
    quantity: z
      .string()
      .min(1, "Quantity is required")
      .refine((v) => Number(v) > 0, "Quantity must be greater than zero"),
    type: z.enum(["ADJUSTMENT", "DAMAGE", "LOSS", "STOCK_COUNT"]),
    unitCost: z.string().optional().or(z.literal("")),
    reason: z.string().max(300).optional().or(z.literal("")),
  })
  .refine(
    (data) => data.direction === "DECREASE" || (data.unitCost && Number(data.unitCost) >= 0),
    { message: "Unit cost is required when increasing stock", path: ["unitCost"] }
  );
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
