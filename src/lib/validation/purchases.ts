import { z } from "zod";

const money = z.string().min(1).refine((value) => Number(value) >= 0, "Must be zero or greater");
const quantity = z.string().min(1).refine((value) => Number(value) > 0, "Must be greater than zero");

export const supplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required").max(160),
  companyName: z.string().max(160).optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  email: z.string().email("Enter a valid email").max(160).optional().or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
  taxPin: z.string().max(40).optional().or(z.literal("")),
  paymentTerms: z.string().max(80).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, "Select a supplier"),
  branchId: z.string().min(1, "Select a branch"),
  warehouseId: z.string().min(1, "Select a warehouse"),
  expectedDeliveryDate: z.string().optional().or(z.literal("")),
  items: z.array(z.object({
    variantId: z.string().min(1),
    quantity: quantity,
    unitCost: money,
  })).min(1, "Add at least one product"),
});

export const receivePurchaseSchema = z.object({
  purchaseOrderId: z.string().min(1),
  notes: z.string().max(500).optional().or(z.literal("")),
  items: z.array(z.object({
    purchaseOrderItemId: z.string().min(1),
    quantity: quantity,
    batchNumber: z.string().max(80).optional().or(z.literal("")),
    expiryDate: z.string().optional().or(z.literal("")),
  })).min(1),
});

export const supplierInvoiceSchema = z.object({
  supplierId: z.string().min(1),
  purchaseOrderId: z.string().optional().or(z.literal("")),
  invoiceNumber: z.string().min(1).max(80),
  amount: z.string().min(1).refine((value) => Number(value) > 0, "Must be greater than zero"),
  dueDate: z.string().optional().or(z.literal("")),
});

export const supplierPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.string().min(1).refine((value) => Number(value) > 0, "Must be greater than zero"),
  method: z.enum(["cash", "mpesa", "bank", "cheque"]),
  reference: z.string().max(100).optional().or(z.literal("")),
});

export type SupplierInput = z.infer<typeof supplierSchema>;
export type PurchaseOrderInput = z.infer<typeof purchaseOrderSchema>;
export type ReceivePurchaseInput = z.infer<typeof receivePurchaseSchema>;
