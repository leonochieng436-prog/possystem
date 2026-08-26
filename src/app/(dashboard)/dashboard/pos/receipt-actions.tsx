"use client";

import { Printer, Download } from "lucide-react";

export function ReceiptActions({ saleId }: { saleId: string }) {
  return <div className="flex flex-wrap gap-2"><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><Printer size={15} /> Print receipt</button><a href={`/api/receipts/${saleId}?download=1`} className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-border px-3 py-2 text-sm font-semibold hover:bg-surface-muted"><Download size={15} /> Download receipt</a></div>;
}
