# Security

## Tenant isolation (the top priority for a multi-tenant POS)

- Enforced server-side only, via the Prisma client extension in
  `src/server/db/tenant.ts` (`getTenantDb`) — never by frontend
  filtering. See `ARCHITECTURE.md` for the mechanism.
- `requireAuthContext()` is the only sanctioned way a server
  action/route handler obtains a tenant-scoped `db`. It re-derives
  `organizationId` from the **server-side session**, never from a
  client-supplied value (a request body/query param claiming
  `organizationId: X` is never trusted).
- Code review checklist for any new server action: does it call
  `requireAuthContext()` and use `ctx.db`, not `rawPrisma`, for every
  tenant-owned table it touches?

## Authentication

- Passwords: bcrypt, cost factor 12 (`src/server/auth/password.ts`).
- Sessions: opaque 256-bit random tokens; only a SHA-256 hash is
  stored server-side, so a database read alone can't produce a valid
  session token. httpOnly, `secure` in production, `sameSite: lax`
  cookies. Sessions are revocable (deleted from the DB) rather than
  relying on JWT expiry — logout and password reset both invalidate
  sessions immediately.
- Login is timing-safe: a non-existent email still runs a bcrypt
  comparison against a fixed dummy hash, so response time doesn't leak
  which emails are registered.
- Password reset tokens are single-use, 30-minute expiry, and a reset
  invalidates all of that user's existing sessions.
- 2FA: the schema has `User.twoFactorEnabled`/`twoFactorSecret`
  columns reserved; TOTP enrollment/verification is not yet
  implemented (flagged, not faked — see `ARCHITECTURE.md` roadmap).

## Authorization (RBAC)

- Every sensitive server action calls `assertPermission(ctx, "KEY")`
  before doing anything — see the permission catalog in
  `src/lib/rbac/permissions.ts`. A missing permission throws a typed
  `AuthError(403)`, not a silent no-op.
- Branch-level restriction (`assertBranchAccess`) sits alongside
  permission checks for actions scoped to a specific branch (e.g. a
  cashier's own register).

## Audit logging

- `recordAudit()` (`src/server/services/audit.ts`) writes an
  `AuditLog` row for sensitive actions (login, org registration,
  branch creation, user invites today; sale void/refund, price
  changes, inventory adjustments, etc. as those phases land). Audit
  rows are never the mechanism that decides whether an action is
  allowed — they're a record after the permission check has already
  passed.

## Secrets

- `.env.example` documents every required variable; nothing secret is
  ever prefixed `NEXT_PUBLIC_*`.
- Payment provider credentials (`PaymentProviderConfig.config`) are
  stored as `Json` with an explicit code comment that they must be
  encrypted at rest at the application layer before that table is
  written to in Phase 9 — this repo does not yet implement that
  encryption, since no provider integration exists yet to need it.

## Data integrity rules enforced at the code level (not just DB constraints)

These map directly to the spec's "critical business rules" and are
enforced in the service layer as each phase lands, not left to
convention:

- All financial calculations happen server-side (Zod validates input
  *shape*; totals are always recomputed server-side, never trusted
  from the client).
- Financial/inventory-affecting transactions are voided/reversed, not
  physically deleted (`Sale.status = VOIDED`, `SaleReturn`, etc. —
  there is intentionally no `DELETE` server action for a completed
  `Sale`).
- Multi-step mutations (sale creation, goods receiving, transfers) run
  inside `prisma.$transaction(...)` so inventory and financial state
  can't diverge from a partial failure.

## Known gaps (tracked, not hidden)

- Rate limiting on login/registration/password-reset endpoints is not
  yet implemented — add before production traffic (e.g. via a
  Vercel Edge Middleware rate limiter or an upstream WAF rule).
- No breached-password check (e.g. HaveIBeenPwned range API) on
  registration/reset yet.
- CSRF: Next.js Server Actions include Origin-header verification by
  default; no additional CSRF token layer has been added on top, and
  none has been judged necessary yet — revisit if custom
  route handlers taking state-changing POSTs are added outside Server
  Actions.
