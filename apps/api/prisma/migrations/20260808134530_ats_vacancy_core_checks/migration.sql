-- Manual integrity constraints for ATS vacancy core.

ALTER TABLE "vacancy_requests"
  ADD CONSTRAINT "vacancy_requests_headcount_positive_check"
  CHECK ("requestedHeadcount" >= 1);

ALTER TABLE "vacancies"
  ADD CONSTRAINT "vacancies_headcount_positive_check"
  CHECK ("headcount" >= 1);

ALTER TABLE "vacancies"
  ADD CONSTRAINT "vacancies_filled_nonnegative_check"
  CHECK ("filledCount" >= 0);

ALTER TABLE "vacancies"
  ADD CONSTRAINT "vacancies_filled_lte_headcount_check"
  CHECK ("filledCount" <= "headcount");

-- Coherence between request type and position fields.
ALTER TABLE "vacancy_requests"
  ADD CONSTRAINT "vacancy_requests_type_fields_check"
  CHECK (
    (
      "type" = 'EXISTING_POSITION'
      AND "existingPositionId" IS NOT NULL
      AND "requestedPositionName" IS NULL
      AND "requestedAreaId" IS NULL
      AND "requestedJobLevelId" IS NULL
    )
    OR
    (
      "type" = 'NEW_POSITION'
      AND "existingPositionId" IS NULL
      AND "requestedPositionName" IS NOT NULL
      AND "requestedAreaId" IS NOT NULL
    )
  );

ALTER TABLE "vacancy_approvals"
  ADD CONSTRAINT "vacancy_approvals_sequence_positive_check"
  CHECK ("sequence" >= 1);
