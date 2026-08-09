-- Goals Progress 09B: append-only GoalCheckIn with deterministic sequence

CREATE TABLE "goal_check_ins" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "goalId" UUID NOT NULL,
    "keyResultId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "createdByEmployeeId" UUID,
    "numericValue" DECIMAL(18,4),
    "booleanValue" BOOLEAN,
    "comment" VARCHAR(2000),
    "evidenceReference" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_check_ins_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "goal_check_ins_sequence_positive" CHECK ("sequence" >= 1),
    CONSTRAINT "goal_check_ins_value_xor" CHECK (
      ("numericValue" IS NOT NULL AND "booleanValue" IS NULL)
      OR ("numericValue" IS NULL AND "booleanValue" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "goal_check_ins_keyResultId_sequence_key" ON "goal_check_ins"("keyResultId", "sequence");

CREATE INDEX "goal_check_ins_companyId_idx" ON "goal_check_ins"("companyId");

CREATE INDEX "goal_check_ins_goalId_idx" ON "goal_check_ins"("goalId");

CREATE INDEX "goal_check_ins_createdByUserId_idx" ON "goal_check_ins"("createdByUserId");

CREATE INDEX "goal_check_ins_createdAt_idx" ON "goal_check_ins"("createdAt");

ALTER TABLE "goal_check_ins" ADD CONSTRAINT "goal_check_ins_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goal_check_ins" ADD CONSTRAINT "goal_check_ins_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goal_check_ins" ADD CONSTRAINT "goal_check_ins_keyResultId_fkey" FOREIGN KEY ("keyResultId") REFERENCES "goal_key_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goal_check_ins" ADD CONSTRAINT "goal_check_ins_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goal_check_ins" ADD CONSTRAINT "goal_check_ins_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
