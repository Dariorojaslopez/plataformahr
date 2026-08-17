"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { FormSelect } from "@/components/organization/form-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyId } from "@/hooks/use-company-id";
import { atsApi, atsKeys } from "@/lib/api/ats";
import { getErrorMessage } from "@/lib/api/errors";
import { organizationApi, orgKeys } from "@/lib/api/organization";
import {
  COMPANY_ROLE_LABELS,
  VACANCY_APPROVER_TYPE_LABELS,
} from "@/lib/ats/labels";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type {
  UpdateVacancyApprovalWorkflowInput,
  VacancyApprovalWorkflow,
  VacancyApproverType,
} from "@/types/ats";

type DraftStep = {
  key: string;
  approverType: VacancyApproverType;
  label: string;
  specificEmployeeId: string;
  requiredRoleCode: string;
};

const APPROVER_TYPES: VacancyApproverType[] = [
  "MANAGER_OF_REQUESTER",
  "SPECIFIC_EMPLOYEE",
  "ROLE",
];

function emptyStep(): DraftStep {
  return {
    key: `step-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    approverType: "MANAGER_OF_REQUESTER",
    label: "",
    specificEmployeeId: "",
    requiredRoleCode: "",
  };
}

function toDraftSteps(workflow: VacancyApprovalWorkflow): DraftStep[] {
  return workflow.steps.map((step) => ({
    key: step.id,
    approverType: step.approverType,
    label: step.label ?? "",
    specificEmployeeId: step.specificEmployeeId ?? "",
    requiredRoleCode: step.requiredRoleCode ?? "",
  }));
}

export function VacancyApprovalSettingsPageClient() {
  const companyId = useCompanyId();
  const workflowQuery = useQuery({
    queryKey: atsKeys.vacancyApprovalWorkflow(companyId),
    queryFn: () => atsApi.getVacancyApprovalWorkflow(),
  });
  const employeesQuery = useQuery({
    queryKey: orgKeys.employees(companyId, { page: 1, limit: 100 }),
    queryFn: () => organizationApi.listEmployees({ page: 1, limit: 100 }),
  });

  if (workflowQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (workflowQuery.isError || !workflowQuery.data) {
    return (
      <ErrorState
        title="No se pudo cargar la configuración"
        description={getErrorMessage(
          workflowQuery.error,
          "Inténtalo de nuevo.",
        )}
        onRetry={() => void workflowQuery.refetch()}
      />
    );
  }

  return (
    <VacancyApprovalSettingsForm
      key={`${companyId}-${workflowQuery.dataUpdatedAt}`}
      companyId={companyId}
      workflow={workflowQuery.data}
      employeeOptions={(employeesQuery.data?.items ?? [])
        .filter((employee) => employee.userId)
        .map((employee) => ({
          value: employee.id,
          label: `${employee.firstName} ${employee.lastName}`.trim(),
        }))}
    />
  );
}

function VacancyApprovalSettingsForm({
  companyId,
  workflow,
  employeeOptions,
}: {
  companyId: string;
  workflow: VacancyApprovalWorkflow;
  employeeOptions: Array<{ value: string; label: string }>;
}) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(workflow.enabled);
  const [steps, setSteps] = useState<DraftStep[]>(() => toDraftSteps(workflow));
  const [formError, setFormError] = useState<string | null>(null);

  const roleOptions = useMemo(
    () =>
      workflow.allowedRoles.map((role) => ({
        value: role.code,
        label: COMPANY_ROLE_LABELS[role.code] ?? role.name,
      })),
    [workflow.allowedRoles],
  );

  const saveMutation = useMutation({
    mutationFn: (body: UpdateVacancyApprovalWorkflowInput) =>
      atsApi.updateVacancyApprovalWorkflow(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: atsKeys.vacancyApprovalWorkflow(companyId),
      });
      setFormError(null);
      notifySuccess("Flujo de aprobación guardado");
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, "No se pudo guardar el flujo."));
      notifyError(error, "No se pudo guardar el flujo.");
    },
  });

  function moveStep(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= steps.length) return;
    const copy = [...steps];
    const [removed] = copy.splice(index, 1);
    copy.splice(next, 0, removed);
    setSteps(copy);
  }

  function updateStep(index: number, patch: Partial<DraftStep>) {
    setSteps((current) =>
      current.map((step, i) => (i === index ? { ...step, ...patch } : step)),
    );
  }

  function save() {
    saveMutation.mutate({
      enabled,
      steps: steps.map((step) => ({
        approverType: step.approverType,
        label: step.label.trim() || null,
        specificEmployeeId:
          step.approverType === "SPECIFIC_EMPLOYEE"
            ? step.specificEmployeeId || undefined
            : undefined,
        requiredRoleCode:
          step.approverType === "ROLE"
            ? step.requiredRoleCode || undefined
            : undefined,
      })),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aprobación de solicitudes"
        description="Define los pasos secuenciales para aprobar solicitudes de vacante en esta compañía. Las solicitudes ya enviadas conservan el flujo con el que se enviaron."
      />

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={enabled}
          onCheckedChange={(checked) => setEnabled(checked === true)}
        />
        Activar flujo configurable
      </label>
      <p className="text-sm text-muted-foreground">
        Si está desactivado, se mantiene el flujo actual: líder directo, luego
        administrador de compañía y, si se marca en la solicitud, gerencia
        general.
      </p>

      <div className="space-y-3">
        {steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay pasos. Agrega al menos uno antes de activar el flujo.
          </p>
        ) : null}
        {steps.map((step, index) => (
          <div
            key={step.key}
            className="space-y-3 rounded-lg border border-border p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Paso {index + 1}</p>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Subir paso"
                  disabled={index === 0}
                  onClick={() => moveStep(index, -1)}
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Bajar paso"
                  disabled={index === steps.length - 1}
                  onClick={() => moveStep(index, 1)}
                >
                  <ChevronDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Eliminar paso"
                  onClick={() =>
                    setSteps((current) => current.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
            <FormSelect
              id={`wf-type-${step.key}`}
              label="Tipo de aprobador"
              value={step.approverType}
              onChange={(approverType) =>
                updateStep(index, {
                  approverType: approverType as VacancyApproverType,
                  specificEmployeeId: "",
                  requiredRoleCode: "",
                })
              }
              options={APPROVER_TYPES.map((type) => ({
                value: type,
                label: VACANCY_APPROVER_TYPE_LABELS[type],
              }))}
            />
            {step.approverType === "SPECIFIC_EMPLOYEE" ? (
              <FormSelect
                id={`wf-emp-${step.key}`}
                label="Colaborador"
                required
                value={step.specificEmployeeId}
                onChange={(specificEmployeeId) =>
                  updateStep(index, { specificEmployeeId })
                }
                options={employeeOptions}
              />
            ) : null}
            {step.approverType === "ROLE" ? (
              <FormSelect
                id={`wf-role-${step.key}`}
                label="Rol"
                required
                value={step.requiredRoleCode}
                onChange={(requiredRoleCode) =>
                  updateStep(index, { requiredRoleCode })
                }
                options={roleOptions}
              />
            ) : null}
            <div className="space-y-2">
              <Label htmlFor={`wf-label-${step.key}`}>Etiqueta (opcional)</Label>
              <Input
                id={`wf-label-${step.key}`}
                value={step.label}
                onChange={(event) =>
                  updateStep(index, { label: event.target.value })
                }
                maxLength={80}
                placeholder={VACANCY_APPROVER_TYPE_LABELS[step.approverType]}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setSteps((current) => [...current, emptyStep()])}
        >
          <Plus className="size-4" aria-hidden />
          Agregar paso
        </Button>
        <Button type="button" disabled={saveMutation.isPending} onClick={save}>
          Guardar
        </Button>
      </div>
      {formError ? (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}
    </div>
  );
}
