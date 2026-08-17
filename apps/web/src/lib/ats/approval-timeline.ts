import type { ApprovalStatus, VacancyApproval } from "@/types/ats";
import {
  APPROVAL_STATUS_LABELS,
  APPROVAL_STEP_LABELS,
  COMPANY_ROLE_LABELS,
  formatEmployeeName,
} from "@/lib/ats/labels";

export type ApprovalTimelineTone =
  | "approved"
  | "rejected"
  | "skipped"
  | "current"
  | "waiting";

export type ApprovalTimelineItem = {
  id: string;
  title: string;
  actor: string | null;
  status: ApprovalStatus;
  statusLabel: string;
  tone: ApprovalTimelineTone;
  marker: "✓" | "✕" | "●" | "○" | "–";
  comment: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
};

export function approvalStepTitle(
  step: Pick<VacancyApproval, "label" | "step" | "requiredRoleCode">,
): string {
  const custom = step.label?.trim();
  if (custom) return custom;
  if (step.step === "ROLE" && step.requiredRoleCode) {
    return COMPANY_ROLE_LABELS[step.requiredRoleCode] ?? step.requiredRoleCode;
  }
  return APPROVAL_STEP_LABELS[step.step] ?? step.step;
}

export function approvalActorName(
  step: Pick<
    VacancyApproval,
    "approverEmployee" | "requiredRoleCode" | "step"
  >,
): string | null {
  if (step.approverEmployee) {
    return formatEmployeeName(step.approverEmployee);
  }
  if (step.requiredRoleCode) {
    return (
      COMPANY_ROLE_LABELS[step.requiredRoleCode] ?? step.requiredRoleCode
    );
  }
  return null;
}

export function canShowVacancyDecisionActions(request: {
  status: string;
  currentUserCanDecide?: boolean;
}): boolean {
  return request.status === "PENDING_APPROVAL" && request.currentUserCanDecide === true;
}

export function buildApprovalTimeline(
  approvals: VacancyApproval[],
): ApprovalTimelineItem[] {
  const ordered = [...approvals].sort((a, b) => a.sequence - b.sequence);
  const currentSequence = ordered.find((step) => step.status === "PENDING")
    ?.sequence;
  return ordered.map((step) => {
    const tone = timelineTone(step.status, step.sequence, currentSequence);
    return {
      id: step.id,
      title: approvalStepTitle(step),
      actor: approvalActorName(step),
      status: step.status,
      statusLabel:
        tone === "waiting" ? "Esperando" : APPROVAL_STATUS_LABELS[step.status],
      tone,
      marker: timelineMarker(tone),
      comment: step.comment,
      decidedAt: step.decidedAt,
      decidedBy: step.decidedByUser
        ? formatEmployeeName(step.decidedByUser)
        : null,
    };
  });
}

function timelineTone(
  status: ApprovalStatus,
  sequence: number,
  currentSequence: number | undefined,
): ApprovalTimelineTone {
  if (status === "APPROVED") return "approved";
  if (status === "REJECTED") return "rejected";
  if (status === "SKIPPED") return "skipped";
  if (sequence === currentSequence) return "current";
  return "waiting";
}

function timelineMarker(tone: ApprovalTimelineTone): ApprovalTimelineItem["marker"] {
  switch (tone) {
    case "approved":
      return "✓";
    case "rejected":
      return "✕";
    case "current":
      return "●";
    case "waiting":
      return "○";
    default:
      return "–";
  }
}
