-- AlterEnum
ALTER TYPE "CandidateStatus" ADD VALUE IF NOT EXISTS 'IN_POOL';

-- AlterTable
ALTER TABLE "companies" ADD COLUMN "atsThankYouLetterSubject" TEXT;
ALTER TABLE "companies" ADD COLUMN "atsThankYouLetterBody" TEXT;
ALTER TABLE "companies" ADD COLUMN "offerLetterTemplateFileName" TEXT;
ALTER TABLE "companies" ADD COLUMN "offerLetterTemplateOriginalName" TEXT;
ALTER TABLE "companies" ADD COLUMN "offerLetterTemplateMimeType" TEXT;
ALTER TABLE "companies" ADD COLUMN "contractTemplateFileName" TEXT;
ALTER TABLE "companies" ADD COLUMN "contractTemplateOriginalName" TEXT;
ALTER TABLE "companies" ADD COLUMN "contractTemplateMimeType" TEXT;

-- CreateTable
CREATE TABLE "contract_template_approvers" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "positionId" UUID NOT NULL,
    "employeeId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_template_approvers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_template_approvers_companyId_sequence_key" ON "contract_template_approvers"("companyId", "sequence");

-- CreateIndex
CREATE INDEX "contract_template_approvers_companyId_idx" ON "contract_template_approvers"("companyId");

-- CreateIndex
CREATE INDEX "contract_template_approvers_positionId_idx" ON "contract_template_approvers"("positionId");

-- CreateIndex
CREATE INDEX "contract_template_approvers_employeeId_idx" ON "contract_template_approvers"("employeeId");

-- AddForeignKey
ALTER TABLE "contract_template_approvers" ADD CONSTRAINT "contract_template_approvers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_template_approvers" ADD CONSTRAINT "contract_template_approvers_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_template_approvers" ADD CONSTRAINT "contract_template_approvers_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
