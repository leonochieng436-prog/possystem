import type { ReceiptData } from "./receipt-types";
import { normalizePaperSize, toNumber } from "./receipt-utils";

type SaleItemLike = { id: string; productNameSnapshot: string | null; variantNameSnapshot: string | null; skuSnapshot: string | null; quantity: unknown; unitPrice: unknown; total: unknown; variant: { name: string; sku: string; product: { name: string } } };
type SaleLike = { id: string; receiptNumber: string; createdAt: Date; organization: ReceiptData["business"]; branch: { name: string }; register: { name: string }; cashier: { name: string }; customer: { name: string; phone: string | null } | null; items: SaleItemLike[]; subtotal: unknown; discountTotal: unknown; taxTotal: unknown; total: unknown; amountPaid: unknown; changeGiven: unknown; payments: { method: string; amount: unknown; providerRef: string | null }[]; notes: string | null };
type SettingsLike = { paperSize?: string | null; showBusinessLogo?: boolean | null; showCashier?: boolean | null; showCustomer?: boolean | null; showSku?: boolean | null; showTax?: boolean | null; showDiscount?: boolean | null; showPaymentReference?: boolean | null; footerMessage?: string | null } | null;

export function buildReceiptData(sale: SaleLike, settings: SettingsLike): ReceiptData {
  return {
    id: sale.id,
    business: { name: sale.organization.name, legalName: sale.organization.legalName, address: sale.organization.address, phone: sale.organization.phone, email: sale.organization.email, taxPin: sale.organization.taxPin, logoUrl: sale.organization.logoUrl },
    transaction: { receiptNumber: sale.receiptNumber, date: sale.createdAt, branch: sale.branch.name, register: sale.register.name, cashier: sale.cashier.name, customer: sale.customer?.name ?? "Walk-in Customer", customerPhone: sale.customer?.phone ?? null },
    items: sale.items.map((item) => ({ id: item.id, productName: item.productNameSnapshot ?? item.variant.product.name, variantName: item.variantNameSnapshot ?? item.variant.name, sku: item.skuSnapshot ?? item.variant.sku, quantity: toNumber(item.quantity), unitPrice: toNumber(item.unitPrice), total: toNumber(item.total) })),
    totals: { subtotal: toNumber(sale.subtotal), discount: toNumber(sale.discountTotal), tax: toNumber(sale.taxTotal), total: toNumber(sale.total), amountPaid: toNumber(sale.amountPaid), changeGiven: toNumber(sale.changeGiven) },
    payments: sale.payments.map((payment) => ({ method: payment.method, amount: toNumber(payment.amount), reference: payment.providerRef ?? null })),
    notes: sale.notes,
    settings: { paperSize: normalizePaperSize(settings?.paperSize), showBusinessLogo: settings?.showBusinessLogo !== false, showCashier: settings?.showCashier !== false, showCustomer: settings?.showCustomer !== false, showSku: settings?.showSku !== false, showTax: settings?.showTax !== false && toNumber(sale.taxTotal) > 0, showDiscount: settings?.showDiscount !== false && toNumber(sale.discountTotal) > 0, showPaymentReference: settings?.showPaymentReference !== false, footerMessage: settings?.footerMessage || "Thank you for shopping with us!" },
  };
}
