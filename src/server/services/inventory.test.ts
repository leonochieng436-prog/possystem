import { describe, it, expect, beforeEach } from "vitest";
import {
  increaseStock,
  decreaseStock,
  adjustStockQuantity,
  getStockQuantity,
  InsufficientStockError,
} from "@/server/services/inventory";

/**
 * A minimal in-memory stand-in for the slice of Prisma.TransactionClient
 * that the inventory service touches (batch, inventoryItem,
 * inventoryMovement). This lets the core stock-mutation logic — the most
 * financially sensitive code in the system — be verified without a real
 * database, complementing the pure-function tests in fifo.test.ts.
 *
 * eslint-disable @typescript-eslint/no-explicit-any --
 * this fake deliberately mirrors Prisma's loosely-typed `{ where, data }`
 * argument shape rather than importing the real (unavailable in this
 * sandbox) generated Prisma types.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
function createFakeTx() {
  let idCounter = 0;
  const nextId = () => `id_${++idCounter}`;

  const batches: any[] = [];
  const inventoryItems: any[] = [];
  const movements: any[] = [];

  return {
    batch: {
      async create({ data }: any) {
        const row = { id: nextId(), ...data };
        batches.push(row);
        return row;
      },
      async update({ where, data }: any) {
        const row = batches.find((b) => b.id === where.id);
        if (data.quantityLeft?.decrement !== undefined) {
          row.quantityLeft = (
            Number(row.quantityLeft) - Number(data.quantityLeft.decrement)
          ).toString();
        }
        return row;
      },
    },
    inventoryItem: {
      async create({ data }: any) {
        const row = { id: nextId(), ...data };
        inventoryItems.push(row);
        return row;
      },
      async findMany({ where }: any) {
        return inventoryItems
          .filter(
            (i) =>
              i.warehouseId === where.warehouseId &&
              i.variantId === where.variantId &&
              (where.quantity?.gt === undefined || Number(i.quantity) > where.quantity.gt)
          )
          .map((i) => ({ ...i, batch: batches.find((b) => b.id === i.batchId) }));
      },
      async updateMany({ where, data }: any) {
        const matches = inventoryItems.filter(
          (i) =>
            i.warehouseId === where.warehouseId &&
            i.variantId === where.variantId &&
            i.batchId === where.batchId
        );
        for (const row of matches) {
          if (data.quantity?.decrement !== undefined) {
            row.quantity = (Number(row.quantity) - Number(data.quantity.decrement)).toString();
          }
        }
        return { count: matches.length };
      },
    },
    inventoryMovement: {
      async create({ data }: any) {
        const row = { id: nextId(), ...data };
        movements.push(row);
        return row;
      },
    },
    _state: { batches, inventoryItems, movements },
  };
}

const ORG = "org_1";
const WAREHOUSE = "wh_1";
const VARIANT = "variant_1";
const USER = "user_1";

describe("increaseStock", () => {
  it("opens a new batch and records a positive movement", async () => {
    const tx = createFakeTx();
    await increaseStock(tx as any, {
      organizationId: ORG,
      warehouseId: WAREHOUSE,
      variantId: VARIANT,
      quantity: 50,
      unitCost: 40,
      type: "OPENING_BALANCE",
      createdById: USER,
    });

    expect(tx._state.batches).toHaveLength(1);
    expect(tx._state.batches[0].quantityLeft).toBe("50");
    expect(tx._state.movements[0].quantity).toBe("50");
    const stock = await getStockQuantity(tx as any, WAREHOUSE, VARIANT);
    expect(stock.toNumber()).toBe(50);
  });

  it("rejects a non-positive quantity", async () => {
    const tx = createFakeTx();
    await expect(
      increaseStock(tx as any, {
        organizationId: ORG,
        warehouseId: WAREHOUSE,
        variantId: VARIANT,
        quantity: 0,
        unitCost: 10,
        type: "ADJUSTMENT",
        createdById: USER,
      })
    ).rejects.toThrow();
  });
});

describe("decreaseStock (FIFO)", () => {
  let tx: ReturnType<typeof createFakeTx>;

  beforeEach(async () => {
    tx = createFakeTx();
    // Older, cheaper batch first
    await increaseStock(tx as any, {
      organizationId: ORG,
      warehouseId: WAREHOUSE,
      variantId: VARIANT,
      quantity: 20,
      unitCost: 40,
      type: "OPENING_BALANCE",
      createdById: USER,
    });
    // Newer, pricier batch
    await increaseStock(tx as any, {
      organizationId: ORG,
      warehouseId: WAREHOUSE,
      variantId: VARIANT,
      quantity: 30,
      unitCost: 50,
      type: "PURCHASE",
      createdById: USER,
    });
  });

  it("consumes the oldest batch first and computes correct COGS", async () => {
    const result = await decreaseStock(tx as any, {
      organizationId: ORG,
      warehouseId: WAREHOUSE,
      variantId: VARIANT,
      quantity: 15,
      type: "SALE",
      createdById: USER,
    });

    expect(result.totalConsumed.toNumber()).toBe(15);
    expect(result.totalCost.toNumber()).toBe(15 * 40); // fully from the older/cheaper batch
    expect(tx._state.batches[0].quantityLeft).toBe("5"); // 20 - 15
    expect(tx._state.batches[1].quantityLeft).toBe("30"); // untouched
  });

  it("spills into the next batch once the oldest is exhausted", async () => {
    const result = await decreaseStock(tx as any, {
      organizationId: ORG,
      warehouseId: WAREHOUSE,
      variantId: VARIANT,
      quantity: 35, // 20 from old @40 + 15 from new @50
      type: "SALE",
      createdById: USER,
    });

    expect(result.totalConsumed.toNumber()).toBe(35);
    expect(result.totalCost.toNumber()).toBe(20 * 40 + 15 * 50);
  });

  it("throws InsufficientStockError instead of over-consuming", async () => {
    await expect(
      decreaseStock(tx as any, {
        organizationId: ORG,
        warehouseId: WAREHOUSE,
        variantId: VARIANT,
        quantity: 1000,
        type: "SALE",
        createdById: USER,
      })
    ).rejects.toBeInstanceOf(InsufficientStockError);

    // And critically: a failed attempt must not have mutated any state.
    expect(tx._state.batches[0].quantityLeft).toBe("20");
    expect(tx._state.batches[1].quantityLeft).toBe("30");
  });
});

describe("adjustStockQuantity", () => {
  it("routes a positive delta through increaseStock with the given unit cost", async () => {
    const tx = createFakeTx();
    await adjustStockQuantity(tx as any, {
      organizationId: ORG,
      warehouseId: WAREHOUSE,
      variantId: VARIANT,
      delta: 10,
      unitCostForIncrease: 25,
      type: "ADJUSTMENT",
      createdById: USER,
    });

    expect(tx._state.batches).toHaveLength(1);
    expect(tx._state.batches[0].unitCost).toBe("25");
    expect(tx._state.movements[0].type).toBe("ADJUSTMENT");
  });

  it("requires a unit cost when increasing stock", async () => {
    const tx = createFakeTx();
    await expect(
      adjustStockQuantity(tx as any, {
        organizationId: ORG,
        warehouseId: WAREHOUSE,
        variantId: VARIANT,
        delta: 10,
        type: "ADJUSTMENT",
        createdById: USER,
      })
    ).rejects.toThrow(/unitCostForIncrease/);
  });

  it("routes a negative delta through decreaseStock via FIFO", async () => {
    const tx = createFakeTx();
    await increaseStock(tx as any, {
      organizationId: ORG,
      warehouseId: WAREHOUSE,
      variantId: VARIANT,
      quantity: 10,
      unitCost: 30,
      type: "OPENING_BALANCE",
      createdById: USER,
    });

    await adjustStockQuantity(tx as any, {
      organizationId: ORG,
      warehouseId: WAREHOUSE,
      variantId: VARIANT,
      delta: -4,
      type: "DAMAGE",
      createdById: USER,
    });

    expect(tx._state.batches[0].quantityLeft).toBe("6");
    expect(tx._state.movements.at(-1).type).toBe("DAMAGE");
    expect(tx._state.movements.at(-1).quantity).toBe("-4");
  });

  it("rejects a zero delta", async () => {
    const tx = createFakeTx();
    await expect(
      adjustStockQuantity(tx as any, {
        organizationId: ORG,
        warehouseId: WAREHOUSE,
        variantId: VARIANT,
        delta: 0,
        type: "ADJUSTMENT",
        createdById: USER,
      })
    ).rejects.toThrow();
  });
});
