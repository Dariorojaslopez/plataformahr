-- CreateEnum
CREATE TYPE "PerformanceResultStatus" AS ENUM ('CALCULATED', 'RELEASED');

-- AlterTable
ALTER TABLE "performance_cycles" ADD COLUMN     "managerEvaluationWeight" DECIMAL(5,2) NOT NULL DEFAULT 70.00,
ADD COLUMN     "selfEvaluationWeight" DECIMAL(5,2) NOT NULL DEFAULT 30.00;

ALTER TABLE "performance_cycles"
ADD CONSTRAINT "performance_cycles_selfEvaluationWeight_range_chk"
CHECK ("selfEvaluationWeight" >= 0 AND "selfEvaluationWeight" <= 100);

ALTER TABLE "performance_cycles"
ADD CONSTRAINT "performance_cycles_managerEvaluationWeight_range_chk"
CHECK ("managerEvaluationWeight" >= 0 AND "managerEvaluationWeight" <= 100);

-- CreateTable
CREATE TABLE "performance_results" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "selfScore" DECIMAL(5,2),
    "managerScore" DECIMAL(5,2),
    "overallScore" DECIMAL(5,2) NOT NULL,
    "configuredSelfWeight" DECIMAL(5,2) NOT NULL,
    "configuredManagerWeight" DECIMAL(5,2) NOT NULL,
    "effectiveSelfWeight" DECIMAL(5,2) NOT NULL,
    "effectiveManagerWeight" DECIMAL(5,2) NOT NULL,
    "status" "PerformanceResultStatus" NOT NULL DEFAULT 'CALCULATED',
    "calculatedAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "releasedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_results_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "performance_results_overallScore_range_chk" CHECK ("overallScore" >= 0 AND "overallScore" <= 100),
    CONSTRAINT "performance_results_selfScore_range_chk" CHECK ("selfScore" IS NULL OR ("selfScore" >= 0 AND "selfScore" <= 100)),
    CONSTRAINT "performance_results_managerScore_range_chk" CHECK ("managerScore" IS NULL OR ("managerScore" >= 0 AND "managerScore" <= 100)),
    CONSTRAINT "performance_results_configuredSelfWeight_range_chk" CHECK ("configuredSelfWeight" >= 0 AND "configuredSelfWeight" <= 100),
    CONSTRAINT "performance_results_configuredManagerWeight_range_chk" CHECK ("configuredManagerWeight" >= 0 AND "configuredManagerWeight" <= 100),
    CONSTRAINT "performance_results_effectiveSelfWeight_range_chk" CHECK ("effectiveSelfWeight" >= 0 AND "effectiveSelfWeight" <= 100),
    CONSTRAINT "performance_results_effectiveManagerWeight_range_chk" CHECK ("effectiveManagerWeight" >= 0 AND "effectiveManagerWeight" <= 100)
);

-- CreateIndex
CREATE INDEX "performance_results_companyId_idx" ON "performance_results"("companyId");

-- CreateIndex
CREATE INDEX "performance_results_cycleId_idx" ON "performance_results"("cycleId");

-- CreateIndex
CREATE INDEX "performance_results_employeeId_idx" ON "performance_results"("employeeId");

-- CreateIndex
CREATE INDEX "performance_results_status_idx" ON "performance_results"("status");

-- CreateIndex
CREATE UNIQUE INDEX "performance_results_participantId_key" ON "performance_results"("participantId");

-- AddForeignKey
ALTER TABLE "performance_results" ADD CONSTRAINT "performance_results_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_results" ADD CONSTRAINT "performance_results_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "performance_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_results" ADD CONSTRAINT "performance_results_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "performance_cycle_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_results" ADD CONSTRAINT "performance_results_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_results" ADD CONSTRAINT "performance_results_releasedByUserId_fkey" FOREIGN KEY ("releasedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
