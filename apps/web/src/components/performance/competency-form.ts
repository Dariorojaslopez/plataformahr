import type { OrganizationEntityStatus } from "@/types/organization";
import type {
  Competency,
  CreateCompetencyInput,
  UpdateCompetencyInput,
} from "@/types/performance";

export type CompetencyFormValues = {
  name: string;
  description: string;
  status: OrganizationEntityStatus;
  jobLevelId: string;
};

export const emptyCompetencyForm = (): CompetencyFormValues => ({
  name: "",
  description: "",
  status: "ACTIVE",
  jobLevelId: "",
});

export function competencyToForm(item: Competency): CompetencyFormValues {
  return {
    name: item.name,
    description: item.description ?? "",
    status: item.status,
    jobLevelId: item.jobLevels?.[0]?.id ?? "",
  };
}

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function toCreateCompetencyPayload(
  values: CompetencyFormValues,
): CreateCompetencyInput {
  return {
    name: values.name.trim(),
    description: optional(values.description),
    status: values.status,
    jobLevelId: values.jobLevelId,
  };
}

export function toUpdateCompetencyPayload(
  values: CompetencyFormValues,
): UpdateCompetencyInput {
  return {
    name: values.name.trim(),
    description: optional(values.description) ?? null,
    status: values.status,
    jobLevelId: values.jobLevelId || null,
  };
}

export function competencyJobLevelLabel(
  jobLevels: Array<{ name: string }> | undefined,
): string {
  if (!jobLevels?.length) return "—";
  return jobLevels.map((level) => level.name).join(", ");
}
