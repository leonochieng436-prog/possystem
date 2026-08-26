import "server-only";
import { getCurrentSession } from "./session";
import { rawPrisma } from "@/server/db/client";
import { getTenantDb } from "@/server/db/tenant";
import type { PermissionKey } from "@/lib/rbac/permissions";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/**
 * The context every authenticated server action/route handler should
 * start with. `db` is ALREADY tenant-scoped — callers never need to (and
 * cannot forget to) pass organizationId themselves.
 */
export interface AuthContext {
  userId: string;
  organizationId: string;
  branchIds: string[] | null; // null = unrestricted (all branches)
  isOwner: boolean;
  permissions: Set<string>;
  db: ReturnType<typeof getTenantDb>;
}

/**
 * Resolves the current session into a full auth context: who the user is,
 * which organization they're acting as, and what they're allowed to do in
 * it. Throws AuthError if there's no valid session or no active
 * membership in that organization — callers don't need their own
 * "if (!user)" branches.
 */
export async function requireAuthContext(): Promise<AuthContext> {
  const session = await getCurrentSession();
  if (!session) {
    throw new AuthError("Not authenticated", 401);
  }

  const organizationId = session.organizationId;
  if (!organizationId) {
    throw new AuthError("No active organization selected", 400);
  }

  const membership = await rawPrisma.userOrganization.findUnique({
    where: {
      userId_organizationId: {
        userId: session.userId,
        organizationId,
      },
    },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
    },
  });

  if (!membership || !membership.isActive) {
    throw new AuthError("No access to this organization", 403);
  }

  const userBranches = await rawPrisma.userBranch.findMany({
    where: { userId: session.userId },
    select: { branchId: true },
  });

  // Owner/Administrator/Manager roles are unrestricted by branch unless
  // explicitly scoped via UserBranch rows; other roles are restricted to
  // whatever branches they've been assigned (empty assignment for a
  // restricted role means "no branches" rather than "all branches").
  const unrestrictedRoles = ["owner", "administrator", "manager"];
  const branchIds =
    userBranches.length > 0
      ? userBranches.map((b) => b.branchId)
      : unrestrictedRoles.includes(membership.role.slug)
        ? null
        : [];

  return {
    userId: session.userId,
    organizationId,
    branchIds,
    isOwner: membership.isOwner,
    permissions: new Set(membership.role.permissions.map((p) => p.permission.key)),
    db: getTenantDb(organizationId),
  };
}

/** Throws AuthError(403) if the context lacks the given permission. */
export function assertPermission(ctx: AuthContext, permission: PermissionKey) {
  if (!ctx.permissions.has(permission)) {
    throw new AuthError(`Missing permission: ${permission}`, 403);
  }
}

/** Throws AuthError(403) for organization-level owner-only operations. */
export function assertOwner(ctx: AuthContext) {
  if (!ctx.isOwner) {
    throw new AuthError("Only the organization owner can perform this action", 403);
  }
}

/** Throws AuthError(403) if the branch isn't one the user may operate in. */
export function assertBranchAccess(ctx: AuthContext, branchId: string) {
  if (ctx.branchIds !== null && !ctx.branchIds.includes(branchId)) {
    throw new AuthError("No access to this branch", 403);
  }
}
