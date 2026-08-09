-- Goals ↔ Performance integration 09D

CREATE TYPE "PerformanceResultComposition" AS ENUM ('COMPETENCY_ONLY', 'COMPETENCY_AND_GOALS');

-- PerformanceCycle optional Goals composition
ALTER TABLE "performance_cycles" ADD COLUMN "goalCycleId" UUID;
ALTER TABLE "performance_cycles" ADD COLUMN "competencyResultWeight" DECIMAL(5,2);
ALTER TABLE "performance_cycles" ADD COLUMN "goalsResultWeight" DECIMAL(5,2);

ALTER TABLE "performance_cycles"
  ADD CONSTRAINT "performance_cycles_goal_weights_range"
  CHECK (
    ("goalCycleId" IS NULL AND "competencyResultWeight" IS NULL AND "goalsResultWeight" IS NULL)
    OR (
      "goalCycleId" IS NOT NULL
      AND "competencyResultWeight" IS NOT NULL
      AND "goalsResultWeight" IS NOT NULL
      AND "competencyResultWeight" >= 0 AND "competencyResultWeight" <= 100
      AND "goalsResultWeight" >= 0 AND "goalsResultWeight" <= 100
      AND ("competencyResultWeight" + "goalsResultWeight") = 100
    )
  );

CREATE INDEX "performance_cycles_goalCycleId_idx" ON "performance_cycles"("goalCycleId");

ALTER TABLE "performance_cycles"
  ADD CONSTRAINT "performance_cycles_goalCycleId_fkey"
  FOREIGN KEY ("goalCycleId") REFERENCES "goal_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PerformanceResult composition fields (nullable for legacy rows)
ALTER TABLE "performance_results" ADD COLUMN "competencyScore" DECIMAL(5,2);
ALTER TABLE "performance_results" ADD COLUMN "goalsAchievement" DECIMAL(5,2);
ALTER TABLE "performance_results" ADD COLUMN "configuredCompetencyResultWeight" DECIMAL(5,2);
ALTER TABLE "performance_results" ADD COLUMN "configuredGoalsResultWeight" DECIMAL(5,2);
ALTER TABLE "performance_results" ADD COLUMN "composition" "PerformanceResultComposition" NOT NULL DEFAULT 'COMPETENCY_ONLY';
ALTER TABLE "performance_results" ADD COLUMN "sourceGoalCycleId" UUID;

ALTER TABLE "performance_results"
  ADD CONSTRAINT "performance_results_competencyScore_range"
  CHECK ("competencyScore" IS NULL OR ("competencyScore" >= 0 AND "competencyScore" <= 100));

ALTER TABLE "performance_results"
  ADD CONSTRAINT "performance_results_goalsAchievement_range"
  CHECK ("goalsAchievement" IS NULL OR ("goalsAchievement" >= 0 AND "goalsAchievement" <= 100));

CREATE INDEX "performance_results_composition_idx" ON "performance_results"("composition");

-- Backfill: legacy overallScore is the competency result
UPDATE "performance_results"
SET "competencyScore" = "overallScore"
WHERE "composition" = 'COMPETENCY_ONLY' AND "competencyScore" IS NULL;

CREATE TABLE "performance_result_goals" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "performanceResultId" UUID NOT NULL,
    "sourceGoalId" UUID,
    "sourceGoalResultId" UUID,
    "goalTitle" TEXT NOT NULL,
    "goalType" "GoalType" NOT NULL,
    "achievementPercentage" DECIMAL(5,2) NOT NULL,
    "configuredWeight" DECIMAL(5,2),
    "effectiveWeight" DECIMAL(5,2) NOT NULL,
    "contribution" DECIMAL(5,2) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_result_goals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "performance_result_goals_achievement_range" CHECK ("achievementPercentage" >= 0 AND "achievementPercentage" <= 100),
    CONSTRAINT "performance_result_goals_effective_weight_range" CHECK ("effectiveWeight" >= 0 AND "effectiveWeight" <= 100),
    CONSTRAINT "performance_result_goals_contribution_range" CHECK ("contribution" >= 0 AND "contribution" <= 100)
);

