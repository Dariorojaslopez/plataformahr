-- Demo / commercial access window for tenant companies.
-- accessEndsAt NULL = does not expire until an end date is assigned.
ALTER TABLE "companies"
  ADD COLUMN "accessStartsAt" TIMESTAMP(3),
  ADD COLUMN "accessEndsAt" TIMESTAMP(3);
