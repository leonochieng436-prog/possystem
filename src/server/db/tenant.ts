import { rawPrisma } from "./client";

/**
 * TENANT ISOLATION ENFORCEMENT LAYER
 * ===================================
 * This is the ONLY sanctioned way server code should touch tenant-owned
 * tables. `getTenantDb(organizationId)` returns a Prisma Client extension
 * that transparently injects `organizationId` into every `where`, and into
 * every `data` on create, for the models listed below.
 *
 * Rationale (see SECURITY.md):
 *   - Relying on "remember to add organizationId in every query" does not
 *     survive a codebase with hundreds of call sites.
 *   - This extension makes the safe path the ONLY path: call
 *     `db.sale.findMany()` and organizationId is already applied; there is
 *     no method that skips it.
 *   - `rawPrisma` (the un-scoped client) must never be imported outside of:
 *       - this file
 *       - auth/session code (which has no organization context yet)
 *       - platform/superadmin tooling, which is a separate, explicitly
 *         audited code path.
 */

// Models that carry a direct `organizationId` column.
const TENANT_MODELS = [
  "branch",
  "warehouse",
  "role",
  "category",
  "brand",
  "product",
  "supplier",
  "customer",
  "customerPayment",
  "purchaseOrder",
  "sale",
  "payment",
  "expense",
  "expenseCategory",
  "auditLog",
  "stockTransfer",
  "stockCount",
  "taxRate",
  "paymentProviderConfig",
  "inventoryMovement",
  "supplierInvoice",
  "supplierPayment",
] as const;

type TenantModel = (typeof TENANT_MODELS)[number];

function isTenantModel(model: string | undefined): model is TenantModel {
  return !!model && (TENANT_MODELS as readonly string[]).includes(model);
}

/**
 * Returns a Prisma Client scoped to a single organization. Every query
 * against a tenant model is forced to include organizationId, both for
 * reads (merged into `where`) and writes (merged into `data`, and verified
 * against `where` on update/delete).
 */
export function getTenantDb(organizationId: string) {
  if (!organizationId) {
    throw new Error("getTenantDb() called without an organizationId");
  }

  return rawPrisma.$extends({
    name: "tenant-isolation",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!isTenantModel(model)) {
            return query(args);
          }

          const a = args as Record<string, unknown>;

          switch (operation) {
            case "findFirst":
            case "findFirstOrThrow":
            case "findMany":
            case "count":
            case "aggregate":
            case "groupBy":
              a.where = { ...(a.where as object), organizationId };
              break;

            case "findUnique":
            case "findUniqueOrThrow": {
              // Prisma's findUnique only accepts the declared unique
              // selector in `where` — it rejects extra filter fields like
              // organizationId. So we don't merge here; instead we run the
              // unique lookup, then verify the row's tenant ourselves and
              // treat a mismatch as "not found" (never as "found, but
              // filtered out after the fact by the caller").
              const result = await query(a);
              if (
                result &&
                typeof result === "object" &&
                "organizationId" in result &&
                (result as { organizationId: unknown }).organizationId !==
                  organizationId
              ) {
                if (operation === "findUniqueOrThrow") {
                  throw new Error("Record not found for this organization.");
                }
                return null;
              }
              return result;
            }

            case "create":
              a.data = { ...(a.data as object), organizationId };
              break;

            case "createMany":
              if (Array.isArray(a.data)) {
                a.data = (a.data as Record<string, unknown>[]).map((d) => ({
                  ...d,
                  organizationId,
                }));
              }
              break;

            case "update":
            case "updateMany":
            case "delete":
            case "deleteMany":
              a.where = { ...(a.where as object), organizationId };
              break;

            case "upsert":
              a.where = { ...(a.where as object), organizationId };
              a.create = { ...(a.create as object), organizationId };
              break;

            default:
              break;
          }

          return query(a);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof getTenantDb>;
