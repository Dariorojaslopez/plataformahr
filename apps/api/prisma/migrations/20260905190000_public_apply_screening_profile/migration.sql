-- Public apply: screening + rich application profile

CREATE TYPE "EducationLevel" AS ENUM (
  'PRIMARY',
  'HIGH_SCHOOL',
  'TECHNICAL',
  'TECHNOLOGICAL',
  'PROFESSIONAL',
  'SPECIALIZATION',
  'MASTER',
  'DOCTORATE',
  'DIPLOMA',
  'COURSE'
);

ALTER TABLE "vacancies" ADD COLUMN "screeningMinCorrect" INTEGER;

CREATE TABLE "vacancy_screening_questions" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "vacancyId" UUID NOT NULL,
  "prompt" TEXT NOT NULL,
  "correctAnswer" BOOLEAN NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vacancy_screening_questions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vacancy_screening_questions_vacancyId_sortOrder_key"
  ON "vacancy_screening_questions"("vacancyId", "sortOrder");
CREATE INDEX "vacancy_screening_questions_companyId_idx"
  ON "vacancy_screening_questions"("companyId");
CREATE INDEX "vacancy_screening_questions_vacancyId_idx"
  ON "vacancy_screening_questions"("vacancyId");

ALTER TABLE "vacancy_screening_questions"
  ADD CONSTRAINT "vacancy_screening_questions_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vacancy_screening_questions"
  ADD CONSTRAINT "vacancy_screening_questions_vacancyId_fkey"
  FOREIGN KEY ("vacancyId") REFERENCES "vacancies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "candidates" ADD COLUMN "birthDate" DATE;
ALTER TABLE "candidates" ADD COLUMN "professionalProfile" TEXT;

ALTER TABLE "applications" ADD COLUMN "professionalProfile" TEXT;
ALTER TABLE "applications" ADD COLUMN "screeningCorrectCount" INTEGER;
ALTER TABLE "applications" ADD COLUMN "screeningPassed" BOOLEAN;

CREATE TABLE "application_work_experiences" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "companyName" TEXT NOT NULL,
  "country" TEXT,
  "positionTitle" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE,
  "isCurrent" BOOLEAN NOT NULL DEFAULT false,
  "functions" TEXT,
  "achievements" TEXT,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "application_work_experiences_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "application_work_experiences_companyId_idx"
  ON "application_work_experiences"("companyId");
CREATE INDEX "application_work_experiences_applicationId_idx"
  ON "application_work_experiences"("applicationId");

ALTER TABLE "application_work_experiences"
  ADD CONSTRAINT "application_work_experiences_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "application_work_experiences"
  ADD CONSTRAINT "application_work_experiences_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "applications"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "application_educations" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "institution" TEXT NOT NULL,
  "program" TEXT NOT NULL,
  "educationLevel" "EducationLevel" NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE,
  "isStudying" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "application_educations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "application_educations_companyId_idx"
  ON "application_educations"("companyId");
CREATE INDEX "application_educations_applicationId_idx"
  ON "application_educations"("applicationId");

ALTER TABLE "application_educations"
  ADD CONSTRAINT "application_educations_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "application_educations"
  ADD CONSTRAINT "application_educations_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "applications"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "application_screening_answers" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "questionId" UUID,
  "questionPrompt" TEXT NOT NULL,
  "correctAnswer" BOOLEAN NOT NULL,
  "answer" BOOLEAN NOT NULL,
  "isCorrect" BOOLEAN NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_screening_answers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "application_screening_answers_companyId_idx"
  ON "application_screening_answers"("companyId");
CREATE INDEX "application_screening_answers_applicationId_idx"
  ON "application_screening_answers"("applicationId");

ALTER TABLE "application_screening_answers"
  ADD CONSTRAINT "application_screening_answers_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "application_screening_answers"
  ADD CONSTRAINT "application_screening_answers_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "applications"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
