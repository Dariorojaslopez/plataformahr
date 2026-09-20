import {
  INTERVIEW_STATUS_LABELS,
  INTERVIEW_TYPE_LABELS,
} from "@/lib/ats/labels";
import type { Candidate, CandidateListInterview } from "@/types/ats";
import type { InterviewStatus } from "@/types/interviews";

export type CandidateInterviewSummary = {
  id: string;
  href: string;
  title: string;
  status: InterviewStatus;
  statusLabel: string;
  scheduledAt: string | null;
  interviewers: string;
};

export function candidateInterviewSummaries(
  candidate: Pick<Candidate, "applications">,
): CandidateInterviewSummary[] {
  const applications = candidate.applications ?? [];
  const items: CandidateInterviewSummary[] = [];
  for (const application of applications) {
    const suffix =
      applications.length > 1 ? ` · ${application.vacancyTitle}` : "";
    for (const interview of application.interviews ?? []) {
      items.push(toSummary(interview, suffix));
    }
  }
  return items;
}

function toSummary(
  interview: CandidateListInterview,
  suffix: string,
): CandidateInterviewSummary {
  const typeLabel = INTERVIEW_TYPE_LABELS[interview.type] ?? interview.type;
  return {
    id: interview.id,
    href: `/ats/interviews/${interview.id}`,
    title: `${typeLabel}${suffix}`,
    status: interview.status,
    statusLabel: INTERVIEW_STATUS_LABELS[interview.status] ?? interview.status,
    scheduledAt: interview.scheduledAt,
    interviewers: interview.interviewers.join(", "),
  };
}
