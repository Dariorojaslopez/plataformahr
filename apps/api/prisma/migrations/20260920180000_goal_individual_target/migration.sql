ALTER TABLE "goals"
  ADD COLUMN "targetValue" DECIMAL(18, 4),
  ADD COLUMN "targetScaleLevelId" UUID;

CREATE INDEX "goals_targetScaleLevelId_idx" ON "goals"("targetScaleLevelId");

ALTER TABLE "goals"
  ADD CONSTRAINT "goals_targetScaleLevelId_fkey"
  FOREIGN KEY ("targetScaleLevelId") REFERENCES "competency_scale_levels"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
