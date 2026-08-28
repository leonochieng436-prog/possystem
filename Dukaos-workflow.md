# DukaOS System Workflow

## 1. Purpose

DukaOS is a multi-tenant point-of-sale and business management system for retail businesses. It connects the product catalog, branch locations, inventory, purchasing, POS sales, customers, cash sessions, expenses, reports, and audit history.

The central rule is:

> Products define what can be sold. Inventory records what exists at each location. Business events create traceable ledger entries. Reports derive their numbers from those records.

The system is designed so stock and financial state are not silently overwritten. A stock change must have a reason, an actor, a location, and a history.

## 2. Current implementation status

The repository currently contains working functionality for:

- Authentication and password recovery
- Organizations and tenant isolation
- Branches, warehouses, registers, and users
- Roles and permissions
- Product catalog, categories, brands, variants, and barcodes
- FIFO inventory batches and stock ledger
- Stock adjustments
- Supplier and purchase order management
- Goods receiving and supplier invoices/payments
- POS sales, payments, cash sessions, receipts, and receipt notes
- Customers, customer credit, customer payments, and sale returns
- Expenses
- Reports, analytics, and CSV exports
- Audit logging
- Subscription scaffolding

Some areas remain partial or planned, especially external payment integrations, advanced stock counting/approval workflows, complete transfer state management, automated notifications, and production billing logic. Features should not be treated as complete merely because their database models exist.

## 3. High-level module flow

```text
Organization
    |
    +-- Branches
    |     +-- Warehouses
    |     +-- Registers
    |     +-- Branch users
    |
    +-- Product catalog
    |     +-- Products
    |     +-- Variants
    |     +-- Categories / brands
    |     +-- Barcodes
    |
    +-- Inventory ledger <---- Purchases / receiving
    |       |                 POS sales / returns
    |       |                 Adjustments / counts
    |       |                 Transfers
    |       |
    |       +-- Current balances
    |       +-- FIFO cost batches
    |
    +-- Customers / credit
    +-- Expenses
    +-- Cash sessions
    +-- Reports and exports
    +-- Audit log
```

## 4. Request and security flow

### 4.1 Browser request

The user enters through the Next.js App Router. The dashboard layout loads the current organization, user, and active branch count. The dashboard navigation then exposes the available business areas.

The middleware performs the lightweight session-cookie redirect check. It does not decide tenant access or permissions.

### 4.2 Authentication context

Authenticated pages and server actions call `requireAuthContext()`.

That function:

1. Reads the current server-side session.
2. Obtains the active organization from the session.
3. Confirms the user has an active membership in that organization.
4. Loads the user's role and permissions.
5. Resolves branch restrictions from role and `UserBranch` assignments.
6. Returns the user identity, organization ID, permissions, branch scope, and tenant-scoped database client.

A request cannot choose its organization by posting an arbitrary `organizationId`. The organization comes from the server-side session.

### 4.3 Tenant-scoped database access

All normal authenticated business code uses `ctx.db`, not the raw Prisma client. `ctx.db` is created by `getTenantDb(organizationId)` and applies organization ownership rules to tenant models.

This protects against cross-tenant access when a user changes an ID in a URL, form, or request body. A record belonging to another organization is treated as unavailable.

### 4.4 Authorization

Server actions check permissions before changing data:

```text
requireAuthContext()
        |
assertPermission(ctx, PERMISSION)
        |
assertBranchAccess(ctx, branchId) where applicable
        |
validate input with Zod
        |
perform transaction
        |
write audit record
```

Expected validation and permission failures are returned as `ActionResult` values. Authentication failures and unexpected programming errors remain exceptions for the framework to handle.

## 5. Organization and branch setup

### Registering a business

The registration workflow creates the initial organization, owner user, membership, default role data, branch, warehouse, and register atomically. After registration, the owner receives a session and enters the dashboard.

### Adding a branch

A permitted administrator creates a branch through the branches action. The system provisions the branch's default warehouse and register so the location can immediately participate in stock and POS workflows.

A branch is the business location. A warehouse is the stock location used for inventory operations. A register is the POS/cash location used for sales and cash sessions.

## 6. Product catalog workflow

Every sellable product is represented by a `Product` with at least one `ProductVariant`. Even a simple product uses a default variant. Stock, price, SKU, barcode, purchasing, and sales all reference the variant rather than storing a parallel product-level quantity or price.

### Product information

A product/variant can contain:

- Name and variant name
- SKU
- One or more barcodes
- Category and brand
- Product image and description
- Cost price
- Selling price
- Wholesale price where configured
- Tax rate
- Unit/quantity-related settings
- Active/inactive state
- Reorder and maximum stock values

