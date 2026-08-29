import { Prisma } from '@prisma/client';

export type BillingAmounts = {
  taxAmount: Prisma.Decimal;
  licenseAmount: Prisma.Decimal;
  subscriptionAmount: Prisma.Decimal;
  marginPercent: Prisma.Decimal;
};

export type BillingTotals = {
  costTotal: Prisma.Decimal;
  chargedAmount: Prisma.Decimal;
  netProfit: Prisma.Decimal;
};

export function parseBillingDecimal(
  value: string,
  field: string,
): Prisma.Decimal {
  const decimal = new Prisma.Decimal(value);
  if (decimal.isNegative()) {
    throw new Error(`${field} must be >= 0`);
  }
  return decimal.toDecimalPlaces(2);
}

export function calculateBilling(input: BillingAmounts): BillingTotals {
  const costTotal = input.taxAmount
    .plus(input.licenseAmount)
    .plus(input.subscriptionAmount)
    .toDecimalPlaces(2);
  const chargedAmount = costTotal
    .times(new Prisma.Decimal(1).plus(input.marginPercent.dividedBy(100)))
    .toDecimalPlaces(2);
  const netProfit = chargedAmount.minus(costTotal).toDecimalPlaces(2);
  return { costTotal, chargedAmount, netProfit };
}

export function moneyToString(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

export const EMPTY_BILLING_AMOUNTS: BillingAmounts = {
  taxAmount: new Prisma.Decimal(0),
  licenseAmount: new Prisma.Decimal(0),
  subscriptionAmount: new Prisma.Decimal(0),
  marginPercent: new Prisma.Decimal(0),
};
