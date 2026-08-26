import type { ReceiptData } from "@/lib/receipts/receipt-types";
import { formatMoney, paymentLabel } from "@/lib/receipts/receipt-utils";

export function ReceiptPayments({ receipt }: { receipt: ReceiptData }) {
  const { totals, settings } = receipt;
  return <section className="receipt-payment"><h2>PAYMENT</h2>{receipt.payments.map((payment, index) => <div key={`${payment.method}-${index}`}><span>{paymentLabel(payment.method)}{settings.showPaymentReference && payment.reference ? ` · ${payment.reference}` : ""}</span><strong>{formatMoney(payment.amount)}</strong></div>)}<div><span>Amount Paid</span><strong>{formatMoney(totals.amountPaid)}</strong></div>{totals.changeGiven > 0 && <div><span>Change</span><strong>{formatMoney(totals.changeGiven)}</strong></div>}</section>;
}
