-- CreateEnum
CREATE TYPE "ContractApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "job_offers" ADD COLUMN "contractApprovalStatus" "ContractApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE "job_offers" ADD COLUMN "contractApprovalStartedAt" TIMESTAMP(3);
ALTER TABLE "job_offers" ADD COLUMN "contractApprovalCompletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "job_offer_contract_approvals" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "jobOfferId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "positionId" UUID NOT NULL,
    "approverEmployeeId" UUID NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decidedByUserId" UUID,
    "decidedAt" TIMESTAMP(3),
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_offer_contract_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_offers_contractApprovalStatus_idx" ON "job_offers"("contractApprovalStatus");

-- CreateIndex
CREATE INDEX "job_offer_contract_approvals_companyId_idx" ON "job_offer_contract_approvals"("companyId");

-- CreateIndex
CREATE INDEX "job_offer_contract_approvals_jobOfferId_idx" ON "job_offer_contract_approvals"("jobOfferId");

-- CreateIndex
CREATE INDEX "job_offer_contract_approvals_status_idx" ON "job_offer_contract_approvals"("status");

-- CreateIndex
CREATE INDEX "job_offer_contract_approvals_approverEmployeeId_idx" ON "job_offer_contract_approvals"("approverEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "job_offer_contract_approvals_jobOfferId_sequence_key" ON "job_offer_contract_approvals"("jobOfferId", "sequence");

-- AddForeignKey
ALTER TABLE "job_offer_contract_approvals" ADD CONSTRAINT "job_offer_contract_approvals_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_offer_contract_approvals" ADD CONSTRAINT "job_offer_contract_approvals_jobOfferId_fkey" FOREIGN KEY ("jobOfferId") REFERENCES "job_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_offer_contract_approvals" ADD CONSTRAINT "job_offer_contract_approvals_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_offer_contract_approvals" ADD CONSTRAINT "job_offer_contract_approvals_approverEmployeeId_fkey" FOREIGN KEY ("approverEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_offer_contract_approvals" ADD CONSTRAINT "job_offer_contract_approvals_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
