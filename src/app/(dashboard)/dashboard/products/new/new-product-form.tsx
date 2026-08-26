"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProduct, createCategory, createBrand } from "@/app/actions/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductImagePicker } from "../image-picker";

type Option = { id: string; name: string };

export function NewProductForm({
  categories,
  brands,
  suppliers,
  taxRates,
  warehouses,
}: {
  categories: Option[];
  brands: Option[];
  suppliers: Option[];
  taxRates: (Option & { rate: string })[];
  warehouses: Option[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [categoryList, setCategoryList] = useState(categories);
  const [brandList, setBrandList] = useState(brands);
  const [newCategory, setNewCategory] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [trackExpiry, setTrackExpiry] = useState(false);

  function handleAddCategory() {
    if (!newCategory.trim()) return;
    startTransition(async () => {
      const result = await createCategory({ name: newCategory.trim() });
      if (result.ok) {
        setCategoryList((prev) => [...prev, { id: result.data.id, name: newCategory.trim() }]);
        setNewCategory("");
      }
    });
  }

  function handleAddBrand() {
    if (!newBrand.trim()) return;
    startTransition(async () => {
      const result = await createBrand({ name: newBrand.trim() });
      if (result.ok) {
        setBrandList((prev) => [...prev, { id: result.data.id, name: newBrand.trim() }]);
        setNewBrand("");
      }
    });
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    setFieldErrors({});
    const payload = {
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || ""),
      categoryId: String(formData.get("categoryId") || ""),
      brandId: String(formData.get("brandId") || ""),
      primarySupplierId: String(formData.get("primarySupplierId") || ""),
      unit: String(formData.get("unit") || "pc"),
      type: "STOCKED" as const,
      trackExpiry,
      imageUrl: String(formData.get("imageUrl") || ""),
      sku: String(formData.get("sku") || ""),
      barcode: String(formData.get("barcode") || ""),
      costPrice: String(formData.get("costPrice") || ""),
      sellingPrice: String(formData.get("sellingPrice") || ""),
      wholesalePrice: String(formData.get("wholesalePrice") || ""),
      taxRateId: String(formData.get("taxRateId") || ""),
      minStock: String(formData.get("minStock") || "0"),
      reorderLevel: String(formData.get("reorderLevel") || "0"),
      openingWarehouseId: String(formData.get("openingWarehouseId") || ""),
      openingQuantity: String(formData.get("openingQuantity") || ""),
    };

    startTransition(async () => {
      const result = await createProduct(payload);
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      router.push(`/dashboard/products/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-[var(--radius-sm)] bg-danger-tint px-3 py-2 text-[13px] text-danger">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Basic information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Product name</Label>
            <Input id="name" name="name" placeholder="Coca-Cola 500ml" required />
            {fieldErrors.name && <p className="text-[12px] text-danger">{fieldErrors.name[0]}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <textarea
              id="description"
              name="description"
              rows={2}
              className="w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="categoryId">Category</Label>
              <select
                id="categoryId"
                name="categoryId"
                className="h-9 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm"
              >
                <option value="">No category</option>
                {categoryList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2 pt-1">
                <Input
                  placeholder="New category name"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="h-8 text-[13px]"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAddCategory}
                  disabled={isPending}
                >
                  Add
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="brandId">Brand</Label>
              <select
                id="brandId"
                name="brandId"
                className="h-9 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm"
              >
                <option value="">No brand</option>
                {brandList.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2 pt-1">
                <Input
                  placeholder="New brand name"
                  value={newBrand}
                  onChange={(e) => setNewBrand(e.target.value)}
                  className="h-8 text-[13px]"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAddBrand}
                  disabled={isPending}
                >
                  Add
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="primarySupplierId">Primary supplier</Label>
              <select
                id="primarySupplierId"
                name="primarySupplierId"
                className="h-9 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm"
              >
                <option value="">None</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit">Unit of measure</Label>
              <Input id="unit" name="unit" defaultValue="pc" placeholder="pc, kg, litre, box…" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={trackExpiry}
              onChange={(e) => setTrackExpiry(e.target.checked)}
            />
            Track expiry dates for this product (perishables, pharmacy)
          </label>
          <ProductImagePicker />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing &amp; identification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" name="sku" placeholder="COLA-500" required />
              {fieldErrors.sku && <p className="text-[12px] text-danger">{fieldErrors.sku[0]}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="barcode">Barcode (optional)</Label>
              <Input id="barcode" name="barcode" placeholder="5449000000996" />
              {fieldErrors.barcode && (
                <p className="text-[12px] text-danger">{fieldErrors.barcode[0]}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="costPrice">Cost price (KES)</Label>
              <Input id="costPrice" name="costPrice" type="number" step="0.01" min="0" required />
              {fieldErrors.costPrice && (
                <p className="text-[12px] text-danger">{fieldErrors.costPrice[0]}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sellingPrice">Selling price (KES)</Label>
              <Input
                id="sellingPrice"
                name="sellingPrice"
                type="number"
                step="0.01"
                min="0"
                required
              />
              {fieldErrors.sellingPrice && (
                <p className="text-[12px] text-danger">{fieldErrors.sellingPrice[0]}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wholesalePrice">Wholesale price (optional)</Label>
              <Input id="wholesalePrice" name="wholesalePrice" type="number" step="0.01" min="0" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="taxRateId">Tax rate</Label>
            <select
              id="taxRateId"
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stock levels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="minStock">Minimum stock</Label>
              <Input id="minStock" name="minStock" type="number" step="0.001" min="0" defaultValue="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reorderLevel">Reorder level</Label>
              <Input
                id="reorderLevel"
                name="reorderLevel"
                type="number"
                step="0.001"
                min="0"
                defaultValue="0"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="openingWarehouseId">Opening stock warehouse (optional)</Label>
              <select
                id="openingWarehouseId"
                name="openingWarehouseId"
                className="h-9 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm"
              >
                <option value="">Skip — no opening stock</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="openingQuantity">Opening quantity</Label>
              <Input id="openingQuantity" name="openingQuantity" type="number" step="0.001" min="0" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Saving…" : "Create product"}
      </Button>
    </form>
  );
}
