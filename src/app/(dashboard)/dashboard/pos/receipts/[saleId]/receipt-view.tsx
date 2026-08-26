import { ReceiptActions } from "../../receipt-actions";
import { ReceiptEditForm } from "../../receipt-edit-form";

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
  items: { id: string; quantity: unknown; unitPrice: unknown; discount: unknown; taxAmount: unknown; total: unknown; variant: { sku: string; name: string; product: { name: string } } }[];
  payments: { method: string; amount: unknown; providerRef: string | null }[];
};
type ReceiptSettings = { paperSize: string; showBusinessLogo: boolean; showCashier: boolean; showCustomer: boolean; showSku: boolean; showTax: boolean; showDiscount: boolean; showPaymentReference: boolean; footerMessage: string | null } | null;

const formatMoney = (value: unknown) => `KES ${Number(value ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const paymentLabel = (method: string) => ({ MPESA: "M-Pesa", BANK_TRANSFER: "Bank transfer", CASH: "Cash", CARD: "Card", CREDIT: "Credit" }[method] ?? method);

export function ReceiptView({ sale, settings }: { sale: ReceiptData; settings: ReceiptSettings }) {
  const showTax = settings?.showTax !== false && Number(sale.taxTotal) > 0;
  const showDiscount = settings?.showDiscount !== false && Number(sale.discountTotal) > 0;
  return <div className={`receipt-sheet receipt-${settings?.paperSize ?? "80mm"}`}>
    <div className="receipt-toolbar print:hidden"><ReceiptActions saleId={sale.id} /></div>
    <header className="receipt-header">{settings?.showBusinessLogo !== false && sale.organization.logoUrl && <img src={sale.organization.logoUrl} alt="" className="receipt-logo" />}<h1>{sale.organization.name}</h1>{sale.organization.legalName && <p>{sale.organization.legalName}</p>}{sale.organization.address && <p>{sale.organization.address}</p>}<p>{[sale.organization.phone, sale.organization.email].filter(Boolean).join(" · ")}</p>{sale.organization.taxPin && <p>PIN: {sale.organization.taxPin}</p>}<div className="receipt-title">SALES RECEIPT</div></header>
    <section className="receipt-meta"><div><span>Receipt No</span><strong>{sale.receiptNumber}</strong></div><div><span>Date</span><strong>{sale.createdAt.toLocaleString("en-KE")}</strong></div><div><span>Branch</span><strong>{sale.branch.name}</strong></div><div><span>Register</span><strong>{sale.register.name}</strong></div>{settings?.showCashier !== false && <div><span>Cashier</span><strong>{sale.cashier.name}</strong></div>}{settings?.showCustomer !== false && <div><span>Customer</span><strong>{sale.customer?.name ?? "Walk-in customer"}{sale.customer?.phone && ` · ${sale.customer.phone}`}</strong></div>}</section>
    <table className="receipt-items"><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>{sale.items.map((item) => <tr key={item.id}><td><strong>{item.variant.product.name}</strong>{item.variant.name !== item.variant.product.name && <small>{item.variant.name}</small>}{settings?.showSku !== false && <small>{item.variant.sku}</small>}</td><td>{Number(item.quantity)}</td><td>{Number(item.unitPrice).toFixed(2)}</td><td>{Number(item.total).toFixed(2)}</td></tr>)}</tbody></table>
    <section className="receipt-totals"><div><span>Subtotal</span><strong>{formatMoney(sale.subtotal)}</strong></div>{showDiscount && <div><span>Discount</span><strong>- {formatMoney(sale.discountTotal)}</strong></div>}{showTax && <div><span>Tax</span><strong>{formatMoney(sale.taxTotal)}</strong></div>}<div className="receipt-grand-total"><span>TOTAL</span><strong>{formatMoney(sale.total)}</strong></div></section>
    <section className="receipt-payment"><h2>PAYMENT</h2>{sale.payments.map((payment) => <div key={`${payment.method}-${String(payment.amount)}`}><span>{paymentLabel(payment.method)}{settings?.showPaymentReference !== false && payment.providerRef ? ` · ${payment.providerRef}` : ""}</span><strong>{formatMoney(payment.amount)}</strong></div>)}<div><span>Amount paid</span><strong>{formatMoney(sale.amountPaid)}</strong></div>{Number(sale.changeGiven) > 0 && <div><span>Change</span><strong>{formatMoney(sale.changeGiven)}</strong></div>}</section>
    {sale.notes && <p className="receipt-note">Note: {sale.notes}</p>}
    <footer className="receipt-footer"><p>{settings?.footerMessage ?? "Thank you for shopping with us!"}</p><p>Powered by DUKAOS</p></footer>
    <div className="print:hidden receipt-edit"><ReceiptEditForm saleId={sale.id} notes={sale.notes} /></div>
  </div>;
}
