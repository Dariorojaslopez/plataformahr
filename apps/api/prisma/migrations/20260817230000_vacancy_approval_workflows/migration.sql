-- Configurable vacancy-request approval workflows (additive, forward-only).
-- Existing vacancy_approvals rows are not rewritten. Companies without a
-- workflow row keep the legacy hardcoded approval path.

-- AlterEnum
ALTER TYPE "VacancyApprovalStep" ADD VALUE 'ROLE';
ALTER TYPE "VacancyApprovalStep" ADD VALUE 'SPECIFIC_EMPLOYEE';

-- CreateEnum
CREATE TYPE "VacancyApproverType" AS ENUM ('MANAGER_OF_REQUESTER', 'SPECIFIC_EMPLOYEE', 'ROLE');

-- AlterTable
ALTER TABLE "vacancy_approvals" ADD COLUMN "label" TEXT;

-- Unique snapshot identity is sequence (config can repeat step types).
DROP INDEX "vacancy_approvals_vacancyRequestId_step_key";

CREATE UNIQUE INDEX "vacancy_approvals_vacancyRequestId_sequence_key" ON "vacancy_approvals"("vacancyRequestId", "sequence");

-- CreateTable
CREATE TABLE "vacancy_approval_workflows" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacancy_approval_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vacancy_approval_workflow_steps" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "workflowId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "approverType" "VacancyApproverType" NOT NULL,
    "label" TEXT,
    "specificEmployeeId" UUID,
    "requiredRoleCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacancy_approval_workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vacancy_approval_workflows_companyId_key" ON "vacancy_approval_workflows"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "vacancy_approval_workflow_steps_workflowId_sequence_key" ON "vacancy_approval_workflow_steps"("workflowId", "sequence");

-- CreateIndex
CREATE INDEX "vacancy_approval_workflow_steps_companyId_idx" ON "vacancy_approval_workflow_steps"("companyId");

-- CreateIndex
CREATE INDEX "vacancy_approval_workflow_steps_specificEmployeeId_idx" ON "vacancy_approval_workflow_steps"("specificEmployeeId");

-- AddForeignKey
ALTER TABLE "vacancy_approval_workflows" ADD CONSTRAINT "vacancy_approval_workflows_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancy_approval_workflow_steps" ADD CONSTRAINT "vacancy_approval_workflow_steps_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancy_approval_workflow_steps" ADD CONSTRAINT "vacancy_approval_workflow_steps_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "vacancy_approval_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancy_approval_workflow_steps" ADD CONSTRAINT "vacancy_approval_workflow_steps_specificEmployeeId_fkey" FOREIGN KEY ("specificEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vacancy_approval_workflow_steps"
  ADD CONSTRAINT "vacancy_approval_workflow_steps_sequence_positive_check"
  CHECK ("sequence" >= 1);

ALTER TABLE "vacancy_approval_workflow_steps"
  ADD CONSTRAINT "vacancy_approval_workflow_steps_type_fields_check"
  CHECK (
    (
      "approverType" = 'MANAGER_OF_REQUESTER'
      AND "specificEmployeeId" IS NULL
      AND "requiredRoleCode" IS NULL
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
    )
  );
