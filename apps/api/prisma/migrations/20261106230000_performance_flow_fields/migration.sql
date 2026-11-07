ALTER TABLE "users" ADD COLUMN "personalDataAcceptedAt" TIMESTAMP(3);

ALTER TABLE "performance_cycles" ADD COLUMN "passingScore" DECIMAL(5,2) NOT NULL DEFAULT 70;

ALTER TABLE "goals" ADD COLUMN "startDate" DATE;
ALTER TABLE "goals" ADD COLUMN "endDate" DATE;
