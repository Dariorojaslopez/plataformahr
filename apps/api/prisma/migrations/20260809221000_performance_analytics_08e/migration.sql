-- AlterTable
ALTER TABLE "performance_results" ADD COLUMN     "areaIdSnapshot" UUID,
ADD COLUMN     "areaNameSnapshot" TEXT,
ADD COLUMN     "positionIdSnapshot" UUID,
ADD COLUMN     "positionNameSnapshot" TEXT,
ADD COLUMN     "businessUnitIdSnapshot" UUID,
ADD COLUMN     "businessUnitNameSnapshot" TEXT;

-- CreateIndex
CREATE INDEX "performance_results_companyId_cycleId_idx" ON "performance_results"("companyId", "cycleId");

-- CreateIndex
CREATE INDEX "performance_results_cycleId_status_idx" ON "performance_results"("cycleId", "status");

-- CreateIndex
CREATE INDEX "performance_results_areaIdSnapshot_idx" ON "performance_results"("areaIdSnapshot");

-- CreateIndex
CREATE INDEX "performance_results_positionIdSnapshot_idx" ON "performance_results"("positionIdSnapshot");

-- CreateIndex
CREATE INDEX "performance_results_businessUnitIdSnapshot_idx" ON "performance_results"("businessUnitIdSnapshot");
