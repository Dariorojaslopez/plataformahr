-- Additive tenant branding on companies. Nullable so existing tenants keep
-- Plataforma HR defaults without a backfill.

ALTER TABLE "companies"
  ADD COLUMN "brandPrimaryColor" TEXT,
  ADD COLUMN "logoFileName" TEXT,
  ADD COLUMN "logoMimeType" TEXT,
  ADD COLUMN "logoUpdatedAt" TIMESTAMP(3);

ALTER TABLE "companies"
  ADD CONSTRAINT "companies_brand_primary_color_hex_check"
  CHECK (
    "brandPrimaryColor" IS NULL
    OR "brandPrimaryColor" ~ '^#[0-9A-F]{6}$'
  );

ALTER TABLE "companies"
  ADD CONSTRAINT "companies_logo_mime_check"
  CHECK (
    "logoMimeType" IS NULL
    OR "logoMimeType" IN ('image/png', 'image/jpeg', 'image/webp')
  );

ALTER TABLE "companies"
  ADD CONSTRAINT "companies_logo_filename_check"
  CHECK (
    "logoFileName" IS NULL
    OR "logoFileName" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$'
  );

ALTER TABLE "companies"
  ADD CONSTRAINT "companies_logo_fields_together_check"
  CHECK (
    (
      "logoFileName" IS NULL
      AND "logoMimeType" IS NULL
      AND "logoUpdatedAt" IS NULL
    )
    OR (
      "logoFileName" IS NOT NULL
      AND "logoMimeType" IS NOT NULL
      AND "logoUpdatedAt" IS NOT NULL
    )
  );
