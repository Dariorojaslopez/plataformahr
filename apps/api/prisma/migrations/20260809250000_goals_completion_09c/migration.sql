-- Goals Completion 09C: CompletionRequest + immutable GoalResult snapshots

CREATE TYPE "GoalCompletionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "goal_completion_requests" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "goalId" UUID NOT NULL,
    "status" "GoalCompletionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByUserId" UUID NOT NULL,
    "requestedByEmployeeId" UUID,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestComment" VARCHAR(2000),
    "reviewedByUserId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "reviewComment" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goal_completion_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "goal_results" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "goalId" UUID NOT NULL,
    "completionRequestId" UUID NOT NULL,
    "achievementPercentage" DECIMAL(5,2) NOT NULL,
    "goalConfiguredWeight" DECIMAL(5,2),
    "calculatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "requestedByUserId" UUID NOT NULL,
    "approvedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_results_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "goal_results_achievement_range" CHECK ("achievementPercentage" >= 0 AND "achievementPercentage" <= 100)
);

CREATE TABLE "goal_result_key_results" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "goalResultId" UUID NOT NULL,
    "sourceKeyResultId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metricType" "GoalMetricType" NOT NULL,
    "direction" "GoalMetricDirection",
    "startNumericValue" DECIMAL(18,4),
    "targetNumericValue" DECIMAL(18,4),
    "targetBoolean" BOOLEAN,
    "finalNumericValue" DECIMAL(18,4),
    "finalBooleanValue" BOOLEAN,
    "unit" TEXT,
    "currencyCode" CHAR(3),
    "configuredWeight" DECIMAL(5,2),
    "effectiveWeight" DECIMAL(5,2),
    "achievementPercentage" DECIMAL(5,2) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_result_key_results_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "goal_result_kr_achievement_range" CHECK ("achievementPercentage" >= 0 AND "achievementPercentage" <= 100),
    CONSTRAINT "goal_result_kr_configured_weight_range" CHECK ("configuredWeight" IS NULL OR ("configuredWeight" >= 0 AND "configuredWeight" <= 100)),
    CONSTRAINT "goal_result_kr_effective_weight_range" CHECK ("effectiveWeight" IS NULL OR ("effectiveWeight" >= 0 AND "effectiveWeight" <= 100))
);

-- Only one PENDING completion request per Goal
CREATE UNIQUE INDEX "goal_completion_requests_one_pending_per_goal"
ON "goal_completion_requests" ("goalId")
WHERE "status" = 'PENDING';

CREATE INDEX "goal_completion_requests_companyId_status_idx" ON "goal_completion_requests"("companyId", "status");
CREATE INDEX "goal_completion_requests_goalId_status_idx" ON "goal_completion_requests"("goalId", "status");
CREATE INDEX "goal_completion_requests_requestedByUserId_idx" ON "goal_completion_requests"("requestedByUserId");
CREATE INDEX "goal_completion_requests_reviewedByUserId_idx" ON "goal_completion_requests"("reviewedByUserId");

CREATE UNIQUE INDEX "goal_results_goalId_key" ON "goal_results"("goalId");
CREATE UNIQUE INDEX "goal_results_completionRequestId_key" ON "goal_results"("completionRequestId");
CREATE INDEX "goal_results_companyId_idx" ON "goal_results"("companyId");

CREATE INDEX "goal_result_key_results_companyId_idx" ON "goal_result_key_results"("companyId");
CREATE INDEX "goal_result_key_results_goalResultId_order_idx" ON "goal_result_key_results"("goalResultId", "order");

ALTER TABLE "goal_completion_requests" ADD CONSTRAINT "goal_completion_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_completion_requests" ADD CONSTRAINT "goal_completion_requests_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_completion_requests" ADD CONSTRAINT "goal_completion_requests_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_completion_requests" ADD CONSTRAINT "goal_completion_requests_requestedByEmployeeId_fkey" FOREIGN KEY ("requestedByEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_completion_requests" ADD CONSTRAINT "goal_completion_requests_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goal_results" ADD CONSTRAINT "goal_results_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_results" ADD CONSTRAINT "goal_results_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_results" ADD CONSTRAINT "goal_results_completionRequestId_fkey" FOREIGN KEY ("completionRequestId") REFERENCES "goal_completion_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_results" ADD CONSTRAINT "goal_results_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_results" ADD CONSTRAINT "goal_results_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goal_result_key_results" ADD CONSTRAINT "goal_result_key_results_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goal_result_key_results" ADD CONSTRAINT "goal_result_key_results_goalResultId_fkey" FOREIGN KEY ("goalResultId") REFERENCES "goal_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
