import { NextResponse } from "next/server";
import { assertPermission, requireAuthContext } from "@/server/auth/context";

function csv(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function download(rows: unknown[][], filename: string) {
  return new NextResponse(rows.map((row) => row.map(csv).join(",")).join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(request: Request) {
  const ctx = await requireAuthContext();
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "report";

  if (type === "inventory") {
    assertPermission(ctx, "INVENTORY_VIEW");
    const variants = await ctx.db.productVariant.findMany({
      where: { isActive: true, product: { isActive: true, organizationId: ctx.organizationId } },
      include: { product: true, inventoryItems: { include: { warehouse: true } } },
      orderBy: { product: { name: "asc" } },
    });
    const rows: unknown[][] = [["Product", "Variant", "SKU", "Warehouse", "Quantity", "Reorder level", "Average cost", "Stock value"]];
    for (const variant of variants) {
      for (const item of variant.inventoryItems) {
        rows.push([variant.product.name, variant.name, variant.sku, item.warehouse.name, item.quantity, variant.reorderLevel, item.averageCost, Number(item.quantity) * Number(item.averageCost)]);
      }
      if (variant.inventoryItems.length === 0) rows.push([variant.product.name, variant.name, variant.sku, "", 0, variant.reorderLevel, "", 0]);
    }
    return download(rows, "dukaos-inventory.csv");
  }

  if (type === "products") {
    assertPermission(ctx, "PRODUCTS_VIEW");
    const products = await ctx.db.product.findMany({
      where: { isActive: true },
      include: { category: true, brand: true, primarySupplier: true, variants: { include: { barcodes: true } } },
      orderBy: { name: "asc" },
    });
    const rows: unknown[][] = [["Product", "Description", "Category", "Brand", "Supplier", "Unit", "Type", "SKU", "Barcode", "Cost price", "Selling price", "Wholesale price", "Reorder level", "Track expiry"]];
    for (const product of products) {
      for (const variant of product.variants) {
        rows.push([product.name, product.description, product.category?.name, product.brand?.name, product.primarySupplier?.name, product.unit, product.type, variant.sku, variant.barcodes.map((barcode) => barcode.barcode).join(" | "), variant.costPrice, variant.sellingPrice, variant.wholesalePrice, variant.reorderLevel, product.trackExpiry]);
      }
    }
    return download(rows, "dukaos-products.csv");
  }

  assertPermission(ctx, "REPORTS_VIEW");
  const now = new Date();
  const from = new Date(url.searchParams.get("from") ?? new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString());
  const to = new Date(url.searchParams.get("to") ?? now.toISOString());
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return NextResponse.json({ error: "Invalid date range." }, { status: 400 });
  to.setDate(to.getDate() + 1);
  const [sales, expenses] = await Promise.all([
    ctx.db.sale.findMany({ where: { createdAt: { gte: from, lt: to } }, select: { receiptNumber: true, status: true, total: true, cogsTotal: true, createdAt: true } }),
    ctx.db.expense.findMany({ where: { incurredAt: { gte: from, lt: to } }, select: { description: true, paymentMethod: true, amount: true, incurredAt: true } }),
  ]);
  return download([["Type", "Reference", "Status", "Amount", "COGS", "Payment method", "Date"], ...sales.map((sale) => ["sale", sale.receiptNumber, sale.status, sale.total, sale.cogsTotal, "", sale.createdAt.toISOString()]), ...expenses.map((expense) => ["expense", expense.description, "", expense.amount, "", expense.paymentMethod, expense.incurredAt.toISOString()])], "dukaos-report.csv");
}
