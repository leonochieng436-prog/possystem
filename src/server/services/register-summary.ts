import Decimal from "decimal.js";
import type { getTenantDb } from "@/server/db/tenant";

export const PAYMENT_METHODS = ["CASH", "MPESA", "CARD", "BANK_TRANSFER", "CREDIT", "OTHER"] as const;
export type PaymentMethodKey = (typeof PAYMENT_METHODS)[number];

type SummaryDb = ReturnType<typeof getTenantDb>;

export type RegisterSummary = {
  sessionId: string;
  status: "OPEN" | "CLOSED";
  openingCash: string;
  transactionCount: number;
  totalSales: string;
  payments: Record<PaymentMethodKey, string>;
  cashSales: string;
  cashRefunds: string;
  cashExpenses: string;
  cashDeposits: string;
  cashWithdrawals: string;
  expectedCash: string;
  openedAt: Date;
  closedAt: Date | null;
  cashier: string;
  branch: string;
  register: string;
  heldSales: number;
};

const zeroPayments = () => Object.fromEntries(PAYMENT_METHODS.map((method) => [method, new Decimal(0)])) as Record<PaymentMethodKey, Decimal>;

export async function getRegisterSummary(db: SummaryDb, sessionId: string): Promise<RegisterSummary | null> {
  const session = await db.cashSession.findFirst({ where: { id: sessionId }, include: { branch: true, register: true, user: true, sales: { where: { status: "COMPLETED" }, include: { payments: true } }, movements: true } });
  if (!session) return null;
  const heldSales = await db.sale.count({ where: { cashSessionId: session.id, status: "HELD" } });
  const payments = zeroPayments();
  for (const sale of session.sales) for (const payment of sale.payments) if (payment.status === "CONFIRMED") payments[payment.method as PaymentMethodKey] = (payments[payment.method as PaymentMethodKey] ?? new Decimal(0)).plus(payment.amount.toString());
  const movementTotals = { REFUND: new Decimal(0), EXPENSE: new Decimal(0), DEPOSIT: new Decimal(0), WITHDRAWAL: new Decimal(0) };
  for (const movement of session.movements) if (movement.type in movementTotals) movementTotals[movement.type as keyof typeof movementTotals] = movementTotals[movement.type as keyof typeof movementTotals].plus(movement.amount.toString());
  const cashSales = session.movements.filter((movement) => movement.type === "SALE").reduce((sum, movement) => sum.plus(movement.amount.toString()), new Decimal(0));
  const expectedCash = new Decimal(session.openingBalance.toString()).plus(cashSales).plus(movementTotals.DEPOSIT).minus(movementTotals.REFUND).minus(movementTotals.EXPENSE).minus(movementTotals.WITHDRAWAL);
  return { sessionId: session.id, status: session.status, openingCash: session.openingBalance.toString(), transactionCount: session.sales.length, totalSales: session.sales.reduce((sum, sale) => sum.plus(sale.total.toString()), new Decimal(0)).toFixed(2), payments: Object.fromEntries(PAYMENT_METHODS.map((method) => [method, payments[method].toFixed(2)])) as Record<PaymentMethodKey, string>, cashSales: cashSales.toFixed(2), cashRefunds: movementTotals.REFUND.toFixed(2), cashExpenses: movementTotals.EXPENSE.toFixed(2), cashDeposits: movementTotals.DEPOSIT.toFixed(2), cashWithdrawals: movementTotals.WITHDRAWAL.toFixed(2), expectedCash: expectedCash.toFixed(2), openedAt: session.openedAt, closedAt: session.closedAt, cashier: session.user.name, branch: session.branch.name, register: session.register.name, heldSales };
}
