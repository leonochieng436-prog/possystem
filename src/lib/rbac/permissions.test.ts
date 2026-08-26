import { describe, it, expect } from "vitest";
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  DEFAULT_ROLE_PERMISSIONS,
  SYSTEM_ROLES,
} from "@/lib/rbac/permissions";

const ALL_KEYS = new Set(Object.keys(PERMISSIONS));

describe("permission catalog integrity", () => {
  it("every key referenced in PERMISSION_GROUPS exists in PERMISSIONS", () => {
    for (const keys of Object.values(PERMISSION_GROUPS)) {
      for (const key of keys) {
        expect(ALL_KEYS.has(key)).toBe(true);
      }
    }
  });

  it("every permission key belongs to exactly one group", () => {
    const seen = new Map<string, string>();
    for (const [group, keys] of Object.entries(PERMISSION_GROUPS)) {
      for (const key of keys) {
        expect(seen.has(key)).toBe(false);
        seen.set(key, group);
      }
    }
    expect(seen.size).toBe(ALL_KEYS.size);
  });

  it("every default-role permission key is a real permission", () => {
    for (const keys of Object.values(DEFAULT_ROLE_PERMISSIONS)) {
      for (const key of keys) {
        expect(ALL_KEYS.has(key)).toBe(true);
      }
    }
  });

  it("owner has every permission in the system", () => {
    expect(new Set(DEFAULT_ROLE_PERMISSIONS.owner)).toEqual(ALL_KEYS);
  });

  it("cashier cannot void or refund sales", () => {
    const cashierPerms = new Set(DEFAULT_ROLE_PERMISSIONS.cashier);
    expect(cashierPerms.has("SALES_VOID")).toBe(false);
    expect(cashierPerms.has("SALES_REFUND")).toBe(false);
    expect(cashierPerms.has("SALES_CREATE")).toBe(true);
  });

  it("every system role has a default permission set defined", () => {
    for (const role of SYSTEM_ROLES) {
      expect(DEFAULT_ROLE_PERMISSIONS[role.slug]).toBeDefined();
      expect(DEFAULT_ROLE_PERMISSIONS[role.slug].length).toBeGreaterThan(0);
    }
  });
});
