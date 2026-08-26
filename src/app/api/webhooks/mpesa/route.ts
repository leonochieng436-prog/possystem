import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") return NextResponse.json({ ResultCode: 1, ResultDesc: "Invalid payload" }, { status: 400 });
  console.info("M-Pesa callback received", payload);
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
