-- AlterTable Company: SLA days for expected hiring date
ALTER TABLE "companies" ADD COLUMN "vacancyHiringSlaDays" INTEGER NOT NULL DEFAULT 14;

-- CreateEnum
CREATE TYPE "VacancyRequestMotive" AS ENUM (
  'NEW_POSITION',
  'REPLACEMENT_RESIGNATION',
  'REPLACEMENT_MUTUAL_AGREEMENT',
  'REPLACEMENT_TERMINATION_WITHOUT_CAUSE'
);

-- AlterTable VacancyRequest: new leader-request fields
ALTER TABLE "vacancy_requests" ADD COLUMN "motive" "VacancyRequestMotive";
ALTER TABLE "vacancy_requests" ADD COLUMN "replacedEmployeeId" UUID;
ALTER TABLE "vacancy_requests" ADD COLUMN "expectedHiringDate" DATE;
ALTER TABLE "vacancy_requests" ALTER COLUMN "justification" SET DEFAULT '';

-- Backfill motive from legacy type
UPDATE "vacancy_requests"
SET "motive" = CASE
  WHEN "type" = 'NEW_POSITION' THEN 'NEW_POSITION'::"VacancyRequestMotive"
  ELSE 'REPLACEMENT_RESIGNATION'::"VacancyRequestMotive"
END
WHERE "motive" IS NULL;

-- Backfill expected hiring date: createdAt date + company SLA
UPDATE "vacancy_requests" vr
SET "expectedHiringDate" = (vr."createdAt"::date + (c."vacancyHiringSlaDays" || ' days')::interval)::date
FROM "companies" c
WHERE c."id" = vr."companyId"
  AND vr."expectedHiringDate" IS NULL;

ALTER TABLE "vacancy_requests" ALTER COLUMN "motive" SET NOT NULL;
ALTER TABLE "vacancy_requests" ALTER COLUMN "expectedHiringDate" SET NOT NULL;

CREATE INDEX "vacancy_requests_motive_idx" ON "vacancy_requests"("motive");
CREATE INDEX "vacancy_requests_replacedEmployeeId_idx" ON "vacancy_requests"("replacedEmployeeId");

ALTER TABLE "vacancy_requests"
  ADD CONSTRAINT "vacancy_requests_replacedEmployeeId_fkey"
  FOREIGN KEY ("replacedEmployeeId") REFERENCES "employees"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
