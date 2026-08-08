import type {
  InterviewAnswer,
  InterviewQuestion,
  InterviewQuestionType,
  UpsertInterviewAnswerInput,
} from "@/types/interviews";

export type AnswerDraft = {
  answerText: string;
  rating: string;
  yesNo: "" | "true" | "false";
};

export function emptyAnswerDraft(): AnswerDraft {
  return { answerText: "", rating: "", yesNo: "" };
}

export function draftFromAnswer(answer: InterviewAnswer | undefined): AnswerDraft {
  if (!answer) return emptyAnswerDraft();
  return {
    answerText: answer.answerText ?? "",
    rating: answer.rating != null ? String(answer.rating) : "",
    yesNo:
      answer.yesNo === true ? "true" : answer.yesNo === false ? "false" : "",
  };
}

export function buildAnswerPayload(
  type: InterviewQuestionType,
  draft: AnswerDraft,
): UpsertInterviewAnswerInput {
  switch (type) {
    case "TEXT":
    case "TEXTAREA":
      return { answerText: draft.answerText.trim() };
    case "RATING": {
      const rating = Number(draft.rating);
      return { rating };
    }
    case "YES_NO":
      return { yesNo: draft.yesNo === "true" };
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

export function isAnswerEditableStatus(
  status: string,
): boolean {
  return status !== "COMPLETED" && status !== "CANCELLED";
}

export function findMyAnswer(
  question: InterviewQuestion,
  userId: string | undefined,
): InterviewAnswer | undefined {
  if (!userId) return undefined;
  return (question.answers ?? []).find((a) => a.answeredByUserId === userId);
}

export function otherAnswers(
  question: InterviewQuestion,
  userId: string | undefined,
): InterviewAnswer[] {
  return (question.answers ?? []).filter(
    (a) => !userId || a.answeredByUserId !== userId,
  );
}

export function missingRequiredQuestions(
  questions: InterviewQuestion[],
  userId: string | undefined,
): InterviewQuestion[] {
  return questions.filter((q) => {
    if (!q.required) return false;
    const mine = findMyAnswer(q, userId);
    if (!mine) return true;
    switch (q.type) {
      case "TEXT":
      case "TEXTAREA":
        return !mine.answerText?.trim();
      case "RATING":
        return mine.rating == null;
      case "YES_NO":
        return mine.yesNo == null;
      default:
        return true;
    }
  });
}
