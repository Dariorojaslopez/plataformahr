-- CreateEnum
CREATE TYPE "CustomFieldAppliesTo" AS ENUM ('POSITION', 'EMPLOYEE');

-- AlterTable
ALTER TABLE "position_custom_field_definitions"
  ADD COLUMN "appliesTo" "CustomFieldAppliesTo" NOT NULL DEFAULT 'POSITION';

DROP INDEX "position_custom_field_definitions_companyId_key_key";
DROP INDEX "position_custom_field_definitions_companyId_active_sortOrde_idx";

CREATE UNIQUE INDEX "pcf_defs_company_applies_key_key"
  ON "position_custom_field_definitions"("companyId", "appliesTo", "key");

CREATE INDEX "pcf_defs_company_applies_active_sort_idx"
  ON "position_custom_field_definitions"("companyId", "appliesTo", "active", "sortOrder");

-- CreateTable
CREATE TABLE "employee_custom_field_values" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "definitionId" UUID NOT NULL,
    "optionId" UUID,
    "textValue" TEXT,
    "numberValue" DECIMAL(18,4),
    "booleanValue" BOOLEAN,
    "dateValue" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_custom_field_values_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_custom_field_values_companyId_idx" ON "employee_custom_field_values"("companyId");
CREATE INDEX "employee_custom_field_values_definitionId_idx" ON "employee_custom_field_values"("definitionId");
CREATE INDEX "employee_custom_field_values_optionId_idx" ON "employee_custom_field_values"("optionId");
CREATE UNIQUE INDEX "employee_custom_field_values_employeeId_definitionId_key" ON "employee_custom_field_values"("employeeId", "definitionId");

ALTER TABLE "employee_custom_field_values"
  ADD CONSTRAINT "employee_custom_field_values_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_custom_field_values"
  ADD CONSTRAINT "employee_custom_field_values_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_custom_field_values"
  ADD CONSTRAINT "employee_custom_field_values_definitionId_fkey"
  FOREIGN KEY ("definitionId") REFERENCES "position_custom_field_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_custom_field_values"
  ADD CONSTRAINT "employee_custom_field_values_optionId_fkey"
  FOREIGN KEY ("optionId") REFERENCES "position_custom_field_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_custom_field_values"
  ADD CONSTRAINT "employee_custom_field_values_one_typed_value_check"
  CHECK (
    (
      (CASE WHEN "textValue" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "numberValue" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "booleanValue" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "dateValue" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "optionId" IS NOT NULL THEN 1 ELSE 0 END)
    ) <= 1
  );
