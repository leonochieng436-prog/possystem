import type { ReceiptPaperSize } from "./receipt-types";

export function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function formatMoney(value: unknown) {
  return `KSh ${toNumber(value).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatNumber(value: unknown) {
  return toNumber(value).toLocaleString("en-KE", { maximumFractionDigits: 3 });
}

export function formatDateTime(value: Date) {
  return value.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
}

export function paymentLabel(method: string) {
  const normalized = method.toUpperCase();
  if (normalized === "MPESA" || normalized === "M_PESA") return "M-Pesa";
  if (normalized === "BANK" || normalized === "BANK_TRANSFER") return "Bank Transfer";
  return normalized.charAt(0) + normalized.slice(1).toLowerCase();
}

export function normalizePaperSize(value: string | null | undefined): ReceiptPaperSize {
  if (value === "58mm" || value === "A4") return value;
  return "80mm";
}
