"use server";

import { requireAuthContext, assertPermission, AuthError } from "@/server/auth/context";
import { recordAudit } from "@/server/services/audit";
import type { ActionResult } from "./auth";

export async function sendNotification(raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const ctx = await requireAuthContext(); assertPermission(ctx, "SETTINGS_MANAGE");
    if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid notification request." };
    const input = raw as { channel?: string; recipient?: string; message?: string };
    if (!input.channel || !input.recipient || !input.message) return { ok: false, error: "Channel, recipient, and message are required." };
    const keyByChannel: Record<string, string | undefined> = { email: process.env.EMAIL_API_KEY, sms: process.env.SMS_API_KEY, whatsapp: process.env.WHATSAPP_API_KEY };
    if (!keyByChannel[input.channel]) return { ok: false, error: `${input.channel} integration is not configured.` };
    await recordAudit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "NOTIFICATION_REQUESTED", entityType: "Integration", metadata: { channel: input.channel, recipient: input.recipient } });
    return { ok: false, error: "Provider adapter is not configured for this channel." };
  } catch (e) { if (e instanceof AuthError) return { ok: false, error: e.message }; throw e; }
}
