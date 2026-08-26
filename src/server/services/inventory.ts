import "server-only";
import type { Prisma, InventoryMovementType } from "@prisma/client";
import Decimal from "decimal.js";
import { computeFifoConsumption } from "@/lib/inventory/fifo";

type Tx = Pick<Prisma.TransactionClient, "batch" | "inventoryItem" | "inventoryMovement">;

export class InsufficientStockError extends Error {
  shortfall: Decimal;
  constructor(shortfall: Decimal) {
    super(`Insufficient stock: short by ${shortfall.toString()}`);
    this.shortfall = shortfall;
  }
}

/**
 * INVENTORY SERVICE
 * =================
 * This module owns the invariant described in DATABASE.md: `InventoryItem`
 * (materialized balance) must always agree with the sum of
 * `InventoryMovement` rows for the same warehouse+variant. Nothing outside
 * this file should call `tx.inventoryItem.update`, `tx.batch.create`, or
 * `tx.inventoryMovement.create` directly — every call site (stock
 * adjustments today; purchases, sales, transfers in later phases) goes
 * through `increaseStock` / `decreaseStock` so that invariant can't drift.
 *
 * Every function here takes a transaction client and is meant to be
 * called from inside the caller's own `prisma.$transaction(...)` — this
 * module never opens its own transaction, so a stock change is always
 * atomic with whatever business event caused it (a sale, a received PO,
 * an adjustment).
 */

export interface IncreaseStockParams {
  organizationId: string;
  warehouseId: string;
  variantId: string;
  quantity: Decimal.Value; // must be > 0
  unitCost: Decimal.Value;
  type: InventoryMovementType; // OPENING_BALANCE | PURCHASE | SALE_RETURN | PURCHASE_RETURN(neg, see below) | ADJUSTMENT | TRANSFER_IN | STOCK_COUNT
  referenceType?: string;
  referenceId?: string;
  reason?: string;
  createdById: string;
  batchNumber?: string;
  expiryDate?: Date;
}

/** Increases stock: opens a new FIFO batch and records a positive movement. */
export async function increaseStock(tx: Tx, params: IncreaseStockParams) {
  const quantity = new Decimal(params.quantity);
  if (quantity.lessThanOrEqualTo(0)) {
    throw new Error("increaseStock quantity must be greater than zero");
  }

  const batch = await tx.batch.create({
    data: {
      warehouseId: params.warehouseId,
      variantId: params.variantId,
      unitCost: params.unitCost.toString(),
      quantityIn: quantity.toString(),
      quantityLeft: quantity.toString(),
      batchNumber: params.batchNumber,
      expiryDate: params.expiryDate,
    },
  });

  await tx.inventoryItem.create({
    data: {
      warehouseId: params.warehouseId,
      variantId: params.variantId,
      batchId: batch.id,
      quantity: quantity.toString(),
      averageCost: params.unitCost.toString(),
    },
  });

  const movement = await tx.inventoryMovement.create({
    data: {
      organizationId: params.organizationId,
      warehouseId: params.warehouseId,
      variantId: params.variantId,
      batchId: batch.id,
      type: params.type,
      quantity: quantity.toString(),
      unitCost: params.unitCost.toString(),
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      reason: params.reason,
      createdById: params.createdById,
    },
  });

  return { batch, movement };
}

export interface DecreaseStockParams {
  organizationId: string;
  warehouseId: string;
  variantId: string;
  quantity: Decimal.Value; // must be > 0 (the amount to remove)
  type: InventoryMovementType; // SALE | DAMAGE | LOSS | ADJUSTMENT | TRANSFER_OUT | EXPIRY | STOCK_COUNT
  referenceType?: string;
  referenceId?: string;
  reason?: string;
  createdById: string;
  /** If true, allow going below zero available stock instead of throwing. Default false. */
  allowNegative?: boolean;
}

/**
 * Decreases stock via FIFO: consumes the oldest batches at this warehouse
 * first. Throws `InsufficientStockError` if there isn't enough stock,
 * unless `allowNegative` is set. Returns the total cost consumed (for
 * COGS) and the per-batch breakdown.
 */
