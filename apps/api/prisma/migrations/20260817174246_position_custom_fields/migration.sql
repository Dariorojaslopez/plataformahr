-- CreateEnum
CREATE TYPE "PositionCustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'SELECT');

-- CreateTable
CREATE TABLE "position_custom_field_definitions" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "PositionCustomFieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "position_custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_custom_field_options" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "definitionId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "position_custom_field_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_custom_field_values" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "positionId" UUID NOT NULL,
    "definitionId" UUID NOT NULL,
    "optionId" UUID,
    "textValue" TEXT,
    "numberValue" DECIMAL(18,4),
    "booleanValue" BOOLEAN,
    "dateValue" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "position_custom_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "position_custom_field_definitions_companyId_idx" ON "position_custom_field_definitions"("companyId");

-- CreateIndex
CREATE INDEX "position_custom_field_definitions_companyId_active_sortOrde_idx" ON "position_custom_field_definitions"("companyId", "active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "position_custom_field_definitions_companyId_key_key" ON "position_custom_field_definitions"("companyId", "key");

-- CreateIndex
CREATE INDEX "position_custom_field_options_companyId_idx" ON "position_custom_field_options"("companyId");

-- CreateIndex
CREATE INDEX "position_custom_field_options_definitionId_sortOrder_idx" ON "position_custom_field_options"("definitionId", "sortOrder");

-- CreateIndex
CREATE INDEX "position_custom_field_values_companyId_idx" ON "position_custom_field_values"("companyId");

-- CreateIndex
CREATE INDEX "position_custom_field_values_definitionId_idx" ON "position_custom_field_values"("definitionId");

-- CreateIndex
CREATE INDEX "position_custom_field_values_optionId_idx" ON "position_custom_field_values"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "position_custom_field_values_positionId_definitionId_key" ON "position_custom_field_values"("positionId", "definitionId");

-- AddForeignKey
ALTER TABLE "position_custom_field_definitions" ADD CONSTRAINT "position_custom_field_definitions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_custom_field_options" ADD CONSTRAINT "position_custom_field_options_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_custom_field_options" ADD CONSTRAINT "position_custom_field_options_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "position_custom_field_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_custom_field_values" ADD CONSTRAINT "position_custom_field_values_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_custom_field_values" ADD CONSTRAINT "position_custom_field_values_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_custom_field_values" ADD CONSTRAINT "position_custom_field_values_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "position_custom_field_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_custom_field_values" ADD CONSTRAINT "position_custom_field_values_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "position_custom_field_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integrity CHECKs Prisma cannot express in the schema DSL.
ALTER TABLE "position_custom_field_definitions"
  ADD CONSTRAINT "position_custom_field_definitions_key_format_check"
  CHECK ("key" ~ '^[a-z][a-z0-9_]{1,62}$');

ALTER TABLE "position_custom_field_definitions"
  ADD CONSTRAINT "position_custom_field_definitions_sort_order_check"
  CHECK ("sortOrder" >= 0);

ALTER TABLE "position_custom_field_options"
  ADD CONSTRAINT "position_custom_field_options_sort_order_check"
  CHECK ("sortOrder" >= 0);

-- At most one typed column populated. Empty rows are not stored.
ALTER TABLE "position_custom_field_values"
  ADD CONSTRAINT "position_custom_field_values_one_typed_value_check"
  CHECK (
    (
      (CASE WHEN "textValue" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "numberValue" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "booleanValue" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "dateValue" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "optionId" IS NOT NULL THEN 1 ELSE 0 END)
    ) <= 1
  );
