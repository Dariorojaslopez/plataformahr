-- Manual integrity constraints for organization_core.
-- Prisma does not express CHECK / partial unique indexes in the schema DSL.

ALTER TABLE "positions"
  ADD CONSTRAINT "positions_headcount_nonnegative_check"
  CHECK ("headcount" >= 0);

ALTER TABLE "job_levels"
  ADD CONSTRAINT "job_levels_rank_nonnegative_check"
  CHECK ("rank" >= 0);

ALTER TABLE "employees"
  ADD CONSTRAINT "employees_children_count_nonnegative_check"
  CHECK ("childrenCount" IS NULL OR "childrenCount" >= 0);

ALTER TABLE "employee_reporting_lines"
  ADD CONSTRAINT "employee_reporting_lines_no_self_check"
  CHECK ("employeeId" <> "managerEmployeeId");

-- At most one DIRECT manager per employee.
CREATE UNIQUE INDEX "employee_reporting_lines_one_direct_manager_idx"
  ON "employee_reporting_lines" ("employeeId")
  WHERE "type" = 'DIRECT';
