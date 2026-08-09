-- CreateEnum
CREATE TYPE "GoalCycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('INDIVIDUAL', 'AREA', 'COMPANY');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GoalMetricType" AS ENUM ('NUMBER', 'PERCENTAGE', 'CURRENCY', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "GoalMetricDirection" AS ENUM ('INCREASE', 'DECREASE');

-- CreateTable
CREATE TABLE "goal_cycles" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "GoalCycleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goal_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "GoalType" NOT NULL,
    "status" "GoalStatus" NOT NULL DEFAULT 'DRAFT',
    "areaId" UUID,
    "weight" DECIMAL(5,2),
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_assignments" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "goalId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_key_results" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "goalId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metricType" "GoalMetricType" NOT NULL,
    "direction" "GoalMetricDirection",
    "startValue" DECIMAL(18,4),
    "targetValue" DECIMAL(18,4),
    "targetBoolean" BOOLEAN,
    "unit" TEXT,
    "currencyCode" CHAR(3),
    "weight" DECIMAL(5,2),
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goal_key_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "goal_cycles_companyId_idx" ON "goal_cycles"("companyId");

-- CreateIndex
CREATE INDEX "goal_cycles_companyId_status_idx" ON "goal_cycles"("companyId", "status");

-- CreateIndex
CREATE INDEX "goal_cycles_createdByUserId_idx" ON "goal_cycles"("createdByUserId");

-- CreateIndex
CREATE INDEX "goals_companyId_idx" ON "goals"("companyId");

-- CreateIndex
CREATE INDEX "goals_companyId_cycleId_status_idx" ON "goals"("companyId", "cycleId", "status");

-- CreateIndex
CREATE INDEX "goals_companyId_type_idx" ON "goals"("companyId", "type");

-- CreateIndex
CREATE INDEX "goals_areaId_idx" ON "goals"("areaId");

-- CreateIndex
CREATE INDEX "goals_cycleId_idx" ON "goals"("cycleId");

-- CreateIndex
CREATE INDEX "goals_status_idx" ON "goals"("status");

-- CreateIndex
CREATE INDEX "goals_createdByUserId_idx" ON "goals"("createdByUserId");

-- CreateIndex
CREATE INDEX "goal_assignments_companyId_idx" ON "goal_assignments"("companyId");

-- CreateIndex
CREATE INDEX "goal_assignments_goalId_idx" ON "goal_assignments"("goalId");

-- CreateIndex
CREATE INDEX "goal_assignments_employeeId_idx" ON "goal_assignments"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "goal_assignments_goalId_employeeId_key" ON "goal_assignments"("goalId", "employeeId");

-- CreateIndex
CREATE INDEX "goal_key_results_companyId_idx" ON "goal_key_results"("companyId");

-- CreateIndex
CREATE INDEX "goal_key_results_goalId_order_idx" ON "goal_key_results"("goalId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "goal_key_results_goalId_order_key" ON "goal_key_results"("goalId", "order");

-- AddForeignKey
ALTER TABLE "goal_cycles" ADD CONSTRAINT "goal_cycles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_cycles" ADD CONSTRAINT "goal_cycles_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "goal_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_assignments" ADD CONSTRAINT "goal_assignments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_assignments" ADD CONSTRAINT "goal_assignments_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_assignments" ADD CONSTRAINT "goal_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_key_results" ADD CONSTRAINT "goal_key_results_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_key_results" ADD CONSTRAINT "goal_key_results_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Checks
ALTER TABLE "goal_cycles" ADD CONSTRAINT "goal_cycles_dates_chk" CHECK ("startDate" < "endDate");

ALTER TABLE "goals" ADD CONSTRAINT "goals_weight_range_chk" CHECK ("weight" IS NULL OR ("weight" >= 0 AND "weight" <= 100));

ALTER TABLE "goal_key_results" ADD CONSTRAINT "goal_key_results_weight_range_chk" CHECK ("weight" IS NULL OR ("weight" >= 0 AND "weight" <= 100));

ALTER TABLE "goal_key_results" ADD CONSTRAINT "goal_key_results_order_chk" CHECK ("order" >= 0);

ALTER TABLE "goal_key_results" ADD CONSTRAINT "goal_key_results_metric_chk" CHECK (
  (
    "metricType" = 'BOOLEAN'
    AND "targetBoolean" IS NOT NULL
    AND "targetValue" IS NULL
    AND "startValue" IS NULL
    AND "direction" IS NULL
    AND "currencyCode" IS NULL
  )
  OR (
    "metricType" IN ('NUMBER', 'PERCENTAGE', 'CURRENCY')
    AND "targetValue" IS NOT NULL
    AND "direction" IS NOT NULL
    AND "targetBoolean" IS NULL
    AND (
      ("metricType" = 'CURRENCY' AND "currencyCode" IS NOT NULL)
      OR ("metricType" <> 'CURRENCY' AND "currencyCode" IS NULL)
    )
  )
);
