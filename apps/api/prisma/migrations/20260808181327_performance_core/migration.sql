-- CreateEnum
CREATE TYPE "PerformanceCycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "performance_cycles" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "evaluationStartDate" DATE,
    "evaluationEndDate" DATE,
    "status" "PerformanceCycleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competencies" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "status" "OrganizationEntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "defaultScaleId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "competencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_scales" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "OrganizationEntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "competency_scales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_scale_levels" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "scaleId" UUID NOT NULL,
    "value" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competency_scale_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_cycle_competencies" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "competencyId" UUID NOT NULL,
    "scaleId" UUID NOT NULL,
    "weight" DECIMAL(5,2),
    "order" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_cycle_competencies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "performance_cycles_companyId_idx" ON "performance_cycles"("companyId");

-- CreateIndex
CREATE INDEX "performance_cycles_status_idx" ON "performance_cycles"("status");

-- CreateIndex
CREATE INDEX "performance_cycles_createdByUserId_idx" ON "performance_cycles"("createdByUserId");

-- CreateIndex
CREATE INDEX "competencies_companyId_idx" ON "competencies"("companyId");

-- CreateIndex
CREATE INDEX "competencies_status_idx" ON "competencies"("status");

-- CreateIndex
CREATE INDEX "competencies_defaultScaleId_idx" ON "competencies"("defaultScaleId");

-- CreateIndex
CREATE UNIQUE INDEX "competencies_companyId_name_key" ON "competencies"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "competencies_companyId_code_key" ON "competencies"("companyId", "code");

-- CreateIndex
CREATE INDEX "competency_scales_companyId_idx" ON "competency_scales"("companyId");

-- CreateIndex
CREATE INDEX "competency_scales_status_idx" ON "competency_scales"("status");

-- CreateIndex
CREATE UNIQUE INDEX "competency_scales_companyId_name_key" ON "competency_scales"("companyId", "name");

-- CreateIndex
CREATE INDEX "competency_scale_levels_companyId_idx" ON "competency_scale_levels"("companyId");

-- CreateIndex
CREATE INDEX "competency_scale_levels_scaleId_idx" ON "competency_scale_levels"("scaleId");

-- CreateIndex
CREATE UNIQUE INDEX "competency_scale_levels_scaleId_value_key" ON "competency_scale_levels"("scaleId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "competency_scale_levels_scaleId_order_key" ON "competency_scale_levels"("scaleId", "order");

-- CreateIndex
CREATE INDEX "performance_cycle_competencies_companyId_idx" ON "performance_cycle_competencies"("companyId");

-- CreateIndex
CREATE INDEX "performance_cycle_competencies_cycleId_idx" ON "performance_cycle_competencies"("cycleId");

-- CreateIndex
CREATE INDEX "performance_cycle_competencies_competencyId_idx" ON "performance_cycle_competencies"("competencyId");

-- CreateIndex
CREATE INDEX "performance_cycle_competencies_scaleId_idx" ON "performance_cycle_competencies"("scaleId");

-- CreateIndex
CREATE UNIQUE INDEX "performance_cycle_competencies_cycleId_competencyId_key" ON "performance_cycle_competencies"("cycleId", "competencyId");

-- AddForeignKey
ALTER TABLE "performance_cycles" ADD CONSTRAINT "performance_cycles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_cycles" ADD CONSTRAINT "performance_cycles_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_defaultScaleId_fkey" FOREIGN KEY ("defaultScaleId") REFERENCES "competency_scales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_scales" ADD CONSTRAINT "competency_scales_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_scale_levels" ADD CONSTRAINT "competency_scale_levels_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_scale_levels" ADD CONSTRAINT "competency_scale_levels_scaleId_fkey" FOREIGN KEY ("scaleId") REFERENCES "competency_scales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_cycle_competencies" ADD CONSTRAINT "performance_cycle_competencies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_cycle_competencies" ADD CONSTRAINT "performance_cycle_competencies_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "performance_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_cycle_competencies" ADD CONSTRAINT "performance_cycle_competencies_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "competencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_cycle_competencies" ADD CONSTRAINT "performance_cycle_competencies_scaleId_fkey" FOREIGN KEY ("scaleId") REFERENCES "competency_scales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain CHECKs
ALTER TABLE "performance_cycles" ADD CONSTRAINT "performance_cycles_period_dates_check" CHECK ("startDate" <= "endDate");

-- Evaluation window: both null, or both set, within period, and ordered.
ALTER TABLE "performance_cycles" ADD CONSTRAINT "performance_cycles_evaluation_dates_check" CHECK (
  ("evaluationStartDate" IS NULL AND "evaluationEndDate" IS NULL)
  OR (
    "evaluationStartDate" IS NOT NULL
    AND "evaluationEndDate" IS NOT NULL
    AND "evaluationStartDate" <= "evaluationEndDate"
    AND "evaluationStartDate" >= "startDate"
    AND "evaluationEndDate" <= "endDate"
  )
);

ALTER TABLE "competency_scale_levels" ADD CONSTRAINT "competency_scale_levels_value_nonneg_check" CHECK ("value" >= 0);

ALTER TABLE "competency_scale_levels" ADD CONSTRAINT "competency_scale_levels_order_nonneg_check" CHECK ("order" >= 0);

ALTER TABLE "performance_cycle_competencies" ADD CONSTRAINT "performance_cycle_competencies_weight_nonneg_check" CHECK ("weight" IS NULL OR "weight" >= 0);

ALTER TABLE "performance_cycle_competencies" ADD CONSTRAINT "performance_cycle_competencies_order_nonneg_check" CHECK ("order" >= 0);