CREATE INDEX "performance_result_goals_companyId_idx" ON "performance_result_goals"("companyId");
CREATE INDEX "performance_result_goals_performanceResultId_order_idx" ON "performance_result_goals"("performanceResultId", "order");

ALTER TABLE "performance_result_goals"
  ADD CONSTRAINT "performance_result_goals_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "performance_result_goals"
  ADD CONSTRAINT "performance_result_goals_performanceResultId_fkey"
  FOREIGN KEY ("performanceResultId") REFERENCES "performance_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- GoalResult historical applicability snapshots
ALTER TABLE "goal_results" ADD COLUMN "goalTitleSnapshot" TEXT;
ALTER TABLE "goal_results" ADD COLUMN "goalTypeSnapshot" "GoalType";
ALTER TABLE "goal_results" ADD COLUMN "areaIdSnapshot" UUID;
ALTER TABLE "goal_results" ADD COLUMN "areaNameSnapshot" TEXT;
ALTER TABLE "goal_results" ADD COLUMN "appliesCompanyWide" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "goal_results_appliesCompanyWide_idx" ON "goal_results"("appliesCompanyWide");

-- Backfill snapshots from live Goal for existing GoalResults
UPDATE "goal_results" gr
SET
  "goalTitleSnapshot" = g.title,
  "goalTypeSnapshot" = g.type,
  "areaIdSnapshot" = g."areaId",
  "areaNameSnapshot" = a.name,
  "appliesCompanyWide" = (g.type = 'COMPANY')
FROM "goals" g
LEFT JOIN "areas" a ON a.id = g."areaId"
WHERE gr."goalId" = g.id
  AND gr."goalTitleSnapshot" IS NULL;

CREATE TABLE "goal_result_applicable_employees" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "goalResultId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "areaIdSnapshot" UUID,
    "areaNameSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_result_applicable_employees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "goal_result_applicable_employees_goalResultId_employeeId_key"
  ON "goal_result_applicable_employees"("goalResultId", "employeeId");
CREATE INDEX "goal_result_applicable_employees_companyId_idx" ON "goal_result_applicable_employees"("companyId");
CREATE INDEX "goal_result_applicable_employees_employeeId_idx" ON "goal_result_applicable_employees"("employeeId");
CREATE INDEX "goal_result_applicable_employees_goalResultId_idx" ON "goal_result_applicable_employees"("goalResultId");

ALTER TABLE "goal_result_applicable_employees"
  ADD CONSTRAINT "goal_result_applicable_employees_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goal_result_applicable_employees"
  ADD CONSTRAINT "goal_result_applicable_employees_goalResultId_fkey"
  FOREIGN KEY ("goalResultId") REFERENCES "goal_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goal_result_applicable_employees"
  ADD CONSTRAINT "goal_result_applicable_employees_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill applicability for existing GoalResults from current assignments / area (best-effort)
INSERT INTO "goal_result_applicable_employees" ("id", "companyId", "goalResultId", "employeeId", "areaIdSnapshot", "areaNameSnapshot", "createdAt")
SELECT gen_random_uuid(), gr."companyId", gr.id, ga."employeeId", e."areaId", a.name, CURRENT_TIMESTAMP
FROM "goal_results" gr
JOIN "goals" g ON g.id = gr."goalId"
JOIN "goal_assignments" ga ON ga."goalId" = g.id
JOIN "employees" e ON e.id = ga."employeeId"
LEFT JOIN "areas" a ON a.id = e."areaId"
WHERE g.type = 'INDIVIDUAL'
ON CONFLICT DO NOTHING;

INSERT INTO "goal_result_applicable_employees" ("id", "companyId", "goalResultId", "employeeId", "areaIdSnapshot", "areaNameSnapshot", "createdAt")
SELECT gen_random_uuid(), gr."companyId", gr.id, e.id, e."areaId", a.name, CURRENT_TIMESTAMP
FROM "goal_results" gr
JOIN "goals" g ON g.id = gr."goalId"
JOIN "employees" e ON e."companyId" = gr."companyId" AND e."areaId" = g."areaId" AND e."deletedAt" IS NULL
LEFT JOIN "areas" a ON a.id = e."areaId"
WHERE g.type = 'AREA'
ON CONFLICT DO NOTHING;
