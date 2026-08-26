# Architecture

## 1. System module map

```
Products ─┬─ Suppliers ─── Purchase Orders ─── Goods Receipt ──┐
          │                                                     ▼
          │                                             Inventory Ledger
          │                                                     │
          └─────────────────────────────────────────────────────┤
                                                                  ▼
Customers ─── Sales (POS) ─── Payments ─── Returns ──────── COGS / Revenue
                   │                                              │
                   ▼                                              ▼
             Cash Sessions                              Expenses ── Profit
                                                                   │
                                                                   ▼
                                                        Reports / Analytics
                                                                   │
                                                                   ▼
                                                             Audit Log
```

Every module writes through the tenant-scoped data layer (`getTenantDb`,
see below) and, for anything sensitive, through the audit logger. No
module computes a number (profit, stock level, balance) that can't be
traced back to the ledger rows that produced it — see "Traceability"
below.

## 2. Tenant isolation strategy

**Model:** shared database, shared schema, `organizationId` on every
tenant-owned row (documented per-table in `DATABASE.md`).

**Enforcement:** `src/server/db/tenant.ts` exports `getTenantDb(organizationId)`,
which wraps the Prisma client in a
[client extension](https://www.prisma.io/docs/orm/prisma-client/client-extensions)
that injects `organizationId` into the `where`/`data` of every operation
against a tenant model. This is not a convention developers are asked to
remember — it's the only client handed to authenticated request
handlers (`ctx.db` from `requireAuthContext()`), so there is no method
that skips the filter.

The raw, un-scoped `PrismaClient` (`rawPrisma`) is intentionally
harder to reach: it's used only in auth code (before an organization
context exists) and provisioning code that explicitly operates across
the row it's creating. Anyone extending the app should treat a new
`import { rawPrisma }` outside those two contexts as a code review red
flag.

`findUnique`/`findUniqueOrThrow` are special-cased: Prisma's unique
lookups only accept the declared unique key, so instead of injecting a
filter, the extension runs the lookup and then verifies the row's
`organizationId` before returning it — a cross-tenant ID is treated as
"not found," never as "found, but filtered after the fact."

## 3. Authentication & RBAC

- **Sessions**: opaque random tokens, hashed with SHA-256 before
  storage, stored in the `Session` table with an expiry. Chosen over
  signed JWTs specifically so a session can be revoked instantly
  (logout, password reset invalidates all sessions) without a
  blocklist — see `SECURITY.md`.
- **Passwords**: bcrypt, cost factor 12.
- **RBAC**: `Role` and `Permission` are separate concerns.
  `Permission` is a global, non-tenant catalog (`SALES_CREATE`,
  `INVENTORY_ADJUST`, etc. — see `src/lib/rbac/permissions.ts`).
  `Role` is tenant-scoped, seeded per-organization at registration time
  with the seven default roles from the spec (Owner, Administrator,
  Manager, Cashier, Inventory Manager, Procurement Officer,
  Accountant), each pre-wired to a sensible permission set that the
  business can customize later (Phase 1 seeds the defaults; a
  role-editing UI is a Phase-2-or-later addition).
- **Guard**: every server action starts with `requireAuthContext()`,
  which resolves session → membership → role → permission set →
  branch restrictions, and returns a ready-to-use `{ db, permissions,
  branchIds }`. `assertPermission(ctx, "SALES_VOID")` throws a typed
  `AuthError` (never a silent false) if the check fails.
- **Branch scoping**: Owner/Administrator/Manager are unrestricted by
  default; other roles are restricted to whatever branches they're
  explicitly assigned via `UserBranch`.

## 4. Transaction architecture

Every multi-step business operation (sale creation, purchase
receiving, stock transfer, etc.) runs inside a single
`prisma.$transaction(...)`. This is non-negotiable per the spec's
critical business rules: a sale that decremented inventory but failed
to record the payment, or a goods receipt that updated the PO but not
the inventory, must be impossible — not merely unlikely.

**Traceability**: the inventory ledger (`InventoryMovement`) and every
financial total are additive/derived, not overwritten. `Sale.cogsTotal`
is the sum of the FIFO cost consumed at sale time (recorded per-line in
`SaleItem.unitCost`), not a number computed once and cached
disconnected from its source rows. See `DATABASE.md` → "Inventory
ledger" for the FIFO batch-consumption design (Phase 2).

## 5. Folder structure

```
prisma/
  schema.prisma        # full data model (see DATABASE.md)
  seed.ts               # permission catalog + demo tenant
src/
  app/
    (auth)/             # /login, /register, /forgot-password, /reset-password
    (dashboard)/         # authenticated app shell + feature routes
    actions/             # server actions ("use server"), grouped by domain
  components/
    ui/                  # design-system primitives (Button, Card, Input, ...)
  lib/
    rbac/                 # permission catalog, default role → permission maps
    validation/           # Zod schemas
    slug.ts, utils.ts
  server/
    auth/                 # password hashing, sessions, requireAuthContext
    db/                   # Prisma client singleton + tenant isolation extension
    services/              # cross-cutting domain logic (audit, org provisioning, inventory)
  middleware.ts            # edge-level "is there a session cookie" redirect only
```

As later phases land, feature-specific services go in
`src/server/services/<domain>.ts` (e.g. `sales.ts`, `purchases.ts`),
following the same pattern as `organization.ts`, `audit.ts`, and
`inventory.ts`: pure functions taking a transaction client, no direct
`rawPrisma` usage.

## 6. Development roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation: Next.js/Prisma/Postgres, auth, organizations, roles, permissions, branches | **Done** |
| 2 | Products, categories, brands, variants, barcodes, warehouses, inventory ledger, stock adjustments | **Done** |
| 3 | Suppliers, purchase orders, goods receiving, supplier invoices/payments | Next |
| 4 | POS interface, cart, sales engine, payments, cash register, receipts | Planned |
| 5 | Customer profiles, credit, returns | Planned |
| 6 | Expenses, revenue, COGS, gross/net profit, cash flow, balances | Planned |
| 7 | Dashboard, reports, charts, exports | Planned |
| 8 | Multi-branch transfers, consolidated reporting | Planned |
| 9 | M-Pesa, WhatsApp, SMS, email integrations | Planned |
| 10 | Subscription plans, billing, usage limits, trials | Scaffolded (Subscription model exists; no billing UI/logic yet) |

Each phase follows the same discipline used in Phase 1: schema first,
then services, then server actions, then UI, then tests, then
type-check/lint, before moving on.
