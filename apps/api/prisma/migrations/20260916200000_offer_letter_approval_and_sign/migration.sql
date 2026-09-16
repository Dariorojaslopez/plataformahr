-- CreateEnum
CREATE TYPE "OfferLetterApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OfferLetterSendMode" AS ENUM ('ATTACHMENT', 'DIGITAL_SIGNATURE');

-- AlterTable
ALTER TABLE "job_offers"
  ADD COLUMN "offerLetterApprovalStatus" "OfferLetterApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN "offerLetterApprovalStartedAt" TIMESTAMP(3),
  ADD COLUMN "offerLetterApprovalCompletedAt" TIMESTAMP(3),
  ADD COLUMN "offerLetterSentAt" TIMESTAMP(3),
  ADD COLUMN "offerLetterSendMode" "OfferLetterSendMode",
  ADD COLUMN "offerLetterSignToken" TEXT,
  ADD COLUMN "offerLetterSignTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "offerLetterCandidateSignedAt" TIMESTAMP(3),
  ADD COLUMN "offerLetterSignatureFileName" TEXT,
  ADD COLUMN "offerLetterSignatureOriginalName" TEXT,
  ADD COLUMN "offerLetterSignatureMimeType" TEXT,
  ADD COLUMN "candidateSignedLetterFileName" TEXT,
  ADD COLUMN "candidateSignedLetterOriginalName" TEXT,
  ADD COLUMN "candidateSignedLetterMimeType" TEXT;

CREATE UNIQUE INDEX "job_offers_offerLetterSignToken_key" ON "job_offers"("offerLetterSignToken");
CREATE INDEX "job_offers_offerLetterApprovalStatus_idx" ON "job_offers"("offerLetterApprovalStatus");

-- CreateTable
CREATE TABLE "job_offer_offer_letter_approvals" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "jobOfferId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "positionId" UUID NOT NULL,
    "approverEmployeeId" UUID NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decidedByUserId" UUID,
    "decidedAt" TIMESTAMP(3),
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_offer_offer_letter_approvals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "job_offer_offer_letter_approvals_jobOfferId_sequence_key" ON "job_offer_offer_letter_approvals"("jobOfferId", "sequence");
CREATE INDEX "job_offer_offer_letter_approvals_companyId_idx" ON "job_offer_offer_letter_approvals"("companyId");
CREATE INDEX "job_offer_offer_letter_approvals_jobOfferId_idx" ON "job_offer_offer_letter_approvals"("jobOfferId");
CREATE INDEX "job_offer_offer_letter_approvals_status_idx" ON "job_offer_offer_letter_approvals"("status");
CREATE INDEX "job_offer_offer_letter_approvals_approverEmployeeId_idx" ON "job_offer_offer_letter_approvals"("approverEmployeeId");

ALTER TABLE "job_offer_offer_letter_approvals" ADD CONSTRAINT "job_offer_offer_letter_approvals_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_offer_offer_letter_approvals" ADD CONSTRAINT "job_offer_offer_letter_approvals_jobOfferId_fkey" FOREIGN KEY ("jobOfferId") REFERENCES "job_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_offer_offer_letter_approvals" ADD CONSTRAINT "job_offer_offer_letter_approvals_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_offer_offer_letter_approvals" ADD CONSTRAINT "job_offer_offer_letter_approvals_approverEmployeeId_fkey" FOREIGN KEY ("approverEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_offer_offer_letter_approvals" ADD CONSTRAINT "job_offer_offer_letter_approvals_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
