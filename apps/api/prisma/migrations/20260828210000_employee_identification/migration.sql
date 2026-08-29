ALTER TABLE "employees" ADD COLUMN "documentType" TEXT;
ALTER TABLE "employees" ADD COLUMN "documentNumber" TEXT;

CREATE UNIQUE INDEX "employees_company_document_number_key"
  ON "employees" ("companyId", "documentNumber")
  WHERE "documentNumber" IS NOT NULL AND "deletedAt" IS NULL;
