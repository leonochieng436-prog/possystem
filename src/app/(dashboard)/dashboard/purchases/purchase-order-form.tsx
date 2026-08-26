"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPurchaseOrder } from "@/app/actions/purchases";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Option = { id: string; name: string };
type Variant = { id: string; label: string; cost: string };
type Row = { variantId: string; quantity: string; unitCost: string };

export function PurchaseOrderForm({ suppliers, branches, warehouses, variants }: { suppliers: Option[]; branches: Option[]; warehouses: (Option & { branchId: string })[]; variants: Variant[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Row[]>([{ variantId: "", quantity: "1", unitCost: "" }]);

  function updateRow(index: number, key: keyof Row, value: string) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value, ...(key === "variantId" && !row.unitCost ? { unitCost: variants.find((item) => item.id === value)?.cost ?? "" } : {}) } : row));
  }

  function submit(formData: FormData) {
    setError("");
    const payload = { supplierId: String(formData.get("supplierId") || ""), branchId: String(formData.get("branchId") || ""), warehouseId: String(formData.get("warehouseId") || ""), expectedDeliveryDate: String(formData.get("expectedDeliveryDate") || ""), items: rows };
    startTransition(async () => {
      const result = await createPurchaseOrder(payload);
      if (!result.ok) return setError(result.error);
      setRows([{ variantId: "", quantity: "1", unitCost: "" }]);
      router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-4">
      {error && <p className="text-[13px] text-danger">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1"><Label htmlFor="po-supplier">Supplier</Label><select id="po-supplier" name="supplierId" required className="h-9 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm"><option value="">Select...</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="po-branch">Branch</Label><select id="po-branch" name="branchId" required className="h-9 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm"><option value="">Select...</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="po-warehouse">Warehouse</Label><select id="po-warehouse" name="warehouseId" required className="h-9 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm"><option value="">Select...</option>{warehouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      </div>
      <div className="space-y-2"><Label htmlFor="po-date">Expected delivery</Label><Input id="po-date" name="expectedDeliveryDate" type="date" className="sm:w-52" /></div>
      <div className="space-y-2">
        {rows.map((row, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_120px_140px_auto]"><select aria-label="Product" value={row.variantId} onChange={(event) => updateRow(index, "variantId", event.target.value)} className="h-9 rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm"><option value="">Select product...</option>{variants.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><Input aria-label="Quantity" type="number" min="0.001" step="0.001" value={row.quantity} onChange={(event) => updateRow(index, "quantity", event.target.value)} /><Input aria-label="Unit cost" type="number" min="0" step="0.01" value={row.unitCost} onChange={(event) => updateRow(index, "unitCost", event.target.value)} /><Button type="button" variant="secondary" size="sm" onClick={() => setRows((current) => current.length === 1 ? current : current.filter((_, rowIndex) => rowIndex !== index))}>Remove</Button></div>)}
      </div>
      <div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => setRows((current) => [...current, { variantId: "", quantity: "1", unitCost: "" }])}>Add line</Button><Button type="submit" disabled={pending}>{pending ? "Saving..." : "Create purchase order"}</Button></div>
    </form>
  );
}
