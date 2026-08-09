-- AlterTable
ALTER TABLE "performance_evaluations" ADD COLUMN     "scorePercentage" DECIMAL(5,2);

ALTER TABLE "performance_evaluations"
ADD CONSTRAINT "performance_evaluations_scorePercentage_range_chk"
CHECK ("scorePercentage" IS NULL OR ("scorePercentage" >= 0 AND "scorePercentage" <= 100));

-- CreateTable
CREATE TABLE "performance_evaluation_responses" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "evaluationId" UUID NOT NULL,
    "evaluationCompetencyId" UUID NOT NULL,
    "selectedScaleLevelId" UUID NOT NULL,
    "ratingValue" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_evaluation_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "performance_evaluation_responses_companyId_idx" ON "performance_evaluation_responses"("companyId");

-- CreateIndex
CREATE INDEX "performance_evaluation_responses_evaluationId_idx" ON "performance_evaluation_responses"("evaluationId");

-- CreateIndex
CREATE INDEX "performance_evaluation_responses_selectedScaleLevelId_idx" ON "performance_evaluation_responses"("selectedScaleLevelId");

-- CreateIndex
CREATE UNIQUE INDEX "performance_evaluation_responses_evaluationId_evaluationCom_key" ON "performance_evaluation_responses"("evaluationId", "evaluationCompetencyId");

-- CreateIndex
CREATE UNIQUE INDEX "performance_evaluation_responses_evaluationCompetencyId_key" ON "performance_evaluation_responses"("evaluationCompetencyId");

-- AddForeignKey
ALTER TABLE "performance_evaluation_responses" ADD CONSTRAINT "performance_evaluation_responses_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_evaluation_responses" ADD CONSTRAINT "performance_evaluation_responses_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "performance_evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_evaluation_responses" ADD CONSTRAINT "performance_evaluation_responses_evaluationCompetencyId_fkey" FOREIGN KEY ("evaluationCompetencyId") REFERENCES "performance_evaluation_competencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_evaluation_responses" ADD CONSTRAINT "performance_evaluation_responses_selectedScaleLevelId_fkey" FOREIGN KEY ("selectedScaleLevelId") REFERENCES "performance_evaluation_scale_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
