"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustStock } from "@/app/actions/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

type VariantOption = { id: string; label: string };
type WarehouseOption = { id: string; name: string };

const REASON_TYPES = [
  { value: "ADJUSTMENT", label: "Manual adjustment" },
  { value: "DAMAGE", label: "Damaged goods" },
  { value: "LOSS", label: "Lost / theft" },
  { value: "STOCK_COUNT", label: "Stock count correction" },
];

export function AdjustStockForm({
  variants,
  warehouses,
  initialVariantId,
}: {
  variants: VariantOption[];
  warehouses: WarehouseOption[];
  initialVariantId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<"INCREASE" | "DECREASE">("DECREASE");

  function handleSubmit(formData: FormData) {
    setError(null);
    const payload = {
      warehouseId: String(formData.get("warehouseId") || ""),
      variantId: String(formData.get("variantId") || ""),
      direction,
      quantity: String(formData.get("quantity") || ""),
      type: String(formData.get("type") || "ADJUSTMENT") as
        | "ADJUSTMENT"
        | "DAMAGE"
        | "LOSS"
        | "STOCK_COUNT",
      unitCost: String(formData.get("unitCost") || ""),
      reason: String(formData.get("reason") || ""),
    };

    startTransition(async () => {
      const result = await adjustStock(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      (document.getElementById("edit-inventory") as HTMLFormElement)?.reset();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit inventory</CardTitle>
        <CardDescription>
          Change stock on hand with an audited inventory correction. Historical
          movements remain unchanged.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form id="edit-inventory" action={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-[var(--radius-sm)] bg-danger-tint px-3 py-2 text-[13px] text-danger">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="warehouseId">Warehouse</Label>
              <select
                id="warehouseId"
                name="warehouseId"
                required
                className="h-9 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm"
              >
                <option value="">Select…</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="variantId">Product</Label>
              <select
                id="variantId"
                name="variantId"
                required
                defaultValue={initialVariantId ?? ""}
                className="h-9 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm"
              >
                <option value="">Select…</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDirection("DECREASE")}
              className={`flex-1 rounded-[var(--radius-sm)] border px-3 py-2 text-sm font-medium ${
                direction === "DECREASE"
                  ? "border-danger bg-danger-tint text-danger"
                  : "border-border-strong text-muted-foreground"
              }`}
            >
              Remove stock
            </button>
            <button
              type="button"
              onClick={() => setDirection("INCREASE")}
              className={`flex-1 rounded-[var(--radius-sm)] border px-3 py-2 text-sm font-medium ${
                direction === "INCREASE"
                  ? "border-success bg-success-tint text-success"
                  : "border-border-strong text-muted-foreground"
              }`}
            >
              Add stock
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="quantity">Quantity</Label>
              <Input id="quantity" name="quantity" type="number" step="0.001" min="0" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="type">Reason type</Label>
              <select
                id="type"
                name="type"
                className="h-9 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm"
              >
                {REASON_TYPES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {direction === "INCREASE" && (
            <div className="space-y-1.5">
              <Label htmlFor="unitCost">Unit cost (KES)</Label>
              <Input id="unitCost" name="unitCost" type="number" step="0.0001" min="0" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="reason">Note (optional)</Label>
            <Input id="reason" name="reason" placeholder="e.g. Found during shelf audit" />
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Apply adjustment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
