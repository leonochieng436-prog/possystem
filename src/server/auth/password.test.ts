import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  isPasswordStrongEnough,
} from "@/server/auth/password";

describe("password policy", () => {
  it("rejects passwords shorter than 8 characters", () => {
    expect(isPasswordStrongEnough("short1")).toBe(false);
    expect(isPasswordStrongEnough("longenough1")).toBe(true);
  });

  it("hashes and verifies correctly", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(hash).not.toBe("correct-horse-battery-staple");
    expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("produces a different hash each time (unique salt)", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });
});
