-- Persist the system role on the employee record so it can be assigned
-- from the collaborator form, independent of issuing a password.
ALTER TABLE "employees" ADD COLUMN "accessRoleCode" TEXT NOT NULL DEFAULT 'COLLABORATOR';

UPDATE "employees" AS employee
SET "accessRoleCode" = picked.code
FROM (
  SELECT DISTINCT ON (membership."userId", membership."companyId")
    membership."userId",
    membership."companyId",
    role.code
  FROM "company_memberships" AS membership
  INNER JOIN "membership_roles" AS membership_role
    ON membership_role."membershipId" = membership.id
  INNER JOIN "roles" AS role
    ON role.id = membership_role."roleId"
  WHERE role.scope = 'COMPANY'
  ORDER BY
    membership."userId",
    membership."companyId",
    CASE role.code
      WHEN 'CLIENT_ADMIN' THEN 0
      WHEN 'RECRUITER' THEN 1
      WHEN 'PERFORMANCE_MANAGER' THEN 2
      WHEN 'LEADER' THEN 3
      WHEN 'COLLABORATOR' THEN 4
      ELSE 5
    END
) AS picked
WHERE employee."userId" = picked."userId"
  AND employee."companyId" = picked."companyId"
  AND employee."deletedAt" IS NULL
  AND picked.code IN (
    'CLIENT_ADMIN',
    'COLLABORATOR',
    'LEADER',
    'RECRUITER',
    'PERFORMANCE_MANAGER'
  );
