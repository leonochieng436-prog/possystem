import type { getTenantDb } from "@/server/db/tenant";

type ReceiptDb = ReturnType<typeof getTenantDb>;

export async function getReceiptData(db: ReceiptDb, organizationId: string, saleId: string) {
  const [sale, settings] = await Promise.all([
    db.sale.findFirst({ where: { id: saleId, organizationId, status: "COMPLETED" }, include: { organization: true, branch: true, register: true, cashier: true, customer: true, items: { include: { variant: { include: { product: true } } } }, payments: true } }),
    db.receiptSettings.findUnique({ where: { organizationId } }),
  ]);
  return sale ? { sale, settings } : null;
}
