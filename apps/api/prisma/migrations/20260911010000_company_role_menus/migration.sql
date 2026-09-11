-- Admin-configured menu grants per company role.
CREATE TABLE "company_role_menus" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "roleCode" TEXT NOT NULL,
    "hrefs" TEXT[] NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_role_menus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_role_menus_companyId_roleCode_key" ON "company_role_menus"("companyId", "roleCode");
CREATE INDEX "company_role_menus_companyId_idx" ON "company_role_menus"("companyId");

ALTER TABLE "company_role_menus" ADD CONSTRAINT "company_role_menus_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable the new settings page for tenants that already have Apariencia.
INSERT INTO "company_features" (
  "id", "companyId", "feature", "enabled", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  company."id",
  'settings.role-menu',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "companies" AS company
INNER JOIN "company_features" AS branding
  ON branding."companyId" = company."id"
 AND branding."feature" = 'settings.branding'
 AND branding."enabled" = true
WHERE company."deletedAt" IS NULL
ON CONFLICT ("companyId", "feature") DO UPDATE SET
  "enabled" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
