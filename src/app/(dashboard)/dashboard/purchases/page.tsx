import { requireAuthContext } from "@/server/auth/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SupplierForm } from "./supplier-form";
import { PurchaseOrderForm } from "./purchase-order-form";
import { ReceiveForm } from "./receive-form";
import { InvoiceForm, PaymentForm } from "./invoice-forms";

export default async function PurchasesPage() {
  const ctx = await requireAuthContext();
  const [suppliers, branches, warehouses, variants, orders, invoices] = await Promise.all([
    ctx.db.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    ctx.db.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    ctx.db.warehouse.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    ctx.db.productVariant.findMany({ where: { isActive: true, product: { isActive: true } }, include: { product: true }, orderBy: { product: { name: "asc" } } }),
    ctx.db.purchaseOrder.findMany({ include: { supplier: true, branch: true, warehouse: true, items: { include: { variant: { include: { product: true } } } } }, orderBy: { createdAt: "desc" } }),
    ctx.db.supplierInvoice.findMany({ where: { status: { not: "PAID" } }, include: { supplier: true }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div><h1 className="text-lg font-semibold">Suppliers & purchases</h1><p className="text-sm text-muted-foreground">Manage suppliers, purchase orders, and received stock.</p></div>
      <Card><CardHeader><CardTitle>Add supplier</CardTitle></CardHeader><CardContent><SupplierForm /></CardContent></Card>
      <Card><CardHeader><CardTitle>Create purchase order</CardTitle></CardHeader><CardContent><PurchaseOrderForm suppliers={suppliers.map((item) => ({ id: item.id, name: item.name }))} branches={branches.map((item) => ({ id: item.id, name: item.name }))} warehouses={warehouses.map((item) => ({ id: item.id, name: item.name, branchId: item.branchId }))} variants={variants.map((item) => ({ id: item.id, label: `${item.product.name}${item.name !== item.product.name ? ` - ${item.name}` : ""} (${item.sku})`, cost: item.costPrice.toString() }))} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Supplier invoice</CardTitle></CardHeader><CardContent><InvoiceForm suppliers={suppliers.map((item) => ({ id: item.id, label: item.name }))} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Outstanding invoices</CardTitle></CardHeader><CardContent>{invoices.length === 0 ? <p className="text-sm text-muted-foreground">No outstanding invoices.</p> : <PaymentForm invoices={invoices.map((item) => ({ id: item.id, label: `${item.supplier.name} - ${item.invoiceNumber} (KES ${item.amount.toString()})` }))} />}</CardContent></Card>
      <Card><CardHeader><CardTitle>Purchase orders</CardTitle></CardHeader><CardContent className="space-y-4">{orders.length === 0 ? <p className="text-sm text-muted-foreground">No purchase orders yet.</p> : orders.map((order) => { const receiptItems = order.items.filter((item) => Number(item.quantityOrdered.toString()) > Number(item.quantityReceived.toString())).map((item) => ({ id: item.id, label: `${item.variant.product.name} (${item.variant.sku})`, remaining: (Number(item.quantityOrdered.toString()) - Number(item.quantityReceived.toString())).toString() })); return <div key={order.id} className="border-b border-border pb-4 last:border-0"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">{order.poNumber}</p><p className="text-[13px] text-muted-foreground">{order.supplier.name} · {order.branch.name} · {order.warehouse.name}</p></div><div className="flex items-center gap-3"><Badge>{order.status}</Badge><span className="font-tabular text-sm">KES {order.total.toString()}</span></div></div>{receiptItems.length > 0 && <ReceiveForm purchaseOrderId={order.id} items={receiptItems} />}</div>; })}</CardContent></Card>
    </div>
  );
}
