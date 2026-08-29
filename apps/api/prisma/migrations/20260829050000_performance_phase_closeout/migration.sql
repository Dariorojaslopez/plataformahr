CREATE TYPE "GoalDefinitionReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "GoalModificationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "PerformanceNotificationType" AS ENUM (
  'GOAL_DEFINITION_SUBMITTED',
  'GOAL_DEFINITION_APPROVED',
  'GOAL_DEFINITION_REJECTED',
  'GOAL_EDIT_REQUESTED',
  'GOAL_EDIT_APPROVED',
  'GOAL_EDIT_REJECTED'
);

ALTER TABLE "performance_cycles"
  ADD COLUMN "closingStartDate" TIMESTAMP(3),
  ADD COLUMN "closingEndDate" TIMESTAMP(3);

ALTER TABLE "performance_goal_definitions"
  ADD COLUMN "reviewStatus" "GoalDefinitionReviewStatus",
  ADD COLUMN "reviewComment" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedByEmployeeId" UUID,
  ADD COLUMN "structureUnlocked" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "performance_goal_definitions_reviewedByEmployeeId_idx"
  ON "performance_goal_definitions"("reviewedByEmployeeId");

ALTER TABLE "performance_goal_definitions"
  ADD CONSTRAINT "performance_goal_definitions_reviewedByEmployeeId_fkey"
  FOREIGN KEY ("reviewedByEmployeeId") REFERENCES "employees"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "performance_individual_development_plans"
  ADD COLUMN "progressNotes" TEXT,
  ADD COLUMN "strengths" TEXT,
  ADD COLUMN "improvements" TEXT;

CREATE TABLE "performance_goal_modification_requests" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "cycleId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "comment" TEXT,
  "status" "GoalModificationRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewComment" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedByEmployeeId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "performance_goal_modification_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "performance_goal_modification_requests_companyId_idx"
  ON "performance_goal_modification_requests"("companyId");
CREATE INDEX "performance_goal_modification_requests_cycleId_employeeId_status_idx"
  ON "performance_goal_modification_requests"("cycleId", "employeeId", "status");
CREATE INDEX "performance_goal_modification_requests_reviewedByEmployeeId_idx"
  ON "performance_goal_modification_requests"("reviewedByEmployeeId");

ALTER TABLE "performance_goal_modification_requests"
  ADD CONSTRAINT "performance_goal_modification_requests_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_goal_modification_requests"
  ADD CONSTRAINT "performance_goal_modification_requests_cycleId_fkey"
  FOREIGN KEY ("cycleId") REFERENCES "performance_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_goal_modification_requests"
  ADD CONSTRAINT "performance_goal_modification_requests_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_goal_modification_requests"
  ADD CONSTRAINT "performance_goal_modification_requests_reviewedByEmployeeId_fkey"
  FOREIGN KEY ("reviewedByEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "performance_notifications" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "cycleId" UUID,
  "type" "PerformanceNotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "performance_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "performance_notifications_companyId_employeeId_createdAt_idx"
  ON "performance_notifications"("companyId", "employeeId", "createdAt");
CREATE INDEX "performance_notifications_cycleId_idx"
  ON "performance_notifications"("cycleId");

ALTER TABLE "performance_notifications"
  ADD CONSTRAINT "performance_notifications_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_notifications"
  ADD CONSTRAINT "performance_notifications_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_notifications"
  ADD CONSTRAINT "performance_notifications_cycleId_fkey"
  FOREIGN KEY ("cycleId") REFERENCES "performance_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "performance_closing_sessions" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "cycleId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "collaboratorObservations" TEXT,
  "leaderObservations" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "performance_closing_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "performance_closing_sessions_cycleId_employeeId_key"
  ON "performance_closing_sessions"("cycleId", "employeeId");
CREATE INDEX "performance_closing_sessions_companyId_idx"
  ON "performance_closing_sessions"("companyId");
CREATE INDEX "performance_closing_sessions_employeeId_idx"
  ON "performance_closing_sessions"("employeeId");

ALTER TABLE "performance_closing_sessions"
  ADD CONSTRAINT "performance_closing_sessions_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_closing_sessions"
  ADD CONSTRAINT "performance_closing_sessions_cycleId_fkey"
  FOREIGN KEY ("cycleId") REFERENCES "performance_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_closing_sessions"
  ADD CONSTRAINT "performance_closing_sessions_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "performance_goal_ratings" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "evaluationId" UUID NOT NULL,
  "goalId" UUID NOT NULL,
  "selectedScaleLevelId" UUID,
  "ratingValue" INTEGER,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "performance_goal_ratings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "performance_goal_ratings_evaluationId_goalId_key"
  ON "performance_goal_ratings"("evaluationId", "goalId");
CREATE INDEX "performance_goal_ratings_companyId_idx" ON "performance_goal_ratings"("companyId");
CREATE INDEX "performance_goal_ratings_goalId_idx" ON "performance_goal_ratings"("goalId");
CREATE INDEX "performance_goal_ratings_selectedScaleLevelId_idx"
  ON "performance_goal_ratings"("selectedScaleLevelId");

ALTER TABLE "performance_goal_ratings"
  ADD CONSTRAINT "performance_goal_ratings_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_goal_ratings"
  ADD CONSTRAINT "performance_goal_ratings_evaluationId_fkey"
  FOREIGN KEY ("evaluationId") REFERENCES "performance_evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_goal_ratings"
  ADD CONSTRAINT "performance_goal_ratings_goalId_fkey"
  FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_goal_ratings"
  ADD CONSTRAINT "performance_goal_ratings_selectedScaleLevelId_fkey"
  FOREIGN KEY ("selectedScaleLevelId") REFERENCES "competency_scale_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "calibration_placements" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "cycleId" UUID,
  "row" INTEGER NOT NULL,
  "col" INTEGER NOT NULL,
  "calculatedRow" INTEGER,
  "calculatedCol" INTEGER,
  "justification" TEXT NOT NULL,
  "movedByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "calibration_placements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "calibration_placements_sessionId_employeeId_key"
  ON "calibration_placements"("sessionId", "employeeId");
CREATE INDEX "calibration_placements_companyId_idx" ON "calibration_placements"("companyId");
CREATE INDEX "calibration_placements_employeeId_idx" ON "calibration_placements"("employeeId");
CREATE INDEX "calibration_placements_movedByUserId_idx" ON "calibration_placements"("movedByUserId");

ALTER TABLE "calibration_placements"
  ADD CONSTRAINT "calibration_placements_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "calibration_placements"
  ADD CONSTRAINT "calibration_placements_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "calibration_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calibration_placements"
  ADD CONSTRAINT "calibration_placements_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "calibration_placements"
  ADD CONSTRAINT "calibration_placements_movedByUserId_fkey"
  FOREIGN KEY ("movedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
