export type ReceiptPaperSize = "58mm" | "80mm" | "A4";

export type ReceiptItem = {
  id: string;
  productName: string;
  variantName: string | null;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type ReceiptData = {
  id: string;
  business: { name: string; legalName: string | null; address: string | null; phone: string | null; email: string | null; taxPin: string | null; logoUrl: string | null };
  transaction: { receiptNumber: string; date: Date; branch: string; register: string; cashier: string; customer: string; customerPhone: string | null };
  items: ReceiptItem[];
  totals: { subtotal: number; discount: number; tax: number; total: number; amountPaid: number; changeGiven: number };
  payments: { method: string; amount: number; reference: string | null }[];
  notes: string | null;
  settings: { paperSize: ReceiptPaperSize; showBusinessLogo: boolean; showCashier: boolean; showCustomer: boolean; showSku: boolean; showTax: boolean; showDiscount: boolean; showPaymentReference: boolean; footerMessage: string };
};
