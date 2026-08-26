import Decimal from "decimal.js";

export interface FifoBatchInput {
  batchId: string;
  quantityLeft: Decimal.Value;
  unitCost: Decimal.Value;
  receivedAt: Date;
}

export interface FifoConsumptionLine {
  batchId: string;
  quantity: Decimal;
  unitCost: Decimal;
}

export interface FifoConsumptionResult {
  lines: FifoConsumptionLine[];
  totalCost: Decimal;
  totalConsumed: Decimal;
  shortfall: Decimal; // > 0 means requested quantity could not be fully satisfied
}

/**
 * Pure FIFO allocation: given the batches available at a warehouse for a
 * variant (oldest first) and a quantity to consume, decide how much comes
 * out of each batch and what it cost. No I/O, no Prisma — this is the
 * function the DB-touching `consumeStock` wraps, and the one unit tests
 * exercise directly so the money math is verified without a database.
 *
 * Callers are expected to pass batches already sorted oldest-first
 * (receivedAt ascending) and already filtered to quantityLeft > 0.
 */
export function computeFifoConsumption(
  batches: FifoBatchInput[],
  quantityNeeded: Decimal.Value
): FifoConsumptionResult {
  let remaining = new Decimal(quantityNeeded);
  if (remaining.lessThanOrEqualTo(0)) {
    throw new Error("quantityNeeded must be greater than zero");
  }

  const lines: FifoConsumptionLine[] = [];
  let totalCost = new Decimal(0);
  let totalConsumed = new Decimal(0);

  for (const batch of batches) {
    if (remaining.lessThanOrEqualTo(0)) break;

    const available = new Decimal(batch.quantityLeft);
    if (available.lessThanOrEqualTo(0)) continue;

    const take = Decimal.min(available, remaining);
    const unitCost = new Decimal(batch.unitCost);

    lines.push({ batchId: batch.batchId, quantity: take, unitCost });
    totalCost = totalCost.plus(take.times(unitCost));
    totalConsumed = totalConsumed.plus(take);
    remaining = remaining.minus(take);
  }

  return {
    lines,
    totalCost,
    totalConsumed,
    shortfall: remaining.greaterThan(0) ? remaining : new Decimal(0),
  };
}

/** Weighted-average unit cost across a set of batches (for display only — COGS always uses FIFO lines, never this average). */
export function weightedAverageCost(
  batches: { quantityLeft: Decimal.Value; unitCost: Decimal.Value }[]
): Decimal {
  let totalQty = new Decimal(0);
  let totalValue = new Decimal(0);
  for (const b of batches) {
    const qty = new Decimal(b.quantityLeft);
    totalQty = totalQty.plus(qty);
    totalValue = totalValue.plus(qty.times(b.unitCost));
  }
  return totalQty.isZero() ? new Decimal(0) : totalValue.dividedBy(totalQty);
}
