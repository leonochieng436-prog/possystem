import { z } from "zod";

export const expenseSchema = z.object({
  categoryId: z.string().min(1),
  branchId: z.string().optional().or(z.literal("")),
  amount: z.string().min(1).refine((value) => Number(value) > 0, "Amount must be greater than zero"),
  description: z.string().min(1).max(300),
  incurredAt: z.string().optional().or(z.literal("")),
  paymentMethod: z.enum(["cash", "mpesa", "bank", "card", "other"]),
});
