import { describe, expect, it } from "vitest";
import { calculateCustomerCreditBalance, calculateSaleOutstanding } from "./credit";

describe("credit calculations", () => {
  it("calculates the outstanding amount for a single credit sale", () => {
    expect(calculateSaleOutstanding("1200.00", "350.50")).toBe("849.50");
  });

  it("calculates the overall customer balance after partial payments", () => {
    const balance = calculateCustomerCreditBalance({
      creditSales: [
        { total: "1000.00", amountPaid: "250.00" },
        { total: "480.00", amountPaid: "0.00" },
      ],
      customerPayments: [{ amount: "300.00" }, { amount: "80.00" }],
    });

    expect(balance).toBe("850.00");
  });
});
