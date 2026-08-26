import { ReceiptActions } from "../../receipt-actions";
import { ReceiptEditForm } from "../../receipt-edit-form";
import { buildReceiptData } from "@/lib/receipts/receipt-data";
import { ReceiptHeader } from "./receipt-header";
import { ReceiptItems } from "./receipt-items";
import { ReceiptTotals } from "./receipt-totals";
import { ReceiptPayments } from "./receipt-payments";
import { ReceiptFooter } from "./receipt-footer";

type ReceiptData = {
  id: string;
  organization: { name: string; legalName: string | null; address: string | null; phone: string | null; email: string | null; taxPin: string | null; logoUrl: string | null };
  branch: { name: string };
  register: { name: string };
  cashier: { name: string };
  customer: { name: string; phone: string | null } | null;
  receiptNumber: string;
  createdAt: Date;
  subtotal: unknown;
  discountTotal: unknown;
  taxTotal: unknown;
  total: unknown;
  amountPaid: unknown;
  changeGiven: unknown;
  notes: string | null;
  items: { id: string; productNameSnapshot: string | null; variantNameSnapshot: string | null; skuSnapshot: string | null; quantity: unknown; unitPrice: unknown; discount: unknown; taxAmount: unknown; total: unknown; variant: { sku: string; name: string; product: { name: string } } }[];
  payments: { method: string; amount: unknown; providerRef: string | null }[];
};
type ReceiptSettings = { paperSize: string; showBusinessLogo: boolean; showCashier: boolean; showCustomer: boolean; showSku: boolean; showTax: boolean; showDiscount: boolean; showPaymentReference: boolean; footerMessage: string | null } | null;

export function ReceiptView({ sale, settings }: { sale: ReceiptData; settings: ReceiptSettings }) {
  const receipt = buildReceiptData(sale, settings);
  return <div className={`receipt-sheet receipt-${receipt.settings.paperSize}`}>
    <div className="receipt-toolbar print:hidden"><ReceiptActions saleId={receipt.id} /></div>
    <ReceiptHeader receipt={receipt} />
    <ReceiptItems receipt={receipt} />
    <ReceiptTotals receipt={receipt} />
    <ReceiptPayments receipt={receipt} />
    <ReceiptFooter receipt={receipt} />
    <div className="print:hidden receipt-edit"><ReceiptEditForm saleId={receipt.id} notes={receipt.notes} /></div>
  </div>;
}
