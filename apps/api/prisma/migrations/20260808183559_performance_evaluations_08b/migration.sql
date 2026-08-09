-- CreateEnum
CREATE TYPE "PerformanceParticipantStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "PerformanceEvaluationType" AS ENUM ('SELF', 'MANAGER');

-- CreateEnum
CREATE TYPE "PerformanceEvaluationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED');

-- CreateTable
CREATE TABLE "performance_cycle_participants" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "status" "PerformanceParticipantStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_cycle_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_evaluations" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "evaluatorEmployeeId" UUID,
    "type" "PerformanceEvaluationType" NOT NULL,
    "status" "PerformanceEvaluationStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_evaluation_competencies" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "evaluationId" UUID NOT NULL,
    "sourceCompetencyId" UUID,
    "sourceScaleId" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "scaleName" TEXT NOT NULL,
    "weight" DECIMAL(5,2),
    "required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_evaluation_competencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_evaluation_scale_levels" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "evaluationCompetencyId" UUID NOT NULL,
    "sourceScaleLevelId" UUID,
    "value" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_evaluation_scale_levels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "performance_cycle_participants_companyId_idx" ON "performance_cycle_participants"("companyId");

-- CreateIndex
CREATE INDEX "performance_cycle_participants_cycleId_idx" ON "performance_cycle_participants"("cycleId");

-- CreateIndex
CREATE INDEX "performance_cycle_participants_employeeId_idx" ON "performance_cycle_participants"("employeeId");

-- CreateIndex
CREATE INDEX "performance_cycle_participants_status_idx" ON "performance_cycle_participants"("status");

-- CreateIndex
CREATE UNIQUE INDEX "performance_cycle_participants_cycleId_employeeId_key" ON "performance_cycle_participants"("cycleId", "employeeId");

-- CreateIndex
CREATE INDEX "performance_evaluations_companyId_idx" ON "performance_evaluations"("companyId");

-- CreateIndex
CREATE INDEX "performance_evaluations_cycleId_idx" ON "performance_evaluations"("cycleId");

-- CreateIndex
CREATE INDEX "performance_evaluations_participantId_idx" ON "performance_evaluations"("participantId");

-- CreateIndex
CREATE INDEX "performance_evaluations_employeeId_idx" ON "performance_evaluations"("employeeId");

-- CreateIndex
CREATE INDEX "performance_evaluations_evaluatorEmployeeId_idx" ON "performance_evaluations"("evaluatorEmployeeId");

-- CreateIndex
CREATE INDEX "performance_evaluations_type_idx" ON "performance_evaluations"("type");

-- CreateIndex
CREATE INDEX "performance_evaluations_status_idx" ON "performance_evaluations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "performance_evaluations_participantId_type_key" ON "performance_evaluations"("participantId", "type");

-- CreateIndex
CREATE INDEX "performance_evaluation_competencies_companyId_idx" ON "performance_evaluation_competencies"("companyId");

-- CreateIndex
CREATE INDEX "performance_evaluation_competencies_evaluationId_idx" ON "performance_evaluation_competencies"("evaluationId");

-- CreateIndex
CREATE INDEX "performance_evaluation_competencies_sourceCompetencyId_idx" ON "performance_evaluation_competencies"("sourceCompetencyId");

-- CreateIndex
CREATE INDEX "performance_evaluation_scale_levels_companyId_idx" ON "performance_evaluation_scale_levels"("companyId");

-- CreateIndex
CREATE INDEX "performance_evaluation_scale_levels_evaluationCompetencyId_idx" ON "performance_evaluation_scale_levels"("evaluationCompetencyId");

-- AddForeignKey
ALTER TABLE "performance_cycle_participants" ADD CONSTRAINT "performance_cycle_participants_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_cycle_participants" ADD CONSTRAINT "performance_cycle_participants_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "performance_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_cycle_participants" ADD CONSTRAINT "performance_cycle_participants_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_evaluations" ADD CONSTRAINT "performance_evaluations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_evaluations" ADD CONSTRAINT "performance_evaluations_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "performance_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_evaluations" ADD CONSTRAINT "performance_evaluations_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "performance_cycle_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_evaluations" ADD CONSTRAINT "performance_evaluations_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_evaluations" ADD CONSTRAINT "performance_evaluations_evaluatorEmployeeId_fkey" FOREIGN KEY ("evaluatorEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_evaluation_competencies" ADD CONSTRAINT "performance_evaluation_competencies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_evaluation_competencies" ADD CONSTRAINT "performance_evaluation_competencies_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "performance_evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_evaluation_scale_levels" ADD CONSTRAINT "performance_evaluation_scale_levels_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_evaluation_scale_levels" ADD CONSTRAINT "performance_evaluation_scale_levels_evaluationCompetencyId_fkey" FOREIGN KEY ("evaluationCompetencyId") REFERENCES "performance_evaluation_competencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
