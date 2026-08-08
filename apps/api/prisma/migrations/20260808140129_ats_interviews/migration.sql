-- CreateEnum
CREATE TYPE "InterviewType" AS ENUM ('HR', 'TECHNICAL', 'MANAGER', 'GENERAL', 'OTHER');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InterviewFormStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "InterviewQuestionType" AS ENUM ('TEXT', 'TEXTAREA', 'RATING', 'YES_NO');

-- CreateEnum
CREATE TYPE "TranscriptSegmentKind" AS ENUM ('QUESTION', 'ANSWER', 'NOTE', 'UNCLASSIFIED');

-- CreateTable
CREATE TABLE "interviews" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "type" "InterviewType" NOT NULL,
    "status" "InterviewStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "location" TEXT,
    "meetingUrl" TEXT,
    "notes" TEXT,
    "localRecordingName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_interviewers" (
    "interviewId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_interviewers_pkey" PRIMARY KEY ("interviewId","employeeId")
);

-- CreateTable
CREATE TABLE "interview_form_templates" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "InterviewType" NOT NULL,
    "status" "InterviewFormStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "interview_form_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_form_questions" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "type" "InterviewQuestionType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "weight" INTEGER,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_form_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_questions" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "interviewId" UUID NOT NULL,
    "sourceTemplateQuestionId" UUID,
    "text" TEXT NOT NULL,
    "type" "InterviewQuestionType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "weight" INTEGER,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_answers" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "interviewQuestionId" UUID NOT NULL,
    "answerText" TEXT,
    "rating" INTEGER,
    "yesNo" BOOLEAN,
    "answeredByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_transcript_segments" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "interviewId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "speakerLabel" TEXT,
    "kind" "TranscriptSegmentKind" NOT NULL DEFAULT 'UNCLASSIFIED',
    "text" TEXT NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_transcript_segments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interviews_companyId_idx" ON "interviews"("companyId");

-- CreateIndex
CREATE INDEX "interviews_applicationId_idx" ON "interviews"("applicationId");

-- CreateIndex
CREATE INDEX "interviews_status_idx" ON "interviews"("status");

-- CreateIndex
CREATE INDEX "interviews_type_idx" ON "interviews"("type");

-- CreateIndex
CREATE INDEX "interview_interviewers_employeeId_idx" ON "interview_interviewers"("employeeId");

-- CreateIndex
CREATE INDEX "interview_form_templates_companyId_idx" ON "interview_form_templates"("companyId");

-- CreateIndex
CREATE INDEX "interview_form_templates_status_idx" ON "interview_form_templates"("status");

-- CreateIndex
CREATE INDEX "interview_form_templates_type_idx" ON "interview_form_templates"("type");

-- CreateIndex
CREATE INDEX "interview_form_questions_companyId_idx" ON "interview_form_questions"("companyId");

-- CreateIndex
CREATE INDEX "interview_form_questions_templateId_idx" ON "interview_form_questions"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "interview_form_questions_templateId_order_key" ON "interview_form_questions"("templateId", "order");

-- CreateIndex
CREATE INDEX "interview_questions_companyId_idx" ON "interview_questions"("companyId");

-- CreateIndex
CREATE INDEX "interview_questions_interviewId_idx" ON "interview_questions"("interviewId");

-- CreateIndex
CREATE UNIQUE INDEX "interview_questions_interviewId_order_key" ON "interview_questions"("interviewId", "order");

-- CreateIndex
CREATE INDEX "interview_answers_companyId_idx" ON "interview_answers"("companyId");

-- CreateIndex
CREATE INDEX "interview_answers_interviewQuestionId_idx" ON "interview_answers"("interviewQuestionId");

-- CreateIndex
CREATE INDEX "interview_answers_answeredByUserId_idx" ON "interview_answers"("answeredByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "interview_answers_interviewQuestionId_answeredByUserId_key" ON "interview_answers"("interviewQuestionId", "answeredByUserId");

-- CreateIndex
CREATE INDEX "interview_transcript_segments_companyId_idx" ON "interview_transcript_segments"("companyId");

-- CreateIndex
CREATE INDEX "interview_transcript_segments_interviewId_idx" ON "interview_transcript_segments"("interviewId");

-- CreateIndex
CREATE INDEX "interview_transcript_segments_createdByUserId_idx" ON "interview_transcript_segments"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "interview_transcript_segments_interviewId_sequence_key" ON "interview_transcript_segments"("interviewId", "sequence");

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_interviewers" ADD CONSTRAINT "interview_interviewers_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_interviewers" ADD CONSTRAINT "interview_interviewers_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_form_templates" ADD CONSTRAINT "interview_form_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_form_questions" ADD CONSTRAINT "interview_form_questions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_form_questions" ADD CONSTRAINT "interview_form_questions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "interview_form_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_answers" ADD CONSTRAINT "interview_answers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_answers" ADD CONSTRAINT "interview_answers_interviewQuestionId_fkey" FOREIGN KEY ("interviewQuestionId") REFERENCES "interview_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_answers" ADD CONSTRAINT "interview_answers_answeredByUserId_fkey" FOREIGN KEY ("answeredByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_transcript_segments" ADD CONSTRAINT "interview_transcript_segments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_transcript_segments" ADD CONSTRAINT "interview_transcript_segments_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_transcript_segments" ADD CONSTRAINT "interview_transcript_segments_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
