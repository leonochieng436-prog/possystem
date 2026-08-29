import Decimal from "decimal.js";

export function calculateSaleOutstanding(total: string, amountPaid: string) {
  return new Decimal(total).minus(new Decimal(amountPaid)).toFixed(2);
}

export function calculateCustomerCreditBalance({
  creditSales,
  customerPayments,
}: {
  creditSales: Array<{ total: string; amountPaid: string }>;
  customerPayments: Array<{ amount: string }>;
}) {
  const salesTotal = creditSales.reduce(
    (sum, sale) => sum.plus(new Decimal(sale.total).minus(new Decimal(sale.amountPaid))),
    new Decimal(0),
  );
  const paymentsTotal = customerPayments.reduce(
    (sum, payment) => sum.plus(new Decimal(payment.amount)),
    new Decimal(0),
  );

  return salesTotal.minus(paymentsTotal).toFixed(2);
}
