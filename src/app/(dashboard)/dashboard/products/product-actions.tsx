"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProduct } from "@/app/actions/products";
import { Button } from "@/components/ui/button";

export function ProductActions({ productId }: { productId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!window.confirm("Archive this product? It will no longer appear in active stock workflows.")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteProduct(productId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button type="button" variant="danger" size="sm" onClick={handleDelete} disabled={isPending}>
        {isPending ? "Archiving..." : "Delete"}
      </Button>
      {error && <span className="text-[12px] text-danger">{error}</span>}
    </div>
  );
}
