import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { computeFifoConsumption, weightedAverageCost } from "@/lib/inventory/fifo";

const batch = (id: string, qty: number, cost: number, daysAgo: number) => ({
  batchId: id,
  quantityLeft: qty,
  unitCost: cost,
  receivedAt: new Date(Date.now() - daysAgo * 86_400_000),
});

describe("computeFifoConsumption", () => {
  it("consumes fully from the oldest batch when it has enough", () => {
    const batches = [batch("old", 100, 45, 10), batch("new", 100, 50, 1)];
    const result = computeFifoConsumption(batches, 30);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].batchId).toBe("old");
    expect(result.lines[0].quantity.toNumber()).toBe(30);
    expect(result.totalCost.toNumber()).toBe(30 * 45);
    expect(result.shortfall.toNumber()).toBe(0);
  });

  it("spills over into the next-oldest batch in order", () => {
    const batches = [batch("old", 20, 45, 10), batch("mid", 50, 48, 5), batch("new", 100, 50, 1)];
    const result = computeFifoConsumption(batches, 60);

    expect(result.lines.map((l) => l.batchId)).toEqual(["old", "mid"]);
    expect(result.lines[0].quantity.toNumber()).toBe(20);
    expect(result.lines[1].quantity.toNumber()).toBe(40);
    expect(result.totalConsumed.toNumber()).toBe(60);
    expect(result.totalCost.toNumber()).toBe(20 * 45 + 40 * 48);
    expect(result.shortfall.toNumber()).toBe(0);
  });

  it("reports a shortfall instead of over-consuming when stock is insufficient", () => {
    const batches = [batch("only", 10, 45, 1)];
    const result = computeFifoConsumption(batches, 25);

    expect(result.totalConsumed.toNumber()).toBe(10);
    expect(result.shortfall.toNumber()).toBe(15);
    expect(result.totalCost.toNumber()).toBe(10 * 45);
  });

  it("skips batches that are already exhausted", () => {
    const batches = [batch("empty", 0, 45, 5), batch("has-stock", 10, 50, 1)];
    const result = computeFifoConsumption(batches, 5);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].batchId).toBe("has-stock");
  });

  it("throws for a non-positive requested quantity", () => {
    expect(() => computeFifoConsumption([batch("a", 10, 1, 1)], 0)).toThrow();
    expect(() => computeFifoConsumption([batch("a", 10, 1, 1)], -5)).toThrow();
  });

  it("handles fractional quantities (e.g. kg) precisely", () => {
    const batches = [batch("a", 2.5, 120, 2)];
    const result = computeFifoConsumption(batches, 1.75);

    expect(result.lines[0].quantity.toNumber()).toBe(1.75);
    expect(result.totalCost.toNumber()).toBeCloseTo(1.75 * 120, 10);
  });
});

describe("weightedAverageCost", () => {
  it("returns zero for no stock", () => {
    expect(weightedAverageCost([]).toNumber()).toBe(0);
  });

  it("weights by remaining quantity, not batch count", () => {
    const avg = weightedAverageCost([
      { quantityLeft: 90, unitCost: 40 },
      { quantityLeft: 10, unitCost: 100 },
    ]);
    // (90*40 + 10*100) / 100 = 46
    expect(avg.toNumber()).toBe(46);
  });

  it("matches Decimal precision for fractional costs", () => {
    const avg = weightedAverageCost([{ quantityLeft: 3, unitCost: new Decimal("10.005") }]);
    expect(avg.toNumber()).toBeCloseTo(10.005, 10);
  });
});
