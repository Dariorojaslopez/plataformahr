-- Manual integrity constraints for ATS interviews.

ALTER TABLE "interview_form_questions"
  ADD CONSTRAINT "interview_form_questions_order_nonnegative_check"
  CHECK ("order" >= 0);

ALTER TABLE "interview_form_questions"
  ADD CONSTRAINT "interview_form_questions_weight_nonnegative_check"
  CHECK ("weight" IS NULL OR "weight" >= 0);

ALTER TABLE "interview_questions"
  ADD CONSTRAINT "interview_questions_order_nonnegative_check"
  CHECK ("order" >= 0);

ALTER TABLE "interview_questions"
  ADD CONSTRAINT "interview_questions_weight_nonnegative_check"
  CHECK ("weight" IS NULL OR "weight" >= 0);

ALTER TABLE "interview_answers"
  ADD CONSTRAINT "interview_answers_rating_range_check"
  CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5));

ALTER TABLE "interview_transcript_segments"
  ADD CONSTRAINT "interview_transcript_segments_sequence_nonnegative_check"
  CHECK ("sequence" >= 0);
