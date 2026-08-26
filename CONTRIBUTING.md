# Contributing

## Development workflow

This project is built phase-by-phase (see `ARCHITECTURE.md` →
"Development roadmap"). Each phase, in order:

1. Explain what's being built (a short design note, in the PR
   description or a comment at the top of the new schema section).
2. Update `prisma/schema.prisma`.
3. Create a migration: `npm run db:migrate`.
4. Extend `prisma/seed.ts` if the new module needs demo data.
5. Build the service layer (`src/server/services/<domain>.ts`) —
   pure functions taking a transaction client, no direct `rawPrisma`.
6. Build server actions (`src/app/actions/<domain>.ts`) that call
   `requireAuthContext()`, `assertPermission()`, the service layer,
   and `recordAudit()` for anything sensitive.
7. Build the UI.
8. Add Zod validation for every action's input.
9. Confirm authorization checks exist for every mutation.
10. Add tests (unit tests for calculations, integration tests for the
    full flow — see `README.md` → Tests).
11. `npx tsc --noEmit`
12. `npm run lint`
13. `npm run test`
14. Fix everything before moving to the next phase.

Never leave placeholder functionality pretending it's complete — if a
feature can't be finished yet, mark it `TODO` in a code comment (see
`src/app/actions/auth.ts`'s email-integration TODOs for the pattern)
rather than faking success.

## Code conventions

- **Never** query a tenant-owned table with `rawPrisma` outside of
  `src/server/auth/`, `src/server/db/`, and `src/server/services/organization.ts`
  (provisioning a brand-new org, which by definition has no tenant
  context yet). Everywhere else, get `ctx.db` from
  `requireAuthContext()`.
- **Never** trust a client-supplied `organizationId`, `branchId`, or
  price/total. Recompute or re-derive from the authenticated session
  and server-side data.
- **Money** is always `Decimal`, handled via `decimal.js` in
  application code where arithmetic is needed — never `Number` for
  anything that touches a currency amount.
- **Every** server action that mutates tenant data starts with
  `requireAuthContext()` + the relevant `assertPermission(...)` call,
  and ends with a `recordAudit(...)` call if the action is
  sensitive (see the list in `SECURITY.md` → Audit logging).
- **Server actions** return `ActionResult<T>` (`{ ok: true, data } |
  { ok: false, error, fieldErrors? }`) — don't throw plain errors
  across the server/client boundary for expected validation failures;
  reserve `throw` for genuine bugs/auth failures (`AuthError`).

## Commit / PR expectations

- One phase (or one clearly-scoped slice of a phase) per PR.
- Include what was tested and how in the PR description.
- If a step in the 14-step workflow above was skipped, say so
  explicitly and why.
