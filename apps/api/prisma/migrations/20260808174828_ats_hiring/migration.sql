-- CreateTable
CREATE TABLE "hirings" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "jobOfferId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "candidateId" UUID NOT NULL,
    "vacancyId" UUID NOT NULL,
    "hiredByUserId" UUID NOT NULL,
    "hireDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hirings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hirings_applicationId_key" ON "hirings"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "hirings_jobOfferId_key" ON "hirings"("jobOfferId");

-- CreateIndex
CREATE UNIQUE INDEX "hirings_employeeId_key" ON "hirings"("employeeId");

-- CreateIndex
CREATE INDEX "hirings_companyId_idx" ON "hirings"("companyId");

-- CreateIndex
CREATE INDEX "hirings_candidateId_idx" ON "hirings"("candidateId");

-- CreateIndex
CREATE INDEX "hirings_vacancyId_idx" ON "hirings"("vacancyId");

-- CreateIndex
CREATE INDEX "hirings_hiredByUserId_idx" ON "hirings"("hiredByUserId");

-- AddForeignKey
ALTER TABLE "hirings" ADD CONSTRAINT "hirings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hirings" ADD CONSTRAINT "hirings_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hirings" ADD CONSTRAINT "hirings_jobOfferId_fkey" FOREIGN KEY ("jobOfferId") REFERENCES "job_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hirings" ADD CONSTRAINT "hirings_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hirings" ADD CONSTRAINT "hirings_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hirings" ADD CONSTRAINT "hirings_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "vacancies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hirings" ADD CONSTRAINT "hirings_hiredByUserId_fkey" FOREIGN KEY ("hiredByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
