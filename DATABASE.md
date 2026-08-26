# Database

PostgreSQL via Prisma. Full schema: `prisma/schema.prisma`.

## Tenancy

Every tenant-owned table has an `organizationId` column, enforced at
the query layer (see `ARCHITECTURE.md` → "Tenant isolation strategy").
A few tables are tenant-owned *indirectly* rather than by a direct
column — e.g. `Register` belongs to a `Branch`, which belongs to an
`Organization` — because their only access pattern in Phase 1 is
"list registers for this branch," so the extra denormalized column
wasn't worth the write-path complexity. If a direct query pattern
against `Register` emerges later, add `organizationId` to it and to
`TENANT_MODELS` in `tenant.ts` at the same time.

## Core entity groups

- **Identity & tenancy**: `Organization`, `Branch`, `Warehouse`,
  `Register`, `User`, `UserOrganization` (a user's role within one
  org), `UserBranch` (branch access restriction), `Session`,
  `PasswordResetToken`, `EmailVerificationToken`.
- **RBAC**: `Role` (tenant-scoped), `Permission` (global catalog),
  `RolePermission` (join table).
- **Catalog**: `Category`, `Brand`, `Product`, `ProductVariant`,
  `ProductBarcode`, `BundleItem`, `TaxRate`. A "simple" product still
  gets exactly one `ProductVariant` — there is no parallel
  `product.price`/`product.sku` — so pricing, stock, and sales always
  key off a variant, never off the parent product.
- **Procurement**: `Supplier`, `ProductSupplier`, `PurchaseOrder`,
  `PurchaseOrderItem`, `GoodsReceipt`, `GoodsReceiptItem`,
  `SupplierInvoice`, `SupplierPayment`.
- **Inventory**: `InventoryItem` (materialized current balance),
  `Batch` (FIFO cost layer), `InventoryMovement` (append-only ledger),
  `StockTransfer`/`StockTransferItem`, `StockCount`/`StockCountItem`.
- **Sales**: `Sale`, `SaleItem`, `Payment`, `PaymentProviderConfig`,
  `SaleReturn`/`SaleReturnItem`, `CashSession`/`CashMovement`.
- **CRM**: `Customer`, `CustomerPayment`.
- **Financial**: `Expense`, `ExpenseCategory`.
- **Ops**: `AuditLog`, `Subscription`.

## The inventory ledger (why not `product.quantity`)

`InventoryMovement` is append-only: every stock change (purchase,
sale, return, damage, adjustment, transfer, count, expiry — the full
enum from the spec) writes one row, signed (+/-). `InventoryItem` is a
**materialized** current balance per warehouse+variant(+batch) —
convenient for fast reads, but it must always agree with
`sum(InventoryMovement.quantity)` for that key. It is never written to
directly outside the inventory service; every mutation pairs an
`InventoryItem` update with an `InventoryMovement` insert in the same
transaction (Phase 2 delivers the service that owns this invariant).

`Batch` is the FIFO cost layer, scoped to the warehouse it was received
into (`Batch.warehouseId`) — a `PURCHASE` or `OPENING_BALANCE`
movement creates or tops up a batch with `unitCost` + `quantityIn`; a
`SALE` movement consumes the oldest batches first (`quantityLeft`
decreasing), and the consumed cost is written onto `SaleItem.unitCost`
— which is what makes COGS traceable back to the actual purchase cost
of the units sold, rather than a snapshot average computed once and
disconnected from its source.

## Money and quantities

All money fields are `Decimal(14, 2)` (or `Decimal(14, 4)` for
per-unit costs, where sub-cent precision matters for averaging).
Quantities are `Decimal(14, 3)` to support fractional units (kg,
litres). Nothing financial is a `Float`/`Int` — per the spec's
critical business rule #13.

## Multi-currency / multi-country readiness

`Organization.currency` and `Organization.country` are per-tenant
fields (not global config), and `TaxRate` is tenant-scoped rather than
a hardcoded 16% VAT constant — so a Ugandan or Ghanaian tenant sets
their own rates without a schema change. See spec section 43 /
`ARCHITECTURE.md` roadmap Phase 9+ for provider-level localization
(M-Pesa vs. other mobile money).

## Regenerating the client / running migrations

```bash
npm run db:generate        # prisma generate
npm run db:migrate         # prisma migrate dev (creates + applies a migration)
npm run db:migrate:deploy  # prisma migrate deploy (CI/production — no prompts)
npm run db:studio          # visual browser for the database
```
