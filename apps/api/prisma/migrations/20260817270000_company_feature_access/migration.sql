-- Company-level module and menu entitlements.
-- Existing tenants retain every currently available feature.

ALTER TYPE "PlatformModule" ADD VALUE IF NOT EXISTS 'ORGANIZATION';
ALTER TYPE "PlatformModule" ADD VALUE IF NOT EXISTS 'GOALS';
ALTER TYPE "PlatformModule" ADD VALUE IF NOT EXISTS 'SETTINGS';

CREATE TABLE "company_features" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "feature" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "company_features_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_features_companyId_feature_key"
  ON "company_features"("companyId", "feature");
CREATE INDEX "company_features_companyId_idx"
  ON "company_features"("companyId");

ALTER TABLE "company_features"
  ADD CONSTRAINT "company_features_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
