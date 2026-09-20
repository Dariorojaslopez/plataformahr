-- AlterEnum
ALTER TYPE "ApplicationStage" ADD VALUE 'TO_HIRE';

-- AlterTable
ALTER TABLE "companies"
  ADD COLUMN "atsContractEmailSubject" TEXT,
  ADD COLUMN "atsContractEmailBody" TEXT;

-- AlterTable
ALTER TABLE "job_offers"
  ADD COLUMN "pendingHireDate" TIMESTAMP(3),
  ADD COLUMN "signedContractFileName" TEXT,
  ADD COLUMN "signedContractOriginalName" TEXT,
  ADD COLUMN "signedContractMimeType" TEXT,
  ADD COLUMN "signedContractUploadedAt" TIMESTAMP(3),
  ADD COLUMN "signedContractUploadedByUserId" UUID,
  ADD COLUMN "contractSentAt" TIMESTAMP(3),
  ADD COLUMN "contractSendMode" "OfferLetterSendMode",
  ADD COLUMN "contractSignToken" TEXT,
  ADD COLUMN "contractSignTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "contractCandidateSignedAt" TIMESTAMP(3),
  ADD COLUMN "contractSignatureFileName" TEXT,
  ADD COLUMN "contractSignatureOriginalName" TEXT,
  ADD COLUMN "contractSignatureMimeType" TEXT,
  ADD COLUMN "candidateSignedContractFileName" TEXT,
  ADD COLUMN "candidateSignedContractOriginalName" TEXT,
  ADD COLUMN "candidateSignedContractMimeType" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "job_offers_contractSignToken_key" ON "job_offers"("contractSignToken");

-- AddForeignKey
ALTER TABLE "job_offers"
  ADD CONSTRAINT "job_offers_signedContractUploadedByUserId_fkey"
  FOREIGN KEY ("signedContractUploadedByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