### Creating a product

The product action validates the submitted data with Zod, creates the product and first variant, and can record opening stock. Opening stock is inserted through the inventory service and creates an `OPENING_BALANCE` movement and FIFO batch.

### Adding a variant

A new size, color, flavour, pack size, or other variation is added as another `ProductVariant` under the same product. The variant has its own SKU and pricing and can have its own inventory.

### Searching at POS

The POS catalog searches product name, variant name, SKU, category, and barcode data. Selecting a product adds its variant to the current sale when stock is available in the selected warehouse.

## 7. Inventory workflow

Inventory is location-aware and uses three related concepts:

- `InventoryItem`: materialized current quantity for a warehouse, variant, and batch.
- `Batch`: a FIFO cost layer containing received quantity, remaining quantity, cost, and optional batch/expiry data.
- `InventoryMovement`: append-only history of every quantity change.

`InventoryItem` is optimized for current reads. The ledger is the historical source of truth. The inventory service is the only approved place for stock mutations.

### 7.1 Adding opening or new stock

Stock enters the system through opening stock, purchase receiving, returns, or an authorized increase adjustment.

For an increase, the inventory service:

1. Validates that quantity is positive.
2. Creates a FIFO batch with unit cost and quantity.
3. Creates the warehouse/variant inventory item for that batch.
4. Creates a positive inventory movement.
5. Performs all writes in the caller's database transaction.

To manually add stock to an existing item:

1. Open **Inventory**.
2. Select **Adjust stock**.
3. Choose the warehouse and product variant.
4. Choose **Add stock**.
5. Enter quantity and unit cost.
6. Select the reason and add notes if needed.
7. Apply the adjustment.

For supplier stock, use purchase receiving instead so the supplier and purchase order remain connected to the inventory history.

### 7.2 Removing stock

For a decrease, the service finds positive inventory batches at the selected warehouse and consumes the oldest batches first. If available stock is insufficient, the operation fails with a friendly error. Normal sales and adjustments cannot silently create negative stock.

### 7.3 Stock statuses

The inventory dashboard distinguishes:

- **Healthy**: above the restock threshold.
- **Needs restocking**: quantity is at or below five units, or at/below the configured reorder level.
- **Out of stock**: quantity is zero.
- **Negative stock**: a warning state for an exceptional/unbacked balance.

The dashboard supports warehouse filtering, product/SKU/barcode search, status filtering, stock value, total units, recent movement activity, and restock/out-of-stock attention lists.

### 7.4 Inventory valuation

Inventory value is calculated from quantity and FIFO cost layers, not selling price. When a sale consumes stock, each consumed FIFO layer contributes to the sale's cost of goods sold. This keeps stock valuation and profit reporting traceable to actual received costs.

## 8. Stock movement ledger

Every quantity-changing business event writes an `InventoryMovement` row. Movement quantities are signed:

```text
Sale              -2
Purchase          +50
Customer return   +1
Damage            -3
Adjustment        -2
Transfer out      -10
Transfer in       +10
```

A movement contains or can reference:

- Organization
- Warehouse and variant
- Batch where relevant
- Movement type
- Signed quantity
- Unit cost
- Reference type and reference ID
- Reason/notes
- User who created it
- Timestamp

The ledger supports stock history, FIFO costing, reconciliation, reporting, and audit review. Completed financial/inventory events are reversed or returned rather than deleted.

## 9. Purchasing and receiving workflow

Purchasing connects supplier commitments to inventory receipts.

```text
Supplier
   |
Purchase order
   |
Goods received
   |
FIFO batch + positive inventory movement
   |
Supplier invoice/payment
```

### Creating a purchase order

A permitted user selects a supplier, branch, warehouse, variants, ordered quantities, costs, and other order details. The action validates the data and creates the purchase order and line items.

### Receiving goods

Receiving can be partial. The receiving action:

1. Checks that the purchase order and receipt items exist.
2. Validates that received quantities do not exceed the outstanding quantity.
3. Creates goods receipt records.
4. Increases stock through the inventory service.
5. Creates FIFO batches using the received cost.
6. Writes purchase movements to the ledger.
7. Updates the purchase order status and received quantities.
8. Performs the linked work atomically.

A partially received order remains open until its outstanding quantities are received or the order is otherwise resolved.

### Supplier invoices and payments

Supplier invoices track amounts owed independently from the receipt event. Supplier payments reduce the outstanding invoice balance and preserve the payable history.

## 10. POS sales workflow

A sale is created from the POS only when a register session is open.

