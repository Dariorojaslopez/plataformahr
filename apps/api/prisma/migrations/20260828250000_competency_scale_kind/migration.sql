-- Qualitative vs quantitative competency scales. Existing scales are qualitative.

CREATE TYPE "CompetencyScaleKind" AS ENUM ('QUALITATIVE', 'QUANTITATIVE');

ALTER TABLE "competency_scales"
  ADD COLUMN "kind" "CompetencyScaleKind" NOT NULL DEFAULT 'QUALITATIVE';
