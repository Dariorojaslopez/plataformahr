ALTER TABLE "vacancies"
ADD COLUMN "assignedRecruiterEmployeeId" UUID;

CREATE INDEX "vacancies_assignedRecruiterEmployeeId_idx"
ON "vacancies"("assignedRecruiterEmployeeId");

ALTER TABLE "vacancies"
ADD CONSTRAINT "vacancies_assignedRecruiterEmployeeId_fkey"
FOREIGN KEY ("assignedRecruiterEmployeeId") REFERENCES "employees"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
