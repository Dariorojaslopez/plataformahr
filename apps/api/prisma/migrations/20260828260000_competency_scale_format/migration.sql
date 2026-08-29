-- Scale subtype (numeric, descriptive, Likert, percentage, currency) plus range/format fields.

CREATE TYPE "CompetencyScaleFormat" AS ENUM ('NUMERIC', 'DESCRIPTIVE', 'LIKERT', 'PERCENTAGE', 'CURRENCY');

ALTER TABLE "competency_scales"
  ADD COLUMN "format" "CompetencyScaleFormat" NOT NULL DEFAULT 'NUMERIC',
  ADD COLUMN "minValue" DECIMAL(12,2),
  ADD COLUMN "maxValue" DECIMAL(12,2),
  ADD COLUMN "likertIcon" TEXT,
  ADD COLUMN "currencyCode" TEXT,
  ADD COLUMN "decimalPlaces" INTEGER;