```text
Select branch and warehouse
        |
Find product by name, SKU, category, or barcode
        |
Add variant to cart
        |
Set quantity with +/- or direct input
        |
Select register, customer, and payment method
        |
Submit sale
        |
Server validates and recomputes totals
        |
Consume FIFO stock
        |
Create sale, sale items, payments, and cash movement
        |
Write sale inventory movement and audit record
        |
Show receipt
```

### Stock-aware catalog

The POS displays stock for the selected warehouse, not the total across all warehouses. Products with no stock cannot be added. The cart quantity is capped at the available quantity, and the user can enter a quantity directly as well as use the add and deduction controls.

Changing branch updates the available warehouses and clears the cart to prevent mixing stock from different locations.

### Server-side sale creation

The browser sends the selected branch, register, warehouse, customer, payment details, and line quantities. The sales action then:

1. Authenticates and authorizes the user.
2. Re-derives the branch, warehouse, register, customer, and variants from tenant data.
3. Recomputes prices, line totals, and subtotal on the server.
4. Verifies an open cash session.
5. Consumes inventory through FIFO.
6. Calculates COGS from the consumed batches.
7. Creates sale items with product, variant, SKU, quantity, price, and unit-cost snapshots.
8. Creates payment rows.
9. Creates a cash movement for cash received.
10. Commits the complete sale in one transaction.
11. Records a sale audit event and revalidates affected dashboard pages.

Client-provided totals and prices are never trusted.

### Payments

The POS supports cash, M-Pesa, card, bank transfer, credit, and split payment selection in the current interface. The server validates the payment amount against the sale total. Credit sales require a customer and are checked against the customer's credit limit.

### Cash sessions

A user opens a cash session for a branch and register before selling. The session summarizes sales and cash movements. Closing a session records the actual counted balance, cash removed, variance, and variance explanation where required. Held sales or invalid cash values prevent closing.

### Receipts

After a successful sale, the POS routes to the receipt page. Receipts use sale-item snapshots so later product edits do not change historical receipt content. Receipt notes can be updated through a protected action, and receipts can be printed or opened for download/rendering.

## 11. Customer and returns workflow

Customers can be created and selected during a sale. Customer payments can be recorded against outstanding credit.

A customer return is tied to an original sale and return items. A valid return increases inventory through the inventory service when the goods are sellable and records the refund/credit effect. Damaged or expired goods should be represented with an appropriate movement type rather than automatically treating every return as sellable stock.

## 12. Stock adjustments and reconciliation

An adjustment is controlled stock correction, not a direct quantity overwrite.

Supported adjustment reasons currently include:

- Manual adjustment
- Damaged goods
- Lost/theft
- Stock count correction

The adjustment action requires a warehouse, product variant, direction, positive quantity, reason type, and optional note/unit cost. It checks the user's inventory permission and branch access, performs the FIFO-aware stock operation, writes the movement, and records an audit event.

The broader stock-count design is:

```text
Start count
   |
Enter physical quantities
   |
Review system vs physical differences
   |
Approve count
   |
Create controlled stock-count adjustments
   |
Ledger and audit updated
```

The database contains stock-count models, but the complete review/approval workflow should be treated as an area for continued implementation unless a corresponding UI/action exists.

## 13. Transfers

Stock transfers are modeled between source and destination branches/warehouses. The intended lifecycle is:

```text
Draft -> Requested/approved -> Dispatched -> In transit -> Received
```

A completed implementation must decrease source stock when dispatched and increase destination stock when received, with paired `TRANSFER_OUT` and `TRANSFER_IN` ledger movements. This prevents stock from appearing as sellable in both locations while physically in transit.

The current repository includes transfer models and a transfer creation action. Transfer approval, dispatch, receiving, and the complete state-machine UI should be verified before treating the feature as fully operational.

## 14. Reports and exports

Reports derive business metrics from tenant-scoped sales, expenses, returns, inventory, and related records.

Current report concepts include:

- Sales totals and net revenue
- Discounts and refunds
- COGS and gross profit
- Expenses and estimated profit
- Transactions and cashier performance
- Product/category performance
- Payment method totals
- Inventory units and low-stock products
- Recent transactions

Inventory exports and product/report exports are exposed through route handlers for downloadable files. Financial values use Decimal arithmetic in application code and Decimal fields in Prisma.

## 15. Audit trail

Sensitive actions write an `AuditLog` entry after authorization and successful mutation. The audit record is not the permission mechanism; it is the durable explanation of what happened.

An inventory or sales investigation should be able to answer:

```text
Who       performed the action?
What      record or quantity changed?
When      did it happen?
Where     branch/warehouse/register?
Why       reason or reference?
```

