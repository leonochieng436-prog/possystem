import type { ReceiptData } from "@/lib/receipts/receipt-types";
import { formatMoney, formatNumber } from "@/lib/receipts/receipt-utils";

export function ReceiptItems({ receipt }: { receipt: ReceiptData }) {
  return <section className="receipt-items"><table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>{receipt.items.map((item) => <tr key={item.id}><td><strong>{item.productName}</strong>{item.variantName && item.variantName !== item.productName && <small>{item.variantName}</small>}{receipt.settings.showSku && item.sku && <small>SKU: {item.sku}</small>}</td><td>{formatNumber(item.quantity)}</td><td>{formatMoney(item.unitPrice)}</td><td>{formatMoney(item.total)}</td></tr>)}</tbody></table></section>;
}
