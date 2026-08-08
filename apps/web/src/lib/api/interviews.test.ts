import { beforeEach, describe, expect, it, vi } from "vitest";
import { interviewKeys, interviewsApi } from "@/lib/api/interviews";
import { toCreateInterviewPayload } from "@/components/ats/interview-form";
import {
  buildAnswerPayload,
  isAnswerEditableStatus,
  missingRequiredQuestions,
} from "@/lib/ats/interview-answers";
import {
  INTERVIEW_STATUS_LABELS,
  TRANSCRIPT_KIND_LABELS,
} from "@/lib/ats/labels";
import {
  AUTOMATIC_TRANSCRIPTION_UNAVAILABLE_MESSAGE,
  getDefaultSpeechProvider,
  ManualTranscriptionProvider,
} from "@/lib/ats/speech-transcription";
import type { InterviewQuestion } from "@/types/interviews";

vi.mock("@/lib/api/client", () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from "@/lib/api/client";

const mockedRequest = vi.mocked(apiRequest);

describe("interviewsApi", () => {
  beforeEach(() => {
    mockedRequest.mockReset();
    mockedRequest.mockResolvedValue({} as never);
  });

  it("lists and creates interviews by application", async () => {
    await interviewsApi.listByApplication("app-1");
    await interviewsApi.createForApplication("app-1", {
      type: "TECHNICAL",
      interviewerEmployeeIds: ["e1"],
      templateId: "t1",
    });
    expect(mockedRequest).toHaveBeenCalledWith(
      "/ats/applications/app-1/interviews",
    );
    expect(mockedRequest).toHaveBeenCalledWith(
      "/ats/applications/app-1/interviews",
      {
        method: "POST",
        body: {
          type: "TECHNICAL",
          interviewerEmployeeIds: ["e1"],
          templateId: "t1",
        },
      },
    );
  });

  it("runs lifecycle endpoints", async () => {
    await interviewsApi.startInterview("i1");
    await interviewsApi.completeInterview("i1");
    await interviewsApi.cancelInterview("i1");
    expect(mockedRequest).toHaveBeenCalledWith("/ats/interviews/i1/start", {
      method: "POST",
    });
    expect(mockedRequest).toHaveBeenCalledWith("/ats/interviews/i1/complete", {
      method: "POST",
    });
    expect(mockedRequest).toHaveBeenCalledWith("/ats/interviews/i1/cancel", {
      method: "POST",
    });
  });

  it("upserts answers and manages transcript without sequence", async () => {
    await interviewsApi.upsertAnswer("i1", "q1", { rating: 4 });
    await interviewsApi.addTranscriptSegment("i1", {
      text: "Hola",
      kind: "QUESTION",
    });
    await interviewsApi.updateTranscriptSegment("i1", "s1", {
      kind: "ANSWER",
    });
    await interviewsApi.deleteTranscriptSegment("i1", "s1");

    expect(mockedRequest).toHaveBeenCalledWith(
      "/ats/interviews/i1/questions/q1/answer",
      { method: "PUT", body: { rating: 4 } },
    );
    const addCall = mockedRequest.mock.calls.find((c) =>
      String(c[0]).includes("/transcript/segments"),
    );
    expect(addCall?.[1]).toMatchObject({
      method: "POST",
      body: { text: "Hola", kind: "QUESTION" },
    });
    expect(JSON.stringify(addCall?.[1])).not.toContain("sequence");
  });

  it("creates templates and template questions", async () => {
    await interviewsApi.createTemplate({
      name: "Tech screen",
      type: "TECHNICAL",
    });
    await interviewsApi.addTemplateQuestion("t1", {
      text: "Explain X",
      type: "TEXTAREA",
      order: 0,
      required: true,
    });
    expect(mockedRequest).toHaveBeenCalledWith("/ats/interview-form-templates", {
      method: "POST",
      body: { name: "Tech screen", type: "TECHNICAL" },
    });
    expect(mockedRequest).toHaveBeenCalledWith(
      "/ats/interview-form-templates/t1/questions",
      {
        method: "POST",
        body: {
          text: "Explain X",
          type: "TEXTAREA",
          order: 0,
          required: true,
        },
      },
    );
  });
});

describe("interviewKeys", () => {
  it("is tenant-aware", () => {
    expect(interviewKeys.detail("c-a", "i1")[1]).toBe("c-a");
    expect(interviewKeys.detail("c-b", "i1")[1]).toBe("c-b");
    expect(interviewKeys.byApplication("c1", "a1")).not.toEqual(
      interviewKeys.byApplication("c2", "a1"),
    );
  });
});

describe("interview helpers", () => {
  it("builds create payload and answer payloads by type", () => {
    const payload = toCreateInterviewPayload({
      type: "HR",
      scheduledAt: "2026-03-01T10:00",
      location: "Sala 1",
      meetingUrl: "",
      notes: "",
      localRecordingName: "local-only.m4a",
      interviewerEmployeeIds: ["e1", "e2"],
      templateId: "t1",
    });
    expect(payload.interviewerEmployeeIds).toEqual(["e1", "e2"]);
    expect(payload.localRecordingName).toBe("local-only.m4a");
    expect(payload.meetingUrl).toBeUndefined();
    expect(payload.scheduledAt).toContain("2026");

    expect(buildAnswerPayload("TEXT", { answerText: " hi ", rating: "", yesNo: "" })).toEqual({
      answerText: "hi",
    });
    expect(buildAnswerPayload("RATING", { answerText: "", rating: "5", yesNo: "" })).toEqual({
      rating: 5,
    });
    expect(buildAnswerPayload("YES_NO", { answerText: "", rating: "", yesNo: "false" })).toEqual({
      yesNo: false,
    });
  });

  it("disables answers when completed/cancelled", () => {
    expect(isAnswerEditableStatus("IN_PROGRESS")).toBe(true);
    expect(isAnswerEditableStatus("COMPLETED")).toBe(false);
    expect(isAnswerEditableStatus("CANCELLED")).toBe(false);
  });

  it("detects missing required questions for complete UX", () => {
    const questions: InterviewQuestion[] = [
      {
        id: "q1",
        companyId: "c",
        interviewId: "i",
        sourceTemplateQuestionId: null,
        text: "Required rating",
        type: "RATING",
        required: true,
        weight: 1,
        order: 0,
        createdAt: "",
        answers: [],
      },
    ];
    expect(missingRequiredQuestions(questions, "u1")).toHaveLength(1);
  });

  it("centralizes labels and keeps manual STT provider as default", () => {
    expect(INTERVIEW_STATUS_LABELS.IN_PROGRESS).toBe("En curso");
    expect(TRANSCRIPT_KIND_LABELS.UNCLASSIFIED).toBe("Sin clasificar");
    const provider = getDefaultSpeechProvider();
    expect(provider).toBeInstanceOf(ManualTranscriptionProvider);
    expect(provider.isSupported()).toBe(true);
    expect(AUTOMATIC_TRANSCRIPTION_UNAVAILABLE_MESSAGE).toMatch(
      /no disponible/i,
    );
  });

  it("does not expose audio upload API surface", () => {
    expect(Object.keys(interviewsApi)).not.toContain("uploadAudio");
    expect(Object.keys(interviewsApi)).not.toContain("transcribeAudio");
  });
});
