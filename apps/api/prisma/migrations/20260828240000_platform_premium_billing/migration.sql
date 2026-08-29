-- Premium module entitlements and per-company billing inputs.

ALTER TYPE "PlatformModule" ADD VALUE IF NOT EXISTS 'PREMIUM';

CREATE TABLE "company_billings" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "licenseAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "subscriptionAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "marginPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_billings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_billings_companyId_key" ON "company_billings"("companyId");

ALTER TABLE "company_billings"
  ADD CONSTRAINT "company_billings_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "company_billings"
  ADD CONSTRAINT "company_billings_amounts_non_negative_check"
  CHECK (
    "taxAmount" >= 0
    AND "licenseAmount" >= 0
    AND "subscriptionAmount" >= 0
  );

ALTER TABLE "company_billings"
  ADD CONSTRAINT "company_billings_margin_percent_check"
  CHECK ("marginPercent" >= 0 AND "marginPercent" <= 100);
