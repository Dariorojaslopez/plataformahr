ALTER TABLE "vacancies" ADD COLUMN "interviewFormTemplateId" UUID;

ALTER TABLE "vacancies"
  ADD CONSTRAINT "vacancies_interviewFormTemplateId_fkey"
  FOREIGN KEY ("interviewFormTemplateId")
  REFERENCES "interview_form_templates"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "vacancies_interviewFormTemplateId_idx"
  ON "vacancies"("interviewFormTemplateId");
