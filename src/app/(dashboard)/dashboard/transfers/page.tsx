import { requireAuthContext } from "@/server/auth/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransferForm } from "./transfer-form";

export default async function TransfersPage() {
  const ctx = await requireAuthContext();
  const [branches, warehouses, variants] = await Promise.all([ctx.db.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }), ctx.db.warehouse.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }), ctx.db.productVariant.findMany({ where: { isActive: true, product: { isActive: true } }, include: { product: true }, orderBy: { product: { name: "asc" } } })]);
  return <div className="space-y-6"><div><h1 className="text-lg font-semibold">Branch transfers</h1><p className="text-sm text-muted-foreground">Move stock between warehouses with FIFO cost preservation.</p></div><Card><CardHeader><CardTitle>New transfer</CardTitle></CardHeader><CardContent><TransferForm branches={branches.map((item) => ({ id: item.id, name: item.name }))} warehouses={warehouses.map((item) => ({ id: item.id, name: item.name, branchId: item.branchId }))} variants={variants.map((item) => ({ id: item.id, label: `${item.product.name} (${item.sku})` }))} /></CardContent></Card></div>;
}
