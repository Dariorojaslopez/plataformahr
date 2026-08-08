-- CreateEnum
CREATE TYPE "JobOfferStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SalaryPeriod" AS ENUM ('MONTHLY', 'ANNUAL', 'HOURLY');

-- CreateEnum
CREATE TYPE "OfferEmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'FIXED_TERM', 'CONTRACTOR');

-- CreateTable
CREATE TABLE "job_offers" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "status" "JobOfferStatus" NOT NULL DEFAULT 'DRAFT',
    "positionTitle" TEXT NOT NULL,
    "salaryAmount" DECIMAL(14,2) NOT NULL,
    "salaryCurrency" VARCHAR(3) NOT NULL DEFAULT 'COP',
    "salaryPeriod" "SalaryPeriod" NOT NULL DEFAULT 'MONTHLY',
    "employmentType" "OfferEmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "startDate" DATE,
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_offers_applicationId_key" ON "job_offers"("applicationId");

-- CreateIndex
CREATE INDEX "job_offers_companyId_idx" ON "job_offers"("companyId");

-- CreateIndex
CREATE INDEX "job_offers_status_idx" ON "job_offers"("status");

-- CreateIndex
CREATE INDEX "job_offers_createdByUserId_idx" ON "job_offers"("createdByUserId");

-- AddForeignKey
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integrity checks
ALTER TABLE "job_offers"
  ADD CONSTRAINT "job_offers_salary_nonnegative_check"
  CHECK ("salaryAmount" >= 0);

ALTER TABLE "job_offers"
  ADD CONSTRAINT "job_offers_currency_length_check"
  CHECK (char_length("salaryCurrency") = 3);
