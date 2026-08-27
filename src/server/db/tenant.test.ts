import { describe, expect, it } from "vitest";
import { isTenantModel, TENANT_MODELS } from "./tenant";

describe("tenant model coverage", () => {
  it("keeps direct cash and refund records tenant-scoped", () => {
    expect(TENANT_MODELS).toEqual(expect.arrayContaining(["cashSession", "saleReturn"]));
  });

  it("covers the core business-owned models", () => {
    expect(TENANT_MODELS).toEqual(expect.arrayContaining([
      "branch",
      "product",
      "customer",
      "sale",
      "payment",
      "expense",
      "auditLog",
    ]));
  });

  it("matches Prisma model names regardless of capitalization", () => {
    expect(isTenantModel("Product")).toBe(true);
    expect(isTenantModel("CashSession")).toBe(true);
    expect(isTenantModel("SaleReturn")).toBe(true);
    expect(isTenantModel("Permission")).toBe(false);
  });
});