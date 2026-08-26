"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertOwner, assertPermission, requireAuthContext, AuthError } from "@/server/auth/context";
import { recordAudit } from "@/server/services/audit";
import type { ActionResult } from "./auth";

const businessProfileSchema = z.object({
  name: z.string().trim().min(1).max(160),
  legalName: z.string().trim().max(160).optional().or(z.literal("")),
  businessType: z.string().trim().max(80).optional().or(z.literal("")),
  taxPin: z.string().trim().max(40).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
});
const receiptSchema = z.object({ paperSize: z.enum(["80mm", "58mm", "A4"]), footerMessage: z.string().max(300), autoPrint: z.boolean(), showBusinessLogo: z.boolean(), showCashier: z.boolean(), showCustomer: z.boolean(), showSku: z.boolean(), showTax: z.boolean(), showDiscount: z.boolean(), showPaymentReference: z.boolean() });
const notificationSchema = z.array(z.object({ eventKey: z.string().min(1).max(60), dashboard: z.boolean(), email: z.boolean(), enabled: z.boolean() })).min(1).max(20);

export async function updateBusinessProfile(raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const ctx = await requireAuthContext();
    assertPermission(ctx, "SETTINGS_MANAGE");
    assertOwner(ctx);
    const parsed = businessProfileSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Please enter valid business details." };
    const input = parsed.data;
    await ctx.db.organization.update({ where: { id: ctx.organizationId }, data: { name: input.name, legalName: input.legalName || null, businessType: input.businessType || null, taxPin: input.taxPin || null, phone: input.phone || null, email: input.email || null, address: input.address || null } });
    await recordAudit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "BUSINESS_PROFILE_UPDATED", entityType: "Organization", entityId: ctx.organizationId, metadata: { name: input.name, businessType: input.businessType } });
    revalidatePath("/dashboard/settings");
    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function updateReceiptSettings(raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const ctx = await requireAuthContext(); assertPermission(ctx, "SETTINGS_MANAGE"); assertOwner(ctx);
    const parsed = receiptSchema.safeParse(raw); if (!parsed.success) return { ok: false, error: "Please enter valid receipt settings." };
    await ctx.db.receiptSettings.upsert({ where: { organizationId: ctx.organizationId }, update: parsed.data, create: { organizationId: ctx.organizationId, ...parsed.data } });
    await recordAudit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "RECEIPT_SETTINGS_UPDATED", entityType: "ReceiptSettings", metadata: { paperSize: parsed.data.paperSize } });
    revalidatePath("/dashboard/settings"); return { ok: true, data: undefined };
  } catch (error) { if (error instanceof AuthError) return { ok: false, error: error.message }; throw error; }
}

export async function updateNotificationSettings(raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const ctx = await requireAuthContext(); assertPermission(ctx, "SETTINGS_MANAGE"); assertOwner(ctx);
    const parsed = notificationSchema.safeParse(raw); if (!parsed.success) return { ok: false, error: "Please enter valid notification settings." };
    await ctx.db.$transaction(parsed.data.map((item) => ctx.db.notificationSetting.upsert({ where: { organizationId_eventKey: { organizationId: ctx.organizationId, eventKey: item.eventKey } }, update: { dashboard: item.dashboard, email: item.email, enabled: item.enabled }, create: { organizationId: ctx.organizationId, ...item } })));
    await recordAudit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "NOTIFICATION_SETTINGS_UPDATED", entityType: "NotificationSetting", metadata: { events: parsed.data.map((item) => item.eventKey) } });
    revalidatePath("/dashboard/settings"); return { ok: true, data: undefined };
  } catch (error) { if (error instanceof AuthError) return { ok: false, error: error.message }; throw error; }
}
