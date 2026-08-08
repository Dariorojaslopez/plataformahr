-- CreateEnum
CREATE TYPE "VacancyRequestType" AS ENUM ('EXISTING_POSITION', 'NEW_POSITION');

-- CreateEnum
CREATE TYPE "VacancyRequestStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VacancyApprovalStep" AS ENUM ('DIRECT_MANAGER', 'HR', 'GENERAL_MANAGER');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "VacancyStatus" AS ENUM ('OPEN', 'PAUSED', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "vacancy_requests" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "requestedByEmployeeId" UUID NOT NULL,
    "type" "VacancyRequestType" NOT NULL,
    "existingPositionId" UUID,
    "requestedPositionName" TEXT,
    "requestedAreaId" UUID,
    "requestedJobLevelId" UUID,
    "requestedHeadcount" INTEGER NOT NULL,
    "justification" TEXT NOT NULL,
    "generalManagerApprovalRequired" BOOLEAN NOT NULL DEFAULT false,
    "status" "VacancyRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vacancy_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vacancy_approvals" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "vacancyRequestId" UUID NOT NULL,
    "step" "VacancyApprovalStep" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "approverEmployeeId" UUID,
    "requiredRoleCode" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decidedByUserId" UUID,
    "decidedAt" TIMESTAMP(3),
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacancy_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vacancies" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "vacancyRequestId" UUID NOT NULL,
    "positionId" UUID NOT NULL,
    "areaId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "headcount" INTEGER NOT NULL,
    "filledCount" INTEGER NOT NULL DEFAULT 0,
    "status" "VacancyStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vacancies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vacancy_requests_companyId_idx" ON "vacancy_requests"("companyId");

-- CreateIndex
CREATE INDEX "vacancy_requests_status_idx" ON "vacancy_requests"("status");

-- CreateIndex
CREATE INDEX "vacancy_requests_type_idx" ON "vacancy_requests"("type");

-- CreateIndex
CREATE INDEX "vacancy_requests_requestedByEmployeeId_idx" ON "vacancy_requests"("requestedByEmployeeId");

-- CreateIndex
CREATE INDEX "vacancy_requests_existingPositionId_idx" ON "vacancy_requests"("existingPositionId");

-- CreateIndex
CREATE INDEX "vacancy_approvals_companyId_idx" ON "vacancy_approvals"("companyId");

-- CreateIndex
CREATE INDEX "vacancy_approvals_vacancyRequestId_idx" ON "vacancy_approvals"("vacancyRequestId");

-- CreateIndex
CREATE INDEX "vacancy_approvals_status_idx" ON "vacancy_approvals"("status");

-- CreateIndex
CREATE INDEX "vacancy_approvals_approverEmployeeId_idx" ON "vacancy_approvals"("approverEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "vacancy_approvals_vacancyRequestId_step_key" ON "vacancy_approvals"("vacancyRequestId", "step");

-- CreateIndex
CREATE UNIQUE INDEX "vacancies_vacancyRequestId_key" ON "vacancies"("vacancyRequestId");

-- CreateIndex
CREATE INDEX "vacancies_companyId_idx" ON "vacancies"("companyId");

-- CreateIndex
CREATE INDEX "vacancies_positionId_idx" ON "vacancies"("positionId");

-- CreateIndex
CREATE INDEX "vacancies_areaId_idx" ON "vacancies"("areaId");

-- CreateIndex
CREATE INDEX "vacancies_status_idx" ON "vacancies"("status");

-- AddForeignKey
ALTER TABLE "vacancy_requests" ADD CONSTRAINT "vacancy_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancy_requests" ADD CONSTRAINT "vacancy_requests_requestedByEmployeeId_fkey" FOREIGN KEY ("requestedByEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancy_requests" ADD CONSTRAINT "vacancy_requests_existingPositionId_fkey" FOREIGN KEY ("existingPositionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancy_requests" ADD CONSTRAINT "vacancy_requests_requestedAreaId_fkey" FOREIGN KEY ("requestedAreaId") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancy_requests" ADD CONSTRAINT "vacancy_requests_requestedJobLevelId_fkey" FOREIGN KEY ("requestedJobLevelId") REFERENCES "job_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancy_approvals" ADD CONSTRAINT "vacancy_approvals_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancy_approvals" ADD CONSTRAINT "vacancy_approvals_vacancyRequestId_fkey" FOREIGN KEY ("vacancyRequestId") REFERENCES "vacancy_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancy_approvals" ADD CONSTRAINT "vacancy_approvals_approverEmployeeId_fkey" FOREIGN KEY ("approverEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancy_approvals" ADD CONSTRAINT "vacancy_approvals_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_vacancyRequestId_fkey" FOREIGN KEY ("vacancyRequestId") REFERENCES "vacancy_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
