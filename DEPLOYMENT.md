# Deployment

## Target stack

- **App hosting**: Vercel
- **Database**: Neon or Supabase (serverless-friendly Postgres, both
  give you a pooled `DATABASE_URL` + a `DIRECT_URL` for migrations)
- **Object storage** (product images, receipt PDFs, expense
  attachments): any S3-compatible bucket (S3, Cloudflare R2,
  Supabase Storage)

## One-time setup

1. **Create the database.**
   - Neon: create a project, copy the pooled connection string into
     `DATABASE_URL` and the direct (non-pooled) string into
     `DIRECT_URL`.
   - Supabase: Project Settings → Database → Connection string
     (use the "Transaction" pooler for `DATABASE_URL`, "Session" /
     direct for `DIRECT_URL`).

2. **Run migrations against production** (from a machine with network
   access to both the DB and Prisma's engine CDN — CI or your local
   machine, not required to be Vercel itself):
   ```bash
   npm run db:generate
   npm run db:migrate:deploy
   npm run db:seed        # seeds ONLY the global permission catalog in
                           # production (NODE_ENV=production skips the
                           # demo tenant — see prisma/seed.ts)
   ```

3. **Create the Vercel project**, import this repository, and set
   environment variables (Project Settings → Environment Variables)
   from `.env.example`:
   - `DATABASE_URL`, `DIRECT_URL`
   - `AUTH_SECRET` (generate with `openssl rand -base64 32`)
   - `NEXT_PUBLIC_APP_URL` (your production domain)
   - M-Pesa, email, SMS, WhatsApp, storage credentials once those
     integrations are wired up (Phase 9) — leave blank until then.

4. **Deploy.** Vercel builds with `npm run build`
   (`prisma generate` should also run as part of the build — add a
   `"postinstall": "prisma generate"` script, or a Vercel Build
   Command override of `prisma generate && next build`, once you've
   confirmed `prisma generate` succeeds in your CI network
   environment).

## Migrations after the first deploy

Never run `prisma migrate dev` against production — it's interactive
and can prompt for destructive resets. Use:

```bash
npm run db:migrate:deploy
```

in your deploy pipeline (a Vercel "Ignored Build Step" / GitHub Action
that runs before promoting the deployment is a common pattern).

## Database connection pooling on serverless

Vercel functions are short-lived and can open many concurrent DB
connections; use Neon/Supabase's pooled connection string for
`DATABASE_URL` (Prisma's `directUrl` is only used for migrations, not
at runtime) to avoid exhausting Postgres connection limits.

## Rollback

Because financial/inventory records are voided rather than deleted
(see `SECURITY.md`), a bad deploy's *code* can be rolled back via
Vercel's instant rollback without needing a matching data rollback in
the common case. A migration that changes schema shape is the
exception — write migrations to be backward-compatible with the
previous app version for at least one deploy cycle where feasible.
