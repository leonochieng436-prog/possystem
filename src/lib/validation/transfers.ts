import { z } from "zod";

export const transferSchema = z.object({
  fromBranchId: z.string().min(1),
  toBranchId: z.string().min(1),
  fromWarehouseId: z.string().min(1),
  toWarehouseId: z.string().min(1),
  items: z.array(z.object({ variantId: z.string().min(1), quantity: z.string().min(1).refine((value) => Number(value) > 0) })).min(1),
}).refine((value) => value.fromBranchId !== value.toBranchId, "Choose different source and destination branches");
