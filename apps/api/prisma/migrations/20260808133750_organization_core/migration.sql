-- CreateEnum
CREATE TYPE "OrganizationEntityStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "ReportingLineType" AS ENUM ('DIRECT', 'INDIRECT');

-- CreateTable
CREATE TABLE "business_units" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "status" "OrganizationEntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "business_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "businessUnitId" UUID,
    "parentAreaId" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "status" "OrganizationEntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_levels" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "rank" INTEGER NOT NULL,
    "status" "OrganizationEntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "job_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "areaId" UUID NOT NULL,
    "jobLevelId" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "mission" TEXT,
    "responsibilities" TEXT,
    "requiredExperience" TEXT,
    "requiredEducation" TEXT,
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "status" "OrganizationEntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "birthDate" DATE,
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "maritalStatus" TEXT,
    "childrenCount" INTEGER,
    "housingType" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "businessUnitId" UUID,
    "areaId" UUID NOT NULL,
    "positionId" UUID NOT NULL,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "hireDate" DATE,
    "terminationDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_reporting_lines" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "managerEmployeeId" UUID NOT NULL,
    "type" "ReportingLineType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_reporting_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_units_companyId_idx" ON "business_units"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "business_units_companyId_name_key" ON "business_units"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "business_units_companyId_code_key" ON "business_units"("companyId", "code");

-- CreateIndex
CREATE INDEX "areas_companyId_idx" ON "areas"("companyId");

-- CreateIndex
CREATE INDEX "areas_businessUnitId_idx" ON "areas"("businessUnitId");

-- CreateIndex
CREATE INDEX "areas_parentAreaId_idx" ON "areas"("parentAreaId");

-- CreateIndex
CREATE UNIQUE INDEX "areas_companyId_name_key" ON "areas"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "areas_companyId_code_key" ON "areas"("companyId", "code");

-- CreateIndex
CREATE INDEX "job_levels_companyId_idx" ON "job_levels"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "job_levels_companyId_name_key" ON "job_levels"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "job_levels_companyId_rank_key" ON "job_levels"("companyId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "job_levels_companyId_code_key" ON "job_levels"("companyId", "code");

-- CreateIndex
CREATE INDEX "positions_companyId_idx" ON "positions"("companyId");

-- CreateIndex
CREATE INDEX "positions_areaId_idx" ON "positions"("areaId");

-- CreateIndex
CREATE INDEX "positions_jobLevelId_idx" ON "positions"("jobLevelId");

-- CreateIndex
CREATE UNIQUE INDEX "positions_companyId_name_key" ON "positions"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "positions_companyId_code_key" ON "positions"("companyId", "code");

-- CreateIndex
CREATE INDEX "employees_companyId_idx" ON "employees"("companyId");

-- CreateIndex
CREATE INDEX "employees_areaId_idx" ON "employees"("areaId");

-- CreateIndex
CREATE INDEX "employees_positionId_idx" ON "employees"("positionId");

-- CreateIndex
CREATE INDEX "employees_businessUnitId_idx" ON "employees"("businessUnitId");

-- CreateIndex
CREATE INDEX "employees_userId_idx" ON "employees"("userId");

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "employees"("status");

-- CreateIndex
CREATE UNIQUE INDEX "employees_companyId_email_key" ON "employees"("companyId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "employees_companyId_userId_key" ON "employees"("companyId", "userId");

-- CreateIndex
CREATE INDEX "employee_reporting_lines_companyId_idx" ON "employee_reporting_lines"("companyId");

-- CreateIndex
CREATE INDEX "employee_reporting_lines_employeeId_idx" ON "employee_reporting_lines"("employeeId");

-- CreateIndex
CREATE INDEX "employee_reporting_lines_managerEmployeeId_idx" ON "employee_reporting_lines"("managerEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_reporting_lines_employeeId_managerEmployeeId_type_key" ON "employee_reporting_lines"("employeeId", "managerEmployeeId", "type");

-- AddForeignKey
ALTER TABLE "business_units" ADD CONSTRAINT "business_units_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_parentAreaId_fkey" FOREIGN KEY ("parentAreaId") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_levels" ADD CONSTRAINT "job_levels_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_jobLevelId_fkey" FOREIGN KEY ("jobLevelId") REFERENCES "job_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_reporting_lines" ADD CONSTRAINT "employee_reporting_lines_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_reporting_lines" ADD CONSTRAINT "employee_reporting_lines_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_reporting_lines" ADD CONSTRAINT "employee_reporting_lines_managerEmployeeId_fkey" FOREIGN KEY ("managerEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
