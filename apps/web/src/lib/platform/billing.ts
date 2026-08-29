export type CompanyBillingItem = {
  companyId: string;
  companyName: string;
  taxAmount: string;
  licenseAmount: string;
  subscriptionAmount: string;
  marginPercent: string;
  costTotal: string;
  chargedAmount: string;
  netProfit: string;
};

export type PlatformBillingReport = {
  items: CompanyBillingItem[];
  totals: {
    costTotal: string;
    chargedAmount: string;
    netProfit: string;
  };
};

export type UpdateCompanyBillingInput = {
  taxAmount: string;
  licenseAmount: string;
  subscriptionAmount: string;
  marginPercent: string;
};

export function formatCop(amount: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
