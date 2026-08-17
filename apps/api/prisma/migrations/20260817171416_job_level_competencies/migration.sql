-- CreateTable
CREATE TABLE "job_level_competencies" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "jobLevelId" UUID NOT NULL,
    "competencyId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_level_competencies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_level_competencies_companyId_idx" ON "job_level_competencies"("companyId");

-- CreateIndex
CREATE INDEX "job_level_competencies_jobLevelId_idx" ON "job_level_competencies"("jobLevelId");

-- CreateIndex
CREATE INDEX "job_level_competencies_competencyId_idx" ON "job_level_competencies"("competencyId");

-- CreateIndex
CREATE UNIQUE INDEX "job_level_competencies_jobLevelId_competencyId_key" ON "job_level_competencies"("jobLevelId", "competencyId");

-- AddForeignKey
ALTER TABLE "job_level_competencies" ADD CONSTRAINT "job_level_competencies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_level_competencies" ADD CONSTRAINT "job_level_competencies_jobLevelId_fkey" FOREIGN KEY ("jobLevelId") REFERENCES "job_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_level_competencies" ADD CONSTRAINT "job_level_competencies_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "competencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
