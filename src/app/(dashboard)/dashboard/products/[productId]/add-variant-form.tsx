"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addProductVariant } from "@/app/actions/products";
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

export function AddVariantForm({
  productId,
  taxRates,
}: {
  productId: string;
  taxRates: { id: string; name: string; rate: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function handleSubmit(formData: FormData) {
    setError(null);
    setFieldErrors({});

    const attributeKeys = ["Size", "Color"];
    const attributes = attributeKeys
      .map((key) => ({ key, value: String(formData.get(`attr_${key}`) || "").trim() }))
      .filter((a) => a.value.length > 0);

    const payload = {
      productId,
      name: String(formData.get("name") || ""),
      sku: String(formData.get("sku") || ""),
      attributes,
      costPrice: String(formData.get("costPrice") || ""),
      sellingPrice: String(formData.get("sellingPrice") || ""),
      wholesalePrice: String(formData.get("wholesalePrice") || ""),
      taxRateId: String(formData.get("taxRateId") || ""),
      minStock: String(formData.get("minStock") || "0"),
      reorderLevel: String(formData.get("reorderLevel") || "0"),
      barcode: String(formData.get("barcode") || ""),
    };

    startTransition(async () => {
      const result = await addProductVariant(payload);
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      router.refresh();
      (document.getElementById("add-variant-form") as HTMLFormElement)?.reset();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a variant</CardTitle>
        <CardDescription>
          For products that come in different sizes or colors. Each variant
          has its own SKU, price, and stock level.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form id="add-variant-form" action={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-[var(--radius-sm)] bg-danger-tint px-3 py-2 text-[13px] text-danger">
              {error}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="v-name">Variant name</Label>
              <Input id="v-name" name="name" placeholder="Red / Large" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-sku">SKU</Label>
              <Input id="v-sku" name="sku" placeholder="TSHIRT-RED-L" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="attr_Size">Size (optional)</Label>
              <Input id="attr_Size" name="attr_Size" placeholder="L" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="attr_Color">Color (optional)</Label>
              <Input id="attr_Color" name="attr_Color" placeholder="Red" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-cost">Cost price</Label>
              <Input id="v-cost" name="costPrice" type="number" step="0.01" min="0" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-price">Selling price</Label>
              <Input id="v-price" name="sellingPrice" type="number" step="0.01" min="0" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-wholesale">Wholesale price (optional)</Label>
              <Input id="v-wholesale" name="wholesalePrice" type="number" step="0.01" min="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-barcode">Barcode (optional)</Label>
              <Input id="v-barcode" name="barcode" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-tax">Tax rate</Label>
              <select
                id="v-tax"
                name="taxRateId"
                className="h-9 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm"
              >
                <option value="">No tax</option>
                {taxRates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.rate}%)
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-reorder">Reorder level</Label>
              <Input
                id="v-reorder"
                name="reorderLevel"
                type="number"
                step="0.001"
                min="0"
                defaultValue="0"
              />
            </div>
          </div>
          {fieldErrors.sku && <p className="text-[12px] text-danger">{fieldErrors.sku[0]}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Adding…" : "Add variant"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
