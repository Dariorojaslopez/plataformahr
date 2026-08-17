-- Public vacancy URLs and optional stage-history actor for unauthenticated applies.
-- Additive and forward-only: existing vacancies stay unpublished (publicId/publishedAt NULL).

ALTER TABLE "vacancies" ADD COLUMN "publicId" TEXT;
ALTER TABLE "vacancies" ADD COLUMN "publishedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "vacancies_publicId_key" ON "vacancies"("publicId");

ALTER TABLE "application_stage_histories" ALTER COLUMN "changedByUserId" DROP NOT NULL;
