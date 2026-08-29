import type { ApplicationStage } from "@/types/ats";
import type { PendingInterview } from "@/types/interviews";
import { kanbanColumnForStage, KANBAN_COLUMNS } from "@/lib/ats/pipeline-kanban";

export type PendingInterviewGroup = {
  vacancyId: string;
  vacancyTitle: string;
  templateId: string | null;
  interviews: PendingInterview[];
};

export function groupPendingInterviewsByVacancy(
  items: PendingInterview[],
): PendingInterviewGroup[] {
  const groups = new Map<string, PendingInterviewGroup>();
  for (const interview of items) {
    const vacancyId = interview.application?.vacancy?.id ?? "sin-proceso";
    const existing = groups.get(vacancyId);
    if (existing) {
      existing.interviews.push(interview);
      continue;
    }
    groups.set(vacancyId, {
      vacancyId,
      vacancyTitle: interview.application?.vacancy?.title ?? "Sin proceso",
      templateId: interview.application?.vacancy?.interviewFormTemplateId ?? null,
      interviews: [interview],
    });
  }
  return [...groups.values()].sort((a, b) =>
    a.vacancyTitle.localeCompare(b.vacancyTitle, "es"),
  );
}

export function pendingInterviewPhaseLabel(stage: string | undefined): string {
  if (!stage) return "—";
  const columnId = kanbanColumnForStage(stage as ApplicationStage);
  return (
    KANBAN_COLUMNS.find((column) => column.id === columnId)?.label ?? stage
  );
}

export function pendingCandidateName(item: PendingInterview): string {
  const candidate = item.application?.candidate;
  if (!candidate) return "Candidato";
  return `${candidate.firstName} ${candidate.lastName}`.trim();
}
