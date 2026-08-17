-- Preserve current access for every existing tenant.

INSERT INTO "company_modules" (
  "id", "companyId", "module", "enabled", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  company."id",
  module.code::"PlatformModule",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "companies" AS company
CROSS JOIN (
  VALUES ('ORGANIZATION'), ('ATS'), ('PERFORMANCE'), ('GOALS'), ('SETTINGS')
) AS module(code)
WHERE company."deletedAt" IS NULL
ON CONFLICT ("companyId", "module") DO UPDATE SET
  "enabled" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "company_features" (
  "id", "companyId", "feature", "enabled", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  company."id",
  feature.code,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "companies" AS company
CROSS JOIN (
  VALUES
    ('organization.employees'),
    ('organization.org-chart'),
    ('organization.import'),
    ('organization.business-units'),
    ('organization.areas'),
    ('organization.positions'),
    ('organization.position-fields'),
    ('organization.job-levels'),
    ('ats.vacancy-requests'),
    ('ats.vacancies'),
    ('ats.candidates'),
    ('ats.pipeline'),
    ('ats.interviews'),
    ('ats.interview-templates'),
    ('ats.approvals'),
    ('performance.cycles'),
    ('performance.my-evaluations'),
    ('performance.my-results'),
    ('performance.results'),
    ('performance.competencies'),
    ('performance.scales'),
    ('goals.cycles'),
    ('goals.goals'),
    ('goals.mine'),
    ('goals.team'),
    ('goals.reviews'),
    ('settings.branding')
) AS feature(code)
WHERE company."deletedAt" IS NULL
ON CONFLICT ("companyId", "feature") DO UPDATE SET
  "enabled" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
