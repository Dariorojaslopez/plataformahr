-- Default approval/evaluator assignment by position occupant, plus
-- per-process snapshots that can be edited while still pending.

ALTER TABLE "vacancy_approvals" ADD COLUMN "positionId" UUID;

CREATE INDEX "vacancy_approvals_positionId_idx" ON "vacancy_approvals"("positionId");

ALTER TABLE "vacancy_approvals"
  ADD CONSTRAINT "vacancy_approvals_positionId_fkey"
  FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vacancy_approval_workflow_steps" ADD COLUMN "positionId" UUID;

CREATE INDEX "vacancy_approval_workflow_steps_positionId_idx"
  ON "vacancy_approval_workflow_steps"("positionId");

ALTER TABLE "vacancy_approval_workflow_steps"
  ADD CONSTRAINT "vacancy_approval_workflow_steps_positionId_fkey"
  FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vacancy_approval_workflow_steps"
  DROP CONSTRAINT "vacancy_approval_workflow_steps_type_fields_check";

ALTER TABLE "vacancy_approval_workflow_steps"
  ADD CONSTRAINT "vacancy_approval_workflow_steps_type_fields_check"
  CHECK (
    (
      "approverType" = 'MANAGER_OF_REQUESTER'
      AND "specificEmployeeId" IS NULL
      AND "requiredRoleCode" IS NULL
      AND "positionId" IS NULL
    )
    OR (
      "approverType" = 'SPECIFIC_EMPLOYEE'
      AND "specificEmployeeId" IS NOT NULL
      AND "requiredRoleCode" IS NULL
    )
    OR (
      "approverType" = 'ROLE'
      AND "specificEmployeeId" IS NULL
      AND "requiredRoleCode" IS NOT NULL
      AND "positionId" IS NULL
    )
    OR (
      "approverType" = 'POSITION'
      AND "positionId" IS NOT NULL
      AND "requiredRoleCode" IS NULL
    )
  );

CREATE TABLE "vacancy_evaluator_defaults" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "positionId" UUID NOT NULL,
    "employeeId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacancy_evaluator_defaults_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vacancy_evaluator_defaults_companyId_sequence_key"
  ON "vacancy_evaluator_defaults"("companyId", "sequence");
CREATE INDEX "vacancy_evaluator_defaults_companyId_idx" ON "vacancy_evaluator_defaults"("companyId");
CREATE INDEX "vacancy_evaluator_defaults_positionId_idx" ON "vacancy_evaluator_defaults"("positionId");
CREATE INDEX "vacancy_evaluator_defaults_employeeId_idx" ON "vacancy_evaluator_defaults"("employeeId");

ALTER TABLE "vacancy_evaluator_defaults"
  ADD CONSTRAINT "vacancy_evaluator_defaults_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vacancy_evaluator_defaults"
  ADD CONSTRAINT "vacancy_evaluator_defaults_positionId_fkey"
  FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vacancy_evaluator_defaults"
  ADD CONSTRAINT "vacancy_evaluator_defaults_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vacancy_evaluator_defaults"
  ADD CONSTRAINT "vacancy_evaluator_defaults_sequence_positive_check"
  CHECK ("sequence" >= 1);

CREATE TABLE "vacancy_request_evaluators" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "vacancyRequestId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "positionId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacancy_request_evaluators_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vacancy_request_evaluators_vacancyRequestId_sequence_key"
  ON "vacancy_request_evaluators"("vacancyRequestId", "sequence");
CREATE INDEX "vacancy_request_evaluators_companyId_idx" ON "vacancy_request_evaluators"("companyId");
CREATE INDEX "vacancy_request_evaluators_vacancyRequestId_idx" ON "vacancy_request_evaluators"("vacancyRequestId");
CREATE INDEX "vacancy_request_evaluators_positionId_idx" ON "vacancy_request_evaluators"("positionId");
CREATE INDEX "vacancy_request_evaluators_employeeId_idx" ON "vacancy_request_evaluators"("employeeId");

ALTER TABLE "vacancy_request_evaluators"
  ADD CONSTRAINT "vacancy_request_evaluators_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vacancy_request_evaluators"
  ADD CONSTRAINT "vacancy_request_evaluators_vacancyRequestId_fkey"
  FOREIGN KEY ("vacancyRequestId") REFERENCES "vacancy_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vacancy_request_evaluators"
  ADD CONSTRAINT "vacancy_request_evaluators_positionId_fkey"
  FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vacancy_request_evaluators"
  ADD CONSTRAINT "vacancy_request_evaluators_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vacancy_request_evaluators"
  ADD CONSTRAINT "vacancy_request_evaluators_sequence_positive_check"
  CHECK ("sequence" >= 1);
