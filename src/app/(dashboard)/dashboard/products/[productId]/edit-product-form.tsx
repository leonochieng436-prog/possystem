"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProduct } from "@/app/actions/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductImagePicker } from "../image-picker";

type Option = { id: string; name: string };

type ProductValues = {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  brandId: string | null;
  primarySupplierId: string | null;
  unit: string;
  type: "STOCKED" | "SERVICE" | "BUNDLE";
  trackExpiry: boolean;
  imageUrl: string | null;
};

export function EditProductForm({
  product,
  categories,
  brands,
  suppliers,
}: {
  product: ProductValues;
  categories: Option[];
  brands: Option[];
  suppliers: Option[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [trackExpiry, setTrackExpiry] = useState(product.trackExpiry);

  function handleSubmit(formData: FormData) {
    setError(null);
    const payload = {
      productId: product.id,
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || ""),
      categoryId: String(formData.get("categoryId") || ""),
      brandId: String(formData.get("brandId") || ""),
      primarySupplierId: String(formData.get("primarySupplierId") || ""),
      unit: String(formData.get("unit") || ""),
      type: String(formData.get("type") || "STOCKED") as ProductValues["type"],
      trackExpiry,
      imageUrl: String(formData.get("imageUrl") || ""),
    };

    startTransition(async () => {
      const result = await updateProduct(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle>Edit product</CardTitle></CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          {error && <div className="rounded-[var(--radius-sm)] bg-danger-tint px-3 py-2 text-[13px] text-danger">{error}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="edit-name">Product name</Label>
              <Input id="edit-name" name="name" defaultValue={product.name} required />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="edit-description">Description</Label>
              <textarea id="edit-description" name="description" defaultValue={product.description ?? ""} rows={3} className="w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-category">Category</Label>
              <select id="edit-category" name="categoryId" defaultValue={product.categoryId ?? ""} className="h-9 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm">
                <option value="">No category</option>
                {categories.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-brand">Brand</Label>
              <select id="edit-brand" name="brandId" defaultValue={product.brandId ?? ""} className="h-9 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm">
                <option value="">No brand</option>
                {brands.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-supplier">Primary supplier</Label>
              <select id="edit-supplier" name="primarySupplierId" defaultValue={product.primarySupplierId ?? ""} className="h-9 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm">
                <option value="">None</option>
                {suppliers.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-unit">Unit of measure</Label>
              <Input id="edit-unit" name="unit" defaultValue={product.unit} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-type">Product type</Label>
              <select id="edit-type" name="type" defaultValue={product.type} className="h-9 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm">
                <option value="STOCKED">Stocked</option><option value="SERVICE">Service</option><option value="BUNDLE">Bundle</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={trackExpiry} onChange={(event) => setTrackExpiry(event.target.checked)} />Track expiry dates</label>
          <ProductImagePicker initialValue={product.imageUrl ?? ""} />
          <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save changes"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
