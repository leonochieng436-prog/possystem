import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().min(1, "Customer name is required").max(160),
  phone: z.string().max(40).optional().or(z.literal("")),
  email: z.string().email("Enter a valid email").max(160).optional().or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
  category: z.enum(["NEW", "REGULAR", "VIP", "INACTIVE", "CREDIT"]),
  creditLimit: z.string().min(1).refine((value) => Number(value) >= 0, "Credit limit cannot be negative"),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export const customerPaymentSchema = z.object({
  customerId: z.string().min(1),
  amount: z.string().min(1).refine((value) => Number(value) > 0, "Payment must be greater than zero"),
  method: z.enum(["cash", "mpesa", "bank", "card", "other"]),
  reference: z.string().max(100).optional().or(z.literal("")),
});

export const returnSchema = z.object({
  saleId: z.string().min(1),
  reason: z.string().max(300).optional().or(z.literal("")),
  refundMethod: z.enum(["cash", "store_credit", "original_payment_method"]),
  items: z.array(z.object({ saleItemId: z.string().min(1), quantity: z.string().min(1).refine((value) => Number(value) > 0) })).min(1),
});
