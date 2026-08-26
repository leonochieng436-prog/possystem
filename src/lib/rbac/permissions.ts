/**
 * PERMISSION CATALOG
 * ===================
 * The full set of permission keys in the system. This is the single
 * source of truth: the seed script writes these into the `Permission`
 * table, role management UI reads from here, and `requirePermission()`
 * checks against these string literals — so a typo is a compile error,
 * not a silent authorization bypass.
 */
export const PERMISSIONS = {
  // Sales / POS
  SALES_VIEW: "SALES_VIEW",
  SALES_CREATE: "SALES_CREATE",
  SALES_VOID: "SALES_VOID",
  SALES_REFUND: "SALES_REFUND",
  SALES_DISCOUNT_OVERRIDE: "SALES_DISCOUNT_OVERRIDE",
  SALES_PRICE_OVERRIDE: "SALES_PRICE_OVERRIDE",

  // Cash register
  CASH_SESSION_OPEN: "CASH_SESSION_OPEN",
  CASH_SESSION_CLOSE: "CASH_SESSION_CLOSE",
  CASH_SESSION_VIEW_ALL: "CASH_SESSION_VIEW_ALL",

  // Products / catalog
  PRODUCTS_VIEW: "PRODUCTS_VIEW",
  PRODUCTS_CREATE: "PRODUCTS_CREATE",
  PRODUCTS_UPDATE: "PRODUCTS_UPDATE",
  PRODUCTS_DELETE: "PRODUCTS_DELETE",

  // Inventory
  INVENTORY_VIEW: "INVENTORY_VIEW",
  INVENTORY_ADJUST: "INVENTORY_ADJUST",
  INVENTORY_TRANSFER: "INVENTORY_TRANSFER",
  INVENTORY_STOCK_COUNT: "INVENTORY_STOCK_COUNT",

  // Suppliers / procurement
  SUPPLIERS_VIEW: "SUPPLIERS_VIEW",
  SUPPLIERS_MANAGE: "SUPPLIERS_MANAGE",
  PURCHASE_VIEW: "PURCHASE_VIEW",
  PURCHASE_CREATE: "PURCHASE_CREATE",
  PURCHASE_APPROVE: "PURCHASE_APPROVE",
  PURCHASE_RECEIVE: "PURCHASE_RECEIVE",

  // Customers
  CUSTOMERS_VIEW: "CUSTOMERS_VIEW",
  CUSTOMERS_MANAGE: "CUSTOMERS_MANAGE",
  CUSTOMER_CREDIT_MANAGE: "CUSTOMER_CREDIT_MANAGE",

  // Expenses
  EXPENSE_VIEW: "EXPENSE_VIEW",
  EXPENSE_CREATE: "EXPENSE_CREATE",
  EXPENSE_DELETE: "EXPENSE_DELETE",

  // Reports / analytics
  REPORTS_VIEW: "REPORTS_VIEW",
  REPORTS_EXPORT: "REPORTS_EXPORT",
  ANALYTICS_VIEW: "ANALYTICS_VIEW",

  // Users / org / settings
  USERS_MANAGE: "USERS_MANAGE",
  ROLES_MANAGE: "ROLES_MANAGE",
  BRANCHES_MANAGE: "BRANCHES_MANAGE",
  SETTINGS_MANAGE: "SETTINGS_MANAGE",
  AUDIT_LOG_VIEW: "AUDIT_LOG_VIEW",
  BILLING_MANAGE: "BILLING_MANAGE",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const PERMISSION_GROUPS: Record<string, PermissionKey[]> = {
  Sales: [
    "SALES_VIEW",
    "SALES_CREATE",
    "SALES_VOID",
    "SALES_REFUND",
    "SALES_DISCOUNT_OVERRIDE",
    "SALES_PRICE_OVERRIDE",
  ],
  "Cash Register": ["CASH_SESSION_OPEN", "CASH_SESSION_CLOSE", "CASH_SESSION_VIEW_ALL"],
  Products: ["PRODUCTS_VIEW", "PRODUCTS_CREATE", "PRODUCTS_UPDATE", "PRODUCTS_DELETE"],
  Inventory: [
    "INVENTORY_VIEW",
    "INVENTORY_ADJUST",
    "INVENTORY_TRANSFER",
    "INVENTORY_STOCK_COUNT",
  ],
  Procurement: [
    "SUPPLIERS_VIEW",
    "SUPPLIERS_MANAGE",
    "PURCHASE_VIEW",
    "PURCHASE_CREATE",
    "PURCHASE_APPROVE",
    "PURCHASE_RECEIVE",
  ],
  Customers: ["CUSTOMERS_VIEW", "CUSTOMERS_MANAGE", "CUSTOMER_CREDIT_MANAGE"],
  Expenses: ["EXPENSE_VIEW", "EXPENSE_CREATE", "EXPENSE_DELETE"],
  "Reports & Analytics": ["REPORTS_VIEW", "REPORTS_EXPORT", "ANALYTICS_VIEW"],
  Administration: [
    "USERS_MANAGE",
    "ROLES_MANAGE",
    "BRANCHES_MANAGE",
    "SETTINGS_MANAGE",
    "AUDIT_LOG_VIEW",
    "BILLING_MANAGE",
  ],
};

// Default permission sets for the seeded system roles. Businesses can
// customize from here, but these are sane, spec-driven starting points.
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  owner: Object.keys(PERMISSIONS) as PermissionKey[],
  administrator: Object.keys(PERMISSIONS).filter(
    (k) => k !== "BILLING_MANAGE"
  ) as PermissionKey[],
  manager: [
    "SALES_VIEW",
    "SALES_CREATE",
    "SALES_VOID",
    "SALES_REFUND",
    "CASH_SESSION_OPEN",
    "CASH_SESSION_CLOSE",
    "CASH_SESSION_VIEW_ALL",
    "PRODUCTS_VIEW",
    "PRODUCTS_CREATE",
    "PRODUCTS_UPDATE",
    "INVENTORY_VIEW",
    "INVENTORY_ADJUST",
    "INVENTORY_TRANSFER",
    "INVENTORY_STOCK_COUNT",
    "SUPPLIERS_VIEW",
    "PURCHASE_VIEW",
    "PURCHASE_CREATE",
    "PURCHASE_RECEIVE",
    "CUSTOMERS_VIEW",
    "CUSTOMERS_MANAGE",
    "CUSTOMER_CREDIT_MANAGE",
    "EXPENSE_VIEW",
    "EXPENSE_CREATE",
    "REPORTS_VIEW",
    "REPORTS_EXPORT",
    "ANALYTICS_VIEW",
  ],
  cashier: [
    "SALES_VIEW",
    "SALES_CREATE",
    "CASH_SESSION_OPEN",
    "CASH_SESSION_CLOSE",
    "PRODUCTS_VIEW",
    "CUSTOMERS_VIEW",
    "CUSTOMERS_MANAGE",
  ],
  inventory_manager: [
    "PRODUCTS_VIEW",
    "PRODUCTS_CREATE",
    "PRODUCTS_UPDATE",
    "INVENTORY_VIEW",
    "INVENTORY_ADJUST",
    "INVENTORY_TRANSFER",
    "INVENTORY_STOCK_COUNT",
    "SUPPLIERS_VIEW",
    "REPORTS_VIEW",
  ],
  procurement_officer: [
    "SUPPLIERS_VIEW",
    "SUPPLIERS_MANAGE",
    "PURCHASE_VIEW",
    "PURCHASE_CREATE",
    "PURCHASE_APPROVE",
    "PURCHASE_RECEIVE",
    "PRODUCTS_VIEW",
    "REPORTS_VIEW",
  ],
  accountant: [
    "SALES_VIEW",
    "EXPENSE_VIEW",
    "EXPENSE_CREATE",
    "CUSTOMERS_VIEW",
    "CUSTOMER_CREDIT_MANAGE",
    "SUPPLIERS_VIEW",
    "PURCHASE_VIEW",
    "REPORTS_VIEW",
    "REPORTS_EXPORT",
    "ANALYTICS_VIEW",
    "AUDIT_LOG_VIEW",
  ],
};

export const SYSTEM_ROLES = [
  { slug: "owner", name: "Owner" },
  { slug: "administrator", name: "Administrator" },
  { slug: "manager", name: "Manager" },
  { slug: "cashier", name: "Cashier" },
  { slug: "inventory_manager", name: "Inventory Manager" },
  { slug: "procurement_officer", name: "Procurement Officer" },
  { slug: "accountant", name: "Accountant" },
] as const;
