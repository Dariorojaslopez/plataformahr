CREATE TYPE "VacancyApprovalPlanOrigin" AS ENUM ('DEFAULT', 'CUSTOM');

CREATE TABLE "vacancy_request_approval_plan_steps" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "vacancyRequestId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "origin" "VacancyApprovalPlanOrigin" NOT NULL,
    "approverType" "VacancyApproverType" NOT NULL,
    "label" TEXT,
    "positionId" UUID,
    "specificEmployeeId" UUID,
    "requiredRoleCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacancy_request_approval_plan_steps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vacancy_request_approval_plan_steps_vacancyRequestId_sequence_key"
  ON "vacancy_request_approval_plan_steps"("vacancyRequestId", "sequence");
CREATE INDEX "vacancy_request_approval_plan_steps_companyId_idx"
  ON "vacancy_request_approval_plan_steps"("companyId");
CREATE INDEX "vacancy_request_approval_plan_steps_vacancyRequestId_idx"
  ON "vacancy_request_approval_plan_steps"("vacancyRequestId");
CREATE INDEX "vacancy_request_approval_plan_steps_positionId_idx"
  ON "vacancy_request_approval_plan_steps"("positionId");
CREATE INDEX "vacancy_request_approval_plan_steps_specificEmployeeId_idx"
  ON "vacancy_request_approval_plan_steps"("specificEmployeeId");

ALTER TABLE "vacancy_request_approval_plan_steps"
  ADD CONSTRAINT "vacancy_request_approval_plan_steps_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vacancy_request_approval_plan_steps"
  ADD CONSTRAINT "vacancy_request_approval_plan_steps_vacancyRequestId_fkey"
  FOREIGN KEY ("vacancyRequestId") REFERENCES "vacancy_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vacancy_request_approval_plan_steps"
  ADD CONSTRAINT "vacancy_request_approval_plan_steps_positionId_fkey"
  FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vacancy_request_approval_plan_steps"
  ADD CONSTRAINT "vacancy_request_approval_plan_steps_specificEmployeeId_fkey"
  FOREIGN KEY ("specificEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vacancy_request_approval_plan_steps"
  ADD CONSTRAINT "vacancy_request_approval_plan_steps_sequence_positive_check"
  CHECK ("sequence" >= 1);
