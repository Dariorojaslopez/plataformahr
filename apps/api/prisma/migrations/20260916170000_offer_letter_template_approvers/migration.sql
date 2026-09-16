-- CreateTable
CREATE TABLE "offer_letter_template_approvers" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "positionId" UUID NOT NULL,
    "employeeId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offer_letter_template_approvers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "offer_letter_template_approvers_companyId_sequence_key" ON "offer_letter_template_approvers"("companyId", "sequence");

-- CreateIndex
CREATE INDEX "offer_letter_template_approvers_companyId_idx" ON "offer_letter_template_approvers"("companyId");

-- CreateIndex
CREATE INDEX "offer_letter_template_approvers_positionId_idx" ON "offer_letter_template_approvers"("positionId");

-- CreateIndex
CREATE INDEX "offer_letter_template_approvers_employeeId_idx" ON "offer_letter_template_approvers"("employeeId");

-- AddForeignKey
ALTER TABLE "offer_letter_template_approvers" ADD CONSTRAINT "offer_letter_template_approvers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_letter_template_approvers" ADD CONSTRAINT "offer_letter_template_approvers_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_letter_template_approvers" ADD CONSTRAINT "offer_letter_template_approvers_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
