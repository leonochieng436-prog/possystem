import "server-only";
import { cookies } from "next/headers";
import { randomBytes, createHash } from "crypto";
import { rawPrisma } from "@/server/db/client";

const SESSION_COOKIE = "pos_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Sessions are opaque random tokens stored (hashed) in the DB, not signed
 * JWTs. This trades a DB read per request for the ability to revoke a
 * session instantly (logout, password change, "sign out other devices")
 * without needing a token blocklist. For a POS handling money and
 * inventory, revocability matters more than avoiding one indexed lookup.
 */
export async function createSession(params: {
  userId: string;
  organizationId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  await rawPrisma.session.create({
    data: {
      userId: params.userId,
      organizationId: params.organizationId ?? null,
      tokenHash,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(Date.now() + SESSION_TTL_MS),
  });

  return token;
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await rawPrisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date() || !session.user.isActive) {
    return null;
  }

  return session;
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const tokenHash = hashToken(token);
    await rawPrisma.session.deleteMany({ where: { tokenHash } });
  }
  cookieStore.delete(SESSION_COOKIE);
}

/** Switch which organization a session is "acting as" (for multi-org users). */
export async function setSessionOrganization(organizationId: string) {
  const session = await getCurrentSession();
  if (!session) throw new Error("Session not found");

  const membership = await rawPrisma.userOrganization.findUnique({
    where: {
      userId_organizationId: {
        userId: session.userId,
        organizationId,
      },
    },
    select: { isActive: true },
  });
  if (!membership?.isActive) {
    throw new Error("User does not have access to this organization");
  }

  await rawPrisma.session.update({
    where: { id: session.id },
    data: { organizationId },
  });
}
