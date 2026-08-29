import { apiRequest } from "@/lib/api/client";
import type {
  AddTemplateQuestionInput,
  CreateInterviewFormTemplateInput,
  CreateInterviewInput,
  CreateTranscriptSegmentInput,
  Interview,
  InterviewFormQuestion,
  InterviewFormTemplate,
  InterviewListItem,
  InterviewTranscriptSegment,
  PendingInterview,
  UpdateInterviewFormTemplateInput,
  UpdateInterviewInput,
  UpdateTranscriptSegmentInput,
  UpsertInterviewAnswerInput,
  InterviewAnswer,
} from "@/types/interviews";

export const interviewsApi = {
  listPending: () =>
    apiRequest<PendingInterview[]>("/ats/interviews/pending"),

  applyProcessTemplate: (vacancyId: string, templateId: string) =>
    apiRequest<{
      vacancyId: string;
      templateId: string;
      interviewsUpdated: number;
    }>("/ats/interviews/process-template", {
      method: "POST",
      body: { vacancyId, templateId },
    }),

  listByApplication: (applicationId: string) =>
    apiRequest<InterviewListItem[]>(
      `/ats/applications/${applicationId}/interviews`,
    ),

  createForApplication: (applicationId: string, body: CreateInterviewInput) =>
    apiRequest<Interview>(`/ats/applications/${applicationId}/interviews`, {
      method: "POST",
      body,
    }),

  getInterview: (id: string) =>
    apiRequest<Interview>(`/ats/interviews/${id}`),

  updateInterview: (id: string, body: UpdateInterviewInput) =>
    apiRequest<Interview>(`/ats/interviews/${id}`, {
      method: "PATCH",
      body,
    }),

  startInterview: (id: string) =>
    apiRequest<Interview>(`/ats/interviews/${id}/start`, { method: "POST" }),

  completeInterview: (id: string) =>
    apiRequest<Interview>(`/ats/interviews/${id}/complete`, {
      method: "POST",
    }),

  cancelInterview: (id: string) =>
    apiRequest<Interview>(`/ats/interviews/${id}/cancel`, { method: "POST" }),

  upsertAnswer: (
    interviewId: string,
    questionId: string,
    body: UpsertInterviewAnswerInput,
  ) =>
    apiRequest<InterviewAnswer>(
      `/ats/interviews/${interviewId}/questions/${questionId}/answer`,
      { method: "PUT", body },
    ),

  getTranscript: (interviewId: string) =>
    apiRequest<InterviewTranscriptSegment[]>(
      `/ats/interviews/${interviewId}/transcript`,
    ),

  addTranscriptSegment: (
    interviewId: string,
    body: CreateTranscriptSegmentInput,
  ) =>
    apiRequest<InterviewTranscriptSegment>(
      `/ats/interviews/${interviewId}/transcript/segments`,
      { method: "POST", body },
    ),

  updateTranscriptSegment: (
    interviewId: string,
    segmentId: string,
    body: UpdateTranscriptSegmentInput,
  ) =>
    apiRequest<InterviewTranscriptSegment>(
      `/ats/interviews/${interviewId}/transcript/segments/${segmentId}`,
      { method: "PATCH", body },
    ),

  deleteTranscriptSegment: (interviewId: string, segmentId: string) =>
    apiRequest<{ deleted: boolean }>(
      `/ats/interviews/${interviewId}/transcript/segments/${segmentId}`,
      { method: "DELETE" },
    ),

  listTemplates: () =>
    apiRequest<InterviewFormTemplate[]>("/ats/interview-form-templates"),

  getTemplate: (id: string) =>
    apiRequest<InterviewFormTemplate>(`/ats/interview-form-templates/${id}`),

  createTemplate: (body: CreateInterviewFormTemplateInput) =>
    apiRequest<InterviewFormTemplate>("/ats/interview-form-templates", {
      method: "POST",
      body,
    }),

  updateTemplate: (id: string, body: UpdateInterviewFormTemplateInput) =>
    apiRequest<InterviewFormTemplate>(`/ats/interview-form-templates/${id}`, {
      method: "PATCH",
      body,
    }),

  addTemplateQuestion: (templateId: string, body: AddTemplateQuestionInput) =>
    apiRequest<InterviewFormQuestion>(
      `/ats/interview-form-templates/${templateId}/questions`,
      { method: "POST", body },
    ),
};

/** Tenant-aware keys; share ats prefix for TenantCacheBoundary clears. */
export const interviewKeys = {
  all: (companyId: string) => ["ats", companyId, "interviews"] as const,
  pending: (companyId: string) =>
    [...interviewKeys.all(companyId), "pending"] as const,
  byApplication: (companyId: string, applicationId: string) =>
    [...interviewKeys.all(companyId), "by-application", applicationId] as const,
  detail: (companyId: string, interviewId: string) =>
    [...interviewKeys.all(companyId), "detail", interviewId] as const,
  transcript: (companyId: string, interviewId: string) =>
    [...interviewKeys.all(companyId), "transcript", interviewId] as const,
  templates: (companyId: string) =>
    [...interviewKeys.all(companyId), "templates"] as const,
  template: (companyId: string, id: string) =>
    [...interviewKeys.all(companyId), "template", id] as const,
};
