import type { ReceiptData } from "@/lib/receipts/receipt-types";
import { formatMoney } from "@/lib/receipts/receipt-utils";

export function ReceiptTotals({ receipt }: { receipt: ReceiptData }) {
  const { totals, settings } = receipt;
  return <section className="receipt-totals"><div><span>Subtotal</span><strong>{formatMoney(totals.subtotal)}</strong></div>{settings.showDiscount && totals.discount > 0 && <div><span>Discount</span><strong>- {formatMoney(totals.discount)}</strong></div>}{settings.showTax && totals.tax > 0 && <div><span>Tax</span><strong>{formatMoney(totals.tax)}</strong></div>}<div className="receipt-grand-total"><span>TOTAL</span><strong>{formatMoney(totals.total)}</strong></div></section>;
}
