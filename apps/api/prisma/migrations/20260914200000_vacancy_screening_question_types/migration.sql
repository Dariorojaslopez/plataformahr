-- Screening questions: true/false, single choice, and multiple choice.

CREATE TYPE "VacancyScreeningQuestionType" AS ENUM (
  'YES_NO',
  'TRUE_FALSE',
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE'
);

ALTER TABLE "vacancy_screening_questions"
  ADD COLUMN "type" "VacancyScreeningQuestionType" NOT NULL DEFAULT 'YES_NO',
  ADD COLUMN "options" JSONB,
  ADD COLUMN "correctOptionIds" JSONB,
  ALTER COLUMN "correctAnswer" DROP NOT NULL;

ALTER TABLE "application_screening_answers"
  ADD COLUMN "questionType" "VacancyScreeningQuestionType" NOT NULL DEFAULT 'YES_NO',
  ADD COLUMN "optionsSnapshot" JSONB,
  ADD COLUMN "correctOptionIds" JSONB,
  ADD COLUMN "selectedOptionIds" JSONB,
  ALTER COLUMN "correctAnswer" DROP NOT NULL,
  ALTER COLUMN "answer" DROP NOT NULL;
