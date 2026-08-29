CREATE TYPE "GoalProgressStatus" AS ENUM (
  'NOT_STARTED',
  'IN_PROGRESS',
  'FINISHED'
);

ALTER TABLE "goals"
  ADD COLUMN "progressStatus" "GoalProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "scaleId" UUID,
  ADD COLUMN "parentGoalId" UUID;

CREATE INDEX "goals_scaleId_idx" ON "goals"("scaleId");
CREATE INDEX "goals_parentGoalId_idx" ON "goals"("parentGoalId");

ALTER TABLE "goals"
  ADD CONSTRAINT "goals_scaleId_fkey"
  FOREIGN KEY ("scaleId") REFERENCES "competency_scales"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goals"
  ADD CONSTRAINT "goals_parentGoalId_fkey"
  FOREIGN KEY ("parentGoalId") REFERENCES "goals"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "performance_goal_definitions" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "cycleId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "performance_goal_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "performance_goal_definitions_cycleId_employeeId_key"
  ON "performance_goal_definitions"("cycleId", "employeeId");
CREATE INDEX "performance_goal_definitions_companyId_idx"
  ON "performance_goal_definitions"("companyId");
CREATE INDEX "performance_goal_definitions_employeeId_idx"
  ON "performance_goal_definitions"("employeeId");

ALTER TABLE "performance_goal_definitions"
  ADD CONSTRAINT "performance_goal_definitions_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "performance_goal_definitions"
  ADD CONSTRAINT "performance_goal_definitions_cycleId_fkey"
  FOREIGN KEY ("cycleId") REFERENCES "performance_cycles"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "performance_goal_definitions"
  ADD CONSTRAINT "performance_goal_definitions_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "performance_individual_development_plans" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "cycleId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "competencyId" UUID,
  "actions70" TEXT,
  "actions20" TEXT,
  "actions10" TEXT,
  "observations" TEXT,
  "progressPercent" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "performance_individual_development_plans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "performance_individual_development_plans_progress_chk"
    CHECK ("progressPercent" >= 0 AND "progressPercent" <= 100)
);

CREATE UNIQUE INDEX "performance_individual_development_plans_cycleId_employeeId_key"
  ON "performance_individual_development_plans"("cycleId", "employeeId");
CREATE INDEX "performance_individual_development_plans_companyId_idx"
  ON "performance_individual_development_plans"("companyId");
CREATE INDEX "performance_individual_development_plans_employeeId_idx"
  ON "performance_individual_development_plans"("employeeId");
CREATE INDEX "performance_individual_development_plans_competencyId_idx"
  ON "performance_individual_development_plans"("competencyId");

ALTER TABLE "performance_individual_development_plans"
  ADD CONSTRAINT "performance_individual_development_plans_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "performance_individual_development_plans"
  ADD CONSTRAINT "performance_individual_development_plans_cycleId_fkey"
  FOREIGN KEY ("cycleId") REFERENCES "performance_cycles"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "performance_individual_development_plans"
  ADD CONSTRAINT "performance_individual_development_plans_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "performance_individual_development_plans"
  ADD CONSTRAINT "performance_individual_development_plans_competencyId_fkey"
  FOREIGN KEY ("competencyId") REFERENCES "competencies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
