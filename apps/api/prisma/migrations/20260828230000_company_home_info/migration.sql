-- Single HOME communication slot per company: title, description, media, schedule.

CREATE TYPE "CompanyHomeMediaKind" AS ENUM ('IMAGE', 'VIDEO');

CREATE TABLE "company_home_infos" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "unpublishedAt" TIMESTAMP(3),
    "mediaKind" "CompanyHomeMediaKind",
    "fileName" TEXT,
    "mimeType" TEXT,
    "mediaUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_home_infos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_home_infos_companyId_key" ON "company_home_infos"("companyId");

ALTER TABLE "company_home_infos"
  ADD CONSTRAINT "company_home_infos_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "company_home_infos"
  ADD CONSTRAINT "company_home_infos_unpublish_after_publish_check"
  CHECK (
    "unpublishedAt" IS NULL
    OR "unpublishedAt" > "publishedAt"
  );

ALTER TABLE "company_home_infos"
  ADD CONSTRAINT "company_home_infos_mime_check"
  CHECK (
    "mimeType" IS NULL
    OR "mimeType" IN (
      'image/png',
      'image/jpeg',
      'image/webp',
      'video/mp4',
      'video/webm'
    )
  );

ALTER TABLE "company_home_infos"
  ADD CONSTRAINT "company_home_infos_filename_check"
  CHECK (
    "fileName" IS NULL
    OR "fileName" ~ '^info-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|mp4|webm)$'
  );

ALTER TABLE "company_home_infos"
  ADD CONSTRAINT "company_home_infos_media_fields_together_check"
  CHECK (
    (
      "mediaKind" IS NULL
      AND "fileName" IS NULL
      AND "mimeType" IS NULL
      AND "mediaUpdatedAt" IS NULL
    )
    OR (
      "mediaKind" IS NOT NULL
      AND "fileName" IS NOT NULL
      AND "mimeType" IS NOT NULL
      AND "mediaUpdatedAt" IS NOT NULL
    )
  );
