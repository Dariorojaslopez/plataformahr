import { Prisma } from '@prisma/client';
import {
  calculateBilling,
  EMPTY_BILLING_AMOUNTS,
  moneyToString,
} from './platform-billing.calc';

describe('platform billing calculation', () => {
  it('charges costs plus the configured margin', () => {
    const result = calculateBilling({
      taxAmount: new Prisma.Decimal('19000.00'),
      licenseAmount: new Prisma.Decimal('50000.00'),
      subscriptionAmount: new Prisma.Decimal('31000.00'),
      marginPercent: new Prisma.Decimal('20.00'),
    });
    expect(moneyToString(result.costTotal)).toBe('100000.00');
    expect(moneyToString(result.chargedAmount)).toBe('120000.00');
    expect(moneyToString(result.netProfit)).toBe('20000.00');
  });

  it('yields zero profit when there is no margin', () => {
    const result = calculateBilling({
      ...EMPTY_BILLING_AMOUNTS,
      subscriptionAmount: new Prisma.Decimal('80.50'),
    });
    expect(moneyToString(result.costTotal)).toBe('80.50');
    expect(moneyToString(result.chargedAmount)).toBe('80.50');
    expect(moneyToString(result.netProfit)).toBe('0.00');
  });
});
