-- CreateEnum
CREATE TYPE "PreHireCheckStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'NOT_REQUIRED');

-- CreateEnum
CREATE TYPE "PreHireDocumentKind" AS ENUM ('SECURITY_STUDY', 'MEDICAL_EXAM');

-- AlterTable
ALTER TABLE "applications" ADD COLUMN "securityStudyStatus" "PreHireCheckStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "applications" ADD COLUMN "medicalExamStatus" "PreHireCheckStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "application_pre_hire_documents" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "kind" "PreHireDocumentKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_pre_hire_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "application_pre_hire_documents_companyId_idx" ON "application_pre_hire_documents"("companyId");

-- CreateIndex
CREATE INDEX "application_pre_hire_documents_applicationId_idx" ON "application_pre_hire_documents"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "application_pre_hire_documents_applicationId_kind_key" ON "application_pre_hire_documents"("applicationId", "kind");

-- AddForeignKey
ALTER TABLE "application_pre_hire_documents" ADD CONSTRAINT "application_pre_hire_documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_pre_hire_documents" ADD CONSTRAINT "application_pre_hire_documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_pre_hire_documents" ADD CONSTRAINT "application_pre_hire_documents_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
