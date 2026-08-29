CREATE TYPE "PerformanceEvaluationModel" AS ENUM (
  'DEGREE_90',
  'DEGREE_180',
  'DEGREE_270',
  'DEGREE_360'
);

ALTER TYPE "PerformanceEvaluationType" ADD VALUE IF NOT EXISTS 'PEER';
ALTER TYPE "PerformanceEvaluationType" ADD VALUE IF NOT EXISTS 'REPORT';
ALTER TYPE "PerformanceEvaluationType" ADD VALUE IF NOT EXISTS 'CLIENT';

ALTER TABLE "performance_cycles"
  ADD COLUMN "goalDefinitionStartDate" TIMESTAMP(3),
  ADD COLUMN "goalDefinitionEndDate" TIMESTAMP(3),
  ADD COLUMN "managerEvaluationStartDate" TIMESTAMP(3),
  ADD COLUMN "managerEvaluationEndDate" TIMESTAMP(3),
  ADD COLUMN "calibrationStartDate" TIMESTAMP(3),
  ADD COLUMN "calibrationEndDate" TIMESTAMP(3),
  ADD COLUMN "evaluationModel" "PerformanceEvaluationModel" NOT NULL DEFAULT 'DEGREE_90',
  ADD COLUMN "peerEvaluationWeight" DECIMAL(5, 2),
  ADD COLUMN "reportEvaluationWeight" DECIMAL(5, 2),
  ADD COLUMN "clientEvaluationWeight" DECIMAL(5, 2),
  ADD COLUMN "includeCompetencies" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "organizationalGoalsWeight" DECIMAL(5, 2),
  ADD COLUMN "individualGoalsWeight" DECIMAL(5, 2),
  ADD COLUMN "maxObjectives" INTEGER,
  ADD COLUMN "evaluationRange" INTEGER NOT NULL DEFAULT 100;

UPDATE "performance_cycles"
SET
  "individualGoalsWeight" = "goalsResultWeight",
  "organizationalGoalsWeight" = 0
WHERE "goalsResultWeight" IS NOT NULL;

ALTER TABLE "performance_cycles"
  ADD CONSTRAINT "performance_cycles_evaluationRange_chk"
  CHECK ("evaluationRange" IN (100, 120));

CREATE TABLE "performance_cycle_follow_ups" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "cycleId" UUID NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "performance_cycle_follow_ups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "performance_cycle_follow_ups_companyId_idx"
  ON "performance_cycle_follow_ups"("companyId");

CREATE INDEX "performance_cycle_follow_ups_cycleId_idx"
  ON "performance_cycle_follow_ups"("cycleId");

ALTER TABLE "performance_cycle_follow_ups"
  ADD CONSTRAINT "performance_cycle_follow_ups_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "performance_cycle_follow_ups"
  ADD CONSTRAINT "performance_cycle_follow_ups_cycleId_fkey"
  FOREIGN KEY ("cycleId") REFERENCES "performance_cycles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "performance_evaluations_participantId_type_key";

CREATE UNIQUE INDEX "performance_evaluations_participantId_type_evaluatorEmployeeId_key"
  ON "performance_evaluations"("participantId", "type", "evaluatorEmployeeId");

ALTER TABLE "performance_results"
  DROP CONSTRAINT IF EXISTS "performance_results_overallScore_range_chk";

ALTER TABLE "performance_results"
  ADD CONSTRAINT "performance_results_overallScore_range_chk"
  CHECK ("overallScore" >= 0 AND "overallScore" <= 120);
