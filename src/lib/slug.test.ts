import { describe, it, expect } from "vitest";
import { slugify, uniqueOrgSlug } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Leon Retail Store")).toBe("leon-retail-store");
  });

  it("strips non-alphanumeric characters", () => {
    expect(slugify("Mama's Shop & Co.!!")).toBe("mama-s-shop-co");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  --Weird Name--  ")).toBe("weird-name");
  });
});

describe("uniqueOrgSlug", () => {
  it("returns the base slug when available", async () => {
    const slug = await uniqueOrgSlug("Leon Retail Store", async () => false);
    expect(slug).toBe("leon-retail-store");
  });

  it("appends an incrementing suffix on collision", async () => {
    const taken = new Set(["leon-retail-store", "leon-retail-store-2"]);
    const slug = await uniqueOrgSlug("Leon Retail Store", async (s) =>
      taken.has(s)
    );
    expect(slug).toBe("leon-retail-store-3");
  });
});
