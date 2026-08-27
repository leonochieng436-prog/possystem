import { z } from "zod";

export const saleSchema = z.object({
  branchId: z.string().min(1),
  registerId: z.string().min(1),
  warehouseId: z.string().min(1),
  customerId: z.string().optional().or(z.literal("")),
  paymentMethod: z.enum(["CASH", "MPESA", "CARD", "BANK_TRANSFER", "CREDIT", "OTHER"]),
  amountPaid: z.string().min(1).refine((value) => Number(value) >= 0),
  payments: z.array(z.object({ method: z.enum(["CASH", "MPESA", "CARD", "BANK_TRANSFER", "CREDIT", "OTHER"]), amount: z.string().min(1).refine((value) => Number(value) >= 0) })).min(1).max(2).optional(),
  items: z.array(z.object({ variantId: z.string().min(1), quantity: z.string().min(1).refine((value) => Number(value) > 0) })).min(1),
});
export type SaleInput = z.infer<typeof saleSchema>;

export const cashSessionSchema = z.object({ branchId: z.string().min(1), registerId: z.string().min(1), openingBalance: z.string().min(1).refine((value) => Number(value) >= 0) });
export const closeCashSessionSchema = z.object({
  sessionId: z.string().min(1),
  actualBalance: z.string().min(1).refine((value) => Number(value) >= 0),
  cashRemoved: z.string().min(1).refine((value) => Number(value) >= 0).default("0"),
  varianceReason: z.string().max(80).optional().or(z.literal("")),
  closingNote: z.string().max(500).optional().or(z.literal("")),
  denominationCounts: z.record(z.string(), z.string()).optional(),
});
