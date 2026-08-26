import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAuthContext } from "@/server/auth/context";
import { ReceiptView } from "./receipt-view";

export default async function ReceiptPage({ params }: { params: Promise<{ saleId: string }> }) {
  const { saleId } = await params;
  const ctx = await requireAuthContext();
  const [sale, settings] = await Promise.all([
    ctx.db.sale.findFirst({ where: { id: saleId }, include: { organization: true, branch: true, register: true, cashier: true, customer: true, items: { include: { variant: { include: { product: true } } } }, payments: true } }),
    ctx.db.receiptSettings.findUnique({ where: { organizationId: ctx.organizationId } }),
  ]);
  if (!sale) notFound();
  return <div className="receipt-page"><div className="mx-auto mb-5 flex max-w-3xl items-center gap-4 print:hidden"><Link href="/dashboard/pos" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> Back to POS</Link></div><ReceiptView sale={{ ...sale, id: sale.id }} settings={settings} /></div>;
}
