-- AlterTable
ALTER TABLE "job_offers" ADD COLUMN "signedOfferLetterFileName" TEXT;
ALTER TABLE "job_offers" ADD COLUMN "signedOfferLetterOriginalName" TEXT;
ALTER TABLE "job_offers" ADD COLUMN "signedOfferLetterMimeType" TEXT;
ALTER TABLE "job_offers" ADD COLUMN "signedOfferLetterUploadedAt" TIMESTAMP(3);
ALTER TABLE "job_offers" ADD COLUMN "signedOfferLetterUploadedByUserId" UUID;

-- AddForeignKey
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_signedOfferLetterUploadedByUserId_fkey" FOREIGN KEY ("signedOfferLetterUploadedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
