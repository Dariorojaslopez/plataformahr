-- Optional public salary on a vacancy. Shown on the public job URL only when showSalaryPublic is true.

ALTER TABLE "vacancies" ADD COLUMN "salaryAmount" DECIMAL(14,2);
ALTER TABLE "vacancies" ADD COLUMN "salaryCurrency" VARCHAR(3) NOT NULL DEFAULT 'COP';
ALTER TABLE "vacancies" ADD COLUMN "showSalaryPublic" BOOLEAN NOT NULL DEFAULT false;
