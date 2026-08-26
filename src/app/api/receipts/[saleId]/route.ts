import { NextResponse } from "next/server";
import { requireAuthContext } from "@/server/auth/context";
import { buildReceiptData } from "@/lib/receipts/receipt-data";
import { getReceiptData } from "@/services/receipts/receipt.service";
import { generateReceiptHtml } from "@/services/receipts/receipt-html.service";

export async function GET(_request: Request, { params }: { params: Promise<{ saleId: string }> }) {
	try {
		const { saleId } = await params;
		const ctx = await requireAuthContext();
		const data = await getReceiptData(ctx.db, ctx.organizationId, saleId);
		if (!data) return new NextResponse("Receipt not found", { status: 404 });
		if (ctx.branchIds && !ctx.branchIds.includes(data.sale.branchId)) return new NextResponse("Receipt not found", { status: 404 });
		const receipt = buildReceiptData(data.sale, data.settings);
		return new NextResponse(generateReceiptHtml(receipt), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
	} catch (error) {
		console.error("Receipt generation error:", error);
		return new NextResponse("Unable to generate receipt", { status: 500 });
	}
}
