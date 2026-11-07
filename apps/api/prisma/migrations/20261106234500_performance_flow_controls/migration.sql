ALTER TABLE "performance_goal_definitions" ADD COLUMN "unlockedGoalIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "performance_closing_sessions" ADD COLUMN "leaderAcceptedAt" TIMESTAMP(3);
ALTER TABLE "performance_closing_sessions" ADD COLUMN "strengthsOpportunities" TEXT;
ALTER TABLE "performance_closing_sessions" ADD COLUMN "comments" TEXT;

ALTER TABLE "performance_cycle_participants" ADD COLUMN "forcedPhase" TEXT;

ALTER TABLE "performance_evaluations" ADD COLUMN "competencyComment" TEXT;

ALTER TABLE "calibration_sessions" ADD COLUMN "closedAt" TIMESTAMP(3);

ALTER TABLE "goals" ADD COLUMN "followUpComment" TEXT;
ALTER TABLE "goals" ADD COLUMN "closedInFollowUp" BOOLEAN NOT NULL DEFAULT false;
