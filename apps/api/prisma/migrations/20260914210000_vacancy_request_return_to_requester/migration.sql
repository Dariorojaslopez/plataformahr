-- Store rejection reason when a request is returned to the requester as DRAFT.

ALTER TABLE "vacancy_requests"
  ADD COLUMN "returnedAt" TIMESTAMP(3),
  ADD COLUMN "lastReturnComment" TEXT;
