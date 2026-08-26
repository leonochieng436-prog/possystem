import type { ReceiptData } from "@/lib/receipts/receipt-types";
import { formatDateTime } from "@/lib/receipts/receipt-utils";

export function ReceiptHeader({ receipt }: { receipt: ReceiptData }) {
  const { business, transaction, settings } = receipt;
  return <header className="receipt-header">{settings.showBusinessLogo && business.logoUrl && <img src={business.logoUrl} alt="" className="receipt-logo" />}<h1>{business.name}</h1>{business.legalName && business.legalName !== business.name && <p>{business.legalName}</p>}{business.address && <p>{business.address}</p>}{(business.phone || business.email) && <p>{[business.phone, business.email].filter(Boolean).join(" · ")}</p>}{business.taxPin && <p>PIN: {business.taxPin}</p>}<div className="receipt-title">SALES RECEIPT</div><section className="receipt-meta"><div><span>Receipt No</span><strong>{transaction.receiptNumber}</strong></div><div><span>Date</span><strong>{formatDateTime(transaction.date)}</strong></div><div><span>Branch</span><strong>{transaction.branch}</strong></div><div><span>Register</span><strong>{transaction.register}</strong></div>{settings.showCashier && <div><span>Cashier</span><strong>{transaction.cashier}</strong></div>}{settings.showCustomer && <div><span>Customer</span><strong>{transaction.customer}{transaction.customerPhone ? ` · ${transaction.customerPhone}` : ""}</strong></div>}</section></header>;
}
