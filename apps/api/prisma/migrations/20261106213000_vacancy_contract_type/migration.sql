CREATE TYPE "VacancyContractType" AS ENUM (
  'INDEFINITE',
  'FIXED_TERM',
  'WORK_OR_LABOR',
  'SERVICE',
  'APPRENTICESHIP'
);

ALTER TABLE "vacancy_requests" ADD COLUMN "contractType" "VacancyContractType";
