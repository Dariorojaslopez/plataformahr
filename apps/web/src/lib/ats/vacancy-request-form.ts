import {
  DEFAULT_VACANCY_HIRING_SLA_DAYS,
  minExpectedHiringDate,
  toDateOnlyIso,
} from "@/lib/ats/vacancy-request-sla";
import type {
  CreateVacancyRequestInput,
  UpdateVacancyRequestInput,
  VacancyApprovalWorkflow,
  VacancyRequest,
  VacancyRequestMotive,
} from "@/types/ats";
import { requestPlanToApprovalRows } from "@/lib/ats/approval-plan";
import {
  occupantLabel,
  type CargoOccupantRow,
  type OccupantOption,
} from "@/lib/ats/position-occupant";

export type VacancyRequestFormValues = {
  motive: VacancyRequestMotive;
  requestedByEmployeeId: string;
  existingPositionId: string;
  requestedPositionName: string;
  requestedAreaId: string;
  requestedJobLevelId: string;
  replacedEmployeeId: string;
  requestedHeadcount: string;
  expectedHiringDate: string;
  justification: string;
  approvalSteps: CargoOccupantRow[];
};

export function emptyVacancyRequestForm(
  slaDays: number = DEFAULT_VACANCY_HIRING_SLA_DAYS,
): VacancyRequestFormValues {
  return {
    motive: "REPLACEMENT_RESIGNATION",
    requestedByEmployeeId: "",
    existingPositionId: "",
    requestedPositionName: "",
    requestedAreaId: "",
    requestedJobLevelId: "",
    replacedEmployeeId: "",
    requestedHeadcount: "1",
    expectedHiringDate: toDateOnlyIso(minExpectedHiringDate(slaDays)),
    justification: "",
    approvalSteps: [],
  };
}

export function vacancyRequestToForm(
  request: VacancyRequest,
  workflow?: VacancyApprovalWorkflow,
): VacancyRequestFormValues {
  return {
    motive: request.motive,
    requestedByEmployeeId: request.requestedByEmployeeId,
    existingPositionId: request.existingPositionId ?? "",
    requestedPositionName: request.requestedPositionName ?? "",
    requestedAreaId: request.requestedAreaId ?? "",
    requestedJobLevelId: request.requestedJobLevelId ?? "",
    replacedEmployeeId: request.replacedEmployeeId ?? "",
    requestedHeadcount: String(request.requestedHeadcount),
    expectedHiringDate: request.expectedHiringDate.slice(0, 10),
    justification: request.justification,
    approvalSteps: requestPlanToApprovalRows(request, workflow),
  };
}

export function isReplacementMotive(motive: VacancyRequestMotive): boolean {
  return motive !== "NEW_POSITION";
}

export const VACANT_SLOT_PREFIX = "vacant:";

export function isVacantSlotValue(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith(VACANT_SLOT_PREFIX));
}

export function vacantSlotCount(
  headcount: number | undefined,
  occupantCount: number,
): number {
  if (headcount == null) return 0;
  return Math.max(0, headcount - occupantCount);
}

export function replacementCoverOptions(
  occupants: OccupantOption[],
  headcount: number | undefined,
): { value: string; label: string }[] {
  const vacant = vacantSlotCount(headcount, occupants.length);
  const people = occupants.map((occupant) => ({
    value: occupant.id,
    label: occupantLabel(occupant),
  }));
  const slots = Array.from({ length: vacant }, (_, index) => ({
    value: `${VACANT_SLOT_PREFIX}${index}`,
    label: vacant === 1 ? "Posición vacante" : `Posición vacante ${index + 1}`,
  }));
  return [...people, ...slots];
}

export function replacedEmployeeIdForPayload(
  value: string,
): string | undefined {
  if (!value || isVacantSlotValue(value)) return undefined;
  return value;
}

export function justificationRequired(options: {
  motive: VacancyRequestMotive;
  requestedHeadcount: number;
  positionHeadcount?: number | null;
}): boolean {
  if (options.motive === "NEW_POSITION") return true;
  if (options.positionHeadcount == null) return false;
  return options.requestedHeadcount > options.positionHeadcount;
}

export function toCreateVacancyRequestPayload(
  values: VacancyRequestFormValues,
): CreateVacancyRequestInput {
  const headcount = Number(values.requestedHeadcount);
  const base: CreateVacancyRequestInput = {
    motive: values.motive,
    requestedHeadcount: headcount,
    expectedHiringDate: values.expectedHiringDate,
    justification: values.justification.trim(),
  };
  if (values.requestedByEmployeeId) {
    base.requestedByEmployeeId = values.requestedByEmployeeId;
  }
  if (values.motive === "NEW_POSITION") {
    base.requestedPositionName = values.requestedPositionName.trim();
    base.requestedAreaId = values.requestedAreaId;
    if (values.requestedJobLevelId) {
      base.requestedJobLevelId = values.requestedJobLevelId;
    }
  } else {
    base.existingPositionId = values.existingPositionId;
    const replaced = replacedEmployeeIdForPayload(values.replacedEmployeeId);
    if (replaced) {
      base.replacedEmployeeId = replaced;
    }
  }
  return base;
}

export function toUpdateVacancyRequestPayload(
  values: VacancyRequestFormValues,
): UpdateVacancyRequestInput {
  const created = toCreateVacancyRequestPayload(values);
  if (values.motive === "NEW_POSITION") {
    return {
      ...created,
      existingPositionId: null,
      replacedEmployeeId: null,
      requestedJobLevelId: values.requestedJobLevelId || null,
    };
  }
  return {
    ...created,
    requestedPositionName: null,
    requestedAreaId: null,
    requestedJobLevelId: null,
    replacedEmployeeId:
      replacedEmployeeIdForPayload(values.replacedEmployeeId) ?? null,
  };
}
