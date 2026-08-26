import { describe, expect, it } from "vitest";
import { formatMoney, formatNumber, normalizePaperSize, paymentLabel } from "./receipt-utils";

describe("receipt utilities", () => {
  it("formats Kenyan currency and quantities consistently", () => {
    expect(formatMoney("649.6")).toBe("KSh 649.60");
    expect(formatNumber("2.5")).toBe("2.5");
  });

  it("normalizes supported paper sizes and payment labels", () => {
    expect(normalizePaperSize("58mm")).toBe("58mm");
    expect(normalizePaperSize("letter")).toBe("80mm");
    expect(paymentLabel("BANK_TRANSFER")).toBe("Bank Transfer");
  });
});