Examples include organization registration, branch creation, user changes, product price changes, inventory adjustments, sale creation, voids, refunds, and other sensitive operations as their modules are implemented.

## 16. Data integrity rules

The following rules define the system's operating model:

1. Tenant identity comes from the authenticated session.
2. Tenant-owned queries use the tenant-scoped database client.
3. Permission checks happen before sensitive actions.
4. Branch access is checked for branch-specific operations.
5. Server actions validate client input with Zod.
6. Prices, totals, payment totals, and COGS are recomputed server-side.
7. Inventory mutations go through the inventory service.
8. Inventory changes pair materialized-balance updates with ledger entries.
9. FIFO consumption uses the oldest available cost layers first.
10. Multi-step operations use a single database transaction.
11. Financial and inventory history is not silently deleted.
12. Money uses Decimal rather than floating-point arithmetic.
13. Quantities use Decimal precision for pieces, kilograms, litres, and similar units.
14. Audit records preserve the actor and context of sensitive changes.

## 17. Permissions model

Permissions are global catalog entries. Roles are organization-scoped and connect users to permissions. Users can additionally be restricted to assigned branches.

Important permission examples include:

- `PRODUCTS_VIEW`
- `PRODUCTS_CREATE`
- `SALES_VIEW`
- `SALES_CREATE`
- `INVENTORY_VIEW`
- `INVENTORY_ADJUST`
- `PURCHASE_VIEW`
- `PURCHASE_CREATE`
- `CUSTOMERS_VIEW`
- `CASH_SESSION_CLOSE`
- `BRANCHES_MANAGE`
- `USERS_MANAGE`
- `AUDIT_LOG_VIEW`

The exact permission catalog is maintained in `src/lib/rbac/permissions.ts`. A cashier should be able to sell only within the access granted to their role and branch; stock adjustments, receiving, approvals, and cost visibility require stronger permissions.

## 18. Development workflow for new features

New business functionality follows this order:

1. Define the business workflow and invariants.
2. Update `prisma/schema.prisma`.
3. Create and apply a migration.
4. Add seed data if needed.
5. Build pure domain/service logic under `src/server/services`.
6. Add a server action under `src/app/actions`.
7. Add Zod validation under `src/lib/validation`.
8. Add permission and branch checks.
9. Add the UI under the relevant App Router route.
10. Add unit/integration tests.
11. Run `npx tsc --noEmit`.
12. Run `npm run lint`.
13. Run `npm run test`.

A feature should be marked as planned or partial when its data model exists without the complete server action, transaction behavior, UI, authorization, and tests.

## 19. Local setup and operations

Prerequisites:

- Node.js 20+
- PostgreSQL
- `DATABASE_URL`
- `DIRECT_URL`
- `AUTH_SECRET`

Typical setup:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Useful commands:

```bash
npm run dev
npm run build
npm run lint
npm run test
npx tsc --noEmit
npm run db:studio
npm run db:migrate:deploy
```

Production deployments use Vercel with a pooled runtime database URL and a direct migration URL. Production migrations use `prisma migrate deploy`, never `prisma migrate dev`.

## 20. Source map

| Area | Main location |
|---|---|
| Auth and sessions | `src/server/auth/`, `src/app/actions/auth.ts` |
| Tenant database | `src/server/db/tenant.ts`, `src/server/auth/context.ts` |
| Dashboard shell/sidebar | `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/dashboard/dashboard-nav.tsx` |
| Product catalog | `src/app/(dashboard)/dashboard/products/`, `src/app/actions/products.ts` |
| Inventory UI | `src/app/(dashboard)/dashboard/inventory/` |
| Inventory service | `src/server/services/inventory.ts` |
| FIFO calculation | `src/lib/inventory/fifo.ts` |
| Purchasing | `src/app/(dashboard)/dashboard/purchases/`, `src/app/actions/purchases.ts` |
| POS | `src/app/(dashboard)/dashboard/pos/`, `src/app/actions/sales.ts` |
| Customers and returns | `src/app/actions/customers.ts` |
| Reports | `src/app/(dashboard)/dashboard/reports/` |
| Audit | `src/server/services/audit.ts` |
| Schema | `prisma/schema.prisma` |
| Validation | `src/lib/validation/` |

## 21. Related documentation

- `README.md` - setup, stack, and current project status
- `ARCHITECTURE.md` - architecture decisions and roadmap
- `DATABASE.md` - schema and inventory ledger details
- `API.md` - server action conventions and route handler plans
- `SECURITY.md` - security controls and known gaps
- `DEPLOYMENT.md` - deployment and production database guidance
- `CONTRIBUTING.md` - implementation workflow and engineering conventions
