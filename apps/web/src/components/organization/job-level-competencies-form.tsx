"use client";

import { OrgStatusBadge } from "@/components/organization/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { JobLevelCompetencyItem } from "@/types/organization";

export function selectedCompetencyIds(
  assigned: JobLevelCompetencyItem[],
): string[] {
  return assigned.map((item) => item.id);
}

export function toReplaceCompetenciesPayload(selectedIds: string[]): {
  competencyIds: string[];
} {
  return { competencyIds: selectedIds };
}

type JobLevelCompetenciesFormProps = {
  catalog: JobLevelCompetencyItem[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
};

export function JobLevelCompetenciesForm({
  catalog,
  selectedIds,
  onChange,
}: JobLevelCompetenciesFormProps) {
  const selected = new Set(selectedIds);

  function toggle(id: string, checked: boolean) {
    if (checked) {
      onChange([...selectedIds, id]);
      return;
    }
    onChange(selectedIds.filter((current) => current !== id));
  }

  if (catalog.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay competencias en el catálogo. Puedes guardar este nivel sin
        competencias y asignarlas después.
      </p>
    );
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Competencias</legend>
      <p className="text-xs text-muted-foreground">
        Opcional. Una competencia puede pertenecer a varios niveles.
      </p>
      <ul className="space-y-2">
        {catalog.map((item) => {
          const checkboxId = `jl-comp-${item.id}`;
          return (
            <li key={item.id}>
              <label
                htmlFor={checkboxId}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3"
              >
                <Checkbox
                  id={checkboxId}
                  checked={selected.has(item.id)}
                  onCheckedChange={(value) =>
                    toggle(item.id, value === true)
                  }
                />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex items-center gap-2">
                    <Label htmlFor={checkboxId} className="cursor-pointer">
                      {item.name}
                    </Label>
                    <OrgStatusBadge status={item.status} />
                  </span>
                  {item.code ? (
                    <span className="block text-xs text-muted-foreground">
                      {item.code}
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