export async function decreaseStock(tx: Tx, params: DecreaseStockParams) {
  const quantity = new Decimal(params.quantity);
  if (quantity.lessThanOrEqualTo(0)) {
    throw new Error("decreaseStock quantity must be greater than zero");
  }

  const items = await tx.inventoryItem.findMany({
    where: {
      warehouseId: params.warehouseId,
      variantId: params.variantId,
      quantity: { gt: 0 },
    },
    include: { batch: true },
    orderBy: { batch: { receivedAt: "asc" } },
  });

  const availableBatches = items
    .filter((i) => i.batch)
    .map((i) => ({
      batchId: i.batchId as string,
      quantityLeft: i.quantity,
      unitCost: i.batch!.unitCost,
      receivedAt: i.batch!.receivedAt,
    }));

  const result = computeFifoConsumption(availableBatches, quantity);

  if (result.shortfall.greaterThan(0) && !params.allowNegative) {
    throw new InsufficientStockError(result.shortfall);
  }

  const movements = [];
  for (const line of result.lines) {
    await tx.inventoryItem.updateMany({
      where: {
        warehouseId: params.warehouseId,
        variantId: params.variantId,
        batchId: line.batchId,
      },
      data: { quantity: { decrement: line.quantity.toString() } },
    });
    await tx.batch.update({
      where: { id: line.batchId },
      data: { quantityLeft: { decrement: line.quantity.toString() } },
    });

    const movement = await tx.inventoryMovement.create({
      data: {
        organizationId: params.organizationId,
        warehouseId: params.warehouseId,
        variantId: params.variantId,
        batchId: line.batchId,
        type: params.type,
        quantity: line.quantity.negated().toString(),
        unitCost: line.unitCost.toString(),
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        reason: params.reason,
        createdById: params.createdById,
      },
    });
    movements.push(movement);
  }

  // If negative stock was explicitly allowed and there's a shortfall, log
  // the uncovered portion as a zero-cost movement so the ledger still
  // accounts for the full requested quantity.
  if (result.shortfall.greaterThan(0) && params.allowNegative) {
    const movement = await tx.inventoryMovement.create({
      data: {
        organizationId: params.organizationId,
        warehouseId: params.warehouseId,
        variantId: params.variantId,
        type: params.type,
        quantity: result.shortfall.negated().toString(),
        unitCost: "0",
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        reason: `${params.reason ?? ""} (unbacked — went negative)`.trim(),
        createdById: params.createdById,
      },
    });
    movements.push(movement);
  }

  return { totalCost: result.totalCost, totalConsumed: result.totalConsumed, movements };
}

/**
 * Net stock adjustment used by the "Adjust stock" UI: positive delta opens
 * a new batch at the given unit cost; negative delta consumes FIFO with
 * the given movement type (ADJUSTMENT, DAMAGE, LOSS, or STOCK_COUNT).
 */
export async function adjustStockQuantity(
  tx: Tx,
  params: {
    organizationId: string;
    warehouseId: string;
    variantId: string;
    delta: Decimal.Value; // signed
    unitCostForIncrease?: Decimal.Value; // required if delta > 0
    type: Extract<
      InventoryMovementType,
      "ADJUSTMENT" | "DAMAGE" | "LOSS" | "STOCK_COUNT"
    >;
    reason?: string;
    createdById: string;
  }
) {
  const delta = new Decimal(params.delta);
  if (delta.isZero()) {
    throw new Error("adjustStockQuantity delta must be non-zero");
  }

  if (delta.greaterThan(0)) {
    if (params.unitCostForIncrease === undefined) {
      throw new Error("unitCostForIncrease is required when increasing stock");
    }
    return increaseStock(tx, {
      organizationId: params.organizationId,
      warehouseId: params.warehouseId,
      variantId: params.variantId,
      quantity: delta,
      unitCost: params.unitCostForIncrease,
      type: params.type,
      reason: params.reason,
      createdById: params.createdById,
      referenceType: "ManualAdjustment",
    });
  }

  return decreaseStock(tx, {
    organizationId: params.organizationId,
    warehouseId: params.warehouseId,
    variantId: params.variantId,
    quantity: delta.abs(),
    type: params.type,
    reason: params.reason,
    createdById: params.createdById,
    referenceType: "ManualAdjustment",
  });
}

/** Current stock quantity for a variant at a warehouse (sum across batches). */
export async function getStockQuantity(
  tx: Tx,
  warehouseId: string,
  variantId: string
): Promise<Decimal> {
  const items = await tx.inventoryItem.findMany({
    where: { warehouseId, variantId },
    select: { quantity: true },
  });
  return items.reduce((sum, i) => sum.plus(i.quantity.toString()), new Decimal(0));
}
