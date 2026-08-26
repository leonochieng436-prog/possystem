# API

Phase 1 exposes its server surface entirely through **Next.js Server
Actions** (`"use server"` functions in `src/app/actions/`), called
directly from client components — there is no public REST/JSON API
yet. Route Handlers (`src/app/api/.../route.ts`) will be introduced
starting Phase 9, for the endpoints that need them:

- **Webhook receivers** (M-Pesa payment callbacks, future card/bank
  provider callbacks) — these must be Route Handlers, since an
  external provider can't call a Server Action.
- **Report export downloads** where a streamed file response is
  cleaner as a Route Handler than a Server Action.
- Any future external/partner integration that needs a stable JSON
  contract independent of the Next.js client bundle.

## Server action conventions

Every action:

- Lives in `src/app/actions/<domain>.ts`, marked `"use server"`.
- Accepts a single `raw: unknown` argument, parsed with a Zod schema
  from `src/lib/validation/<domain>.ts` — never trusts the shape of
  client input.
- Returns `ActionResult<T>`:
  ```ts
  type ActionResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
  ```
  Client components check `result.ok` rather than relying on a thrown
  exception for expected failures (validation errors, permission
  errors surfaced as a message). Genuine bugs/unauthenticated access
  still throw (`AuthError`), and are expected to be caught by Next.js'
  error boundaries.
- Starts with `const ctx = await requireAuthContext()` for anything
  touching tenant data, and calls `assertPermission(ctx, "KEY")`
  before mutating.

## Current actions (Phase 1)

| Action | File | Permission required | Notes |
|---|---|---|---|
| `registerOrganization` | `actions/auth.ts` | none (public) | Creates org + owner + default branch atomically |
| `login` | `actions/auth.ts` | none (public) | Timing-safe |
| `logout` | `actions/auth.ts` | requires session | Destroys session, redirects to `/login` |
| `requestPasswordReset` | `actions/auth.ts` | none (public) | Always returns success shape (no email enumeration) |
| `resetPassword` | `actions/auth.ts` | valid reset token | Invalidates all sessions on success |
| `createBranch` | `actions/branches.ts` | `BRANCHES_MANAGE` | Auto-provisions a warehouse + register |
| `inviteUser` | `actions/users.ts` | `USERS_MANAGE` | Temporary-password stopgap; see TODO in file |
| `createCategory` | `actions/products.ts` | `PRODUCTS_CREATE` | |
| `createBrand` | `actions/products.ts` | `PRODUCTS_CREATE` | |
| `createProduct` | `actions/products.ts` | `PRODUCTS_CREATE` | Creates product + first variant; opening stock recorded as an `OPENING_BALANCE` movement |
| `addProductVariant` | `actions/products.ts` | `PRODUCTS_CREATE` | Adds a size/color variant to an existing product |
| `adjustStock` | `actions/inventory.ts` | `INVENTORY_ADJUST` | FIFO-aware; throws a friendly error on insufficient stock rather than going negative |

## Future Route Handlers (planned shape, not yet implemented)

```
POST /api/webhooks/mpesa           # STK Push / C2B callbacks
POST /api/webhooks/mpesa/timeout
GET  /api/reports/:type/export     # ?format=csv|xlsx|pdf&branchId=&from=&to=
```

Webhook handlers will verify the request against the tenant's
configured `PaymentProviderConfig` (looked up by shortcode/till, not
by a client-supplied organizationId) before processing — see
`SECURITY.md` for the general "never trust client-supplied tenant
identifiers" rule, which applies equally to values embedded in a
webhook payload.
