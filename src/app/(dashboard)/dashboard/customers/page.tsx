import { requireAuthContext } from "@/server/auth/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Decimal from "decimal.js";
import { CustomerForm, CustomerPaymentForm } from "./customer-form";

export default async function CustomersPage() {
  const ctx = await requireAuthContext();
  const customers = await ctx.db.customer.findMany({ where: { isWalkIn: false }, include: { sales: { where: { isCreditSale: true, status: "COMPLETED" }, select: { total: true, amountPaid: true } }, payments: { select: { amount: true } } }, orderBy: { name: "asc" } });
  const options = customers.map((customer) => ({ id: customer.id, name: customer.name }));
  return <div className="space-y-6"><div><h1 className="text-lg font-semibold">Customers & credit</h1><p className="text-sm text-muted-foreground">Manage customer profiles, credit limits, and balances.</p></div><Card><CardHeader><CardTitle>Add customer</CardTitle></CardHeader><CardContent><CustomerForm /></CardContent></Card><Card><CardHeader><CardTitle>Record customer payment</CardTitle></CardHeader><CardContent><CustomerPaymentForm customers={options} /></CardContent></Card><Card><CardHeader><CardTitle>Customer balances</CardTitle></CardHeader><CardContent><div className="divide-y divide-border">{customers.map((customer) => { const credit = customer.sales.reduce((sum, sale) => sum.plus(sale.total.toString()).minus(sale.amountPaid.toString()), new Decimal(0)); const paid = customer.payments.reduce((sum, payment) => sum.plus(payment.amount.toString()), new Decimal(0)); const balance = credit.minus(paid); return <div key={customer.id} className="flex justify-between py-3 text-sm"><span><span className="font-medium">{customer.name}</span><span className="ml-2 text-muted-foreground">Limit KES {customer.creditLimit.toString()}</span></span><span className="font-tabular">KES {balance.toFixed(2)}</span></div>; })}</div></CardContent></Card></div>;
}
