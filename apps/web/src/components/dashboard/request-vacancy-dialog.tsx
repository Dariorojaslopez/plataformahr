"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  emptyVacancyRequestForm,
  toCreateVacancyRequestPayload,
  VacancyRequestForm,
  type VacancyRequestFormValues,
} from "@/components/ats/vacancy-request-form";
import { EntityEditorShell } from "@/components/organization/entity-editor-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyId } from "@/hooks/use-company-id";
import { atsApi, atsKeys } from "@/lib/api/ats";
import { organizationApi, orgKeys } from "@/lib/api/organization";
import {
  describeVacancyRequesterField,
  validateRequesterSelection,
  vacancyRequestSaveError,
} from "@/lib/ats/vacancy-requester";
import { workflowToLockedApprovalRows } from "@/lib/ats/approval-plan";
import { notifyError, notifySuccess } from "@/lib/ui/notify";

type RequestVacancyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkedEmployeeExists: boolean;
};

export function RequestVacancyDialog({
  open,
  onOpenChange,
  linkedEmployeeExists,
}: RequestVacancyDialogProps) {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyVacancyRequestForm());
  const [formError, setFormError] = useState<string | null>(null);

  const positionsQuery = useQuery({
    queryKey: orgKeys.positions(companyId),
    queryFn: () => organizationApi.listPositions(),
    enabled: open,
  });
  const areasQuery = useQuery({
    queryKey: orgKeys.areas(companyId),
    queryFn: () => organizationApi.listAreas(),
    enabled: open,
  });
  const levelsQuery = useQuery({
    queryKey: orgKeys.jobLevels(companyId),
    queryFn: () => organizationApi.listJobLevels(),
    enabled: open,
  });
  const workflowQuery = useQuery({
    queryKey: atsKeys.vacancyApprovalWorkflow(companyId),
    queryFn: () => atsApi.getVacancyApprovalWorkflow(),
    enabled: open,
  });

  const seededRef = useRef(false);
  useEffect(() => {
    if (!open) {
      seededRef.current = false;
      return;
    }
    if (seededRef.current || workflowQuery.isLoading) return;
    seededRef.current = true;
    setForm({
      ...emptyVacancyRequestForm(),
      approvalSteps: workflowToLockedApprovalRows(workflowQuery.data),
    });
  }, [open, workflowQuery.isLoading, workflowQuery.data]);

  const positionOptions = useMemo(
    () =>
      (positionsQuery.data ?? []).map((position) => ({
        value: position.id,
        label: position.name,
      })),
    [positionsQuery.data],
  );
  const areaOptions = useMemo(
    () =>
      (areasQuery.data ?? []).map((area) => ({
        value: area.id,
        label: area.name,
      })),
    [areasQuery.data],
  );
  const levelOptions = useMemo(
    () =>
      (levelsQuery.data ?? []).map((level) => ({
        value: level.id,
        label: level.name,
      })),
    [levelsQuery.data],
  );

  const catalogsLoading =
    positionsQuery.isLoading ||
    areasQuery.isLoading ||
    levelsQuery.isLoading ||
    workflowQuery.isLoading;
  const catalogsError =
    positionsQuery.error ||
    areasQuery.error ||
    levelsQuery.error ||
    workflowQuery.error;

  const saveMutation = useMutation({
    mutationFn: (values: VacancyRequestFormValues) =>
      atsApi.createVacancyRequest(toCreateVacancyRequestPayload(values)),
    onSuccess: async () => {
      notifySuccess("Solicitud creada");
      await queryClient.invalidateQueries({
        queryKey: atsKeys.all(companyId),
      });
      setForm(emptyVacancyRequestForm());
      setFormError(null);
      onOpenChange(false);
    },
    onError: (error) => {
      setFormError(vacancyRequestSaveError(error));
      notifyError(error, "No se pudo crear la solicitud.");
    },
  });

  function handleOpenChange(next: boolean) {
    if (!next) {
      setForm(emptyVacancyRequestForm());
      setFormError(null);
    }
    onOpenChange(next);
  }

  function submitForm() {
    const requesterError = validateRequesterSelection(
      form.requestedByEmployeeId,
      describeVacancyRequesterField({
        linkedEmployeeExists,
        canProxyRequester: false,
      }),
    );
    if (requesterError) {
      setFormError(requesterError);
      return;
    }
    setFormError(null);
    saveMutation.mutate(form);
  }

  return (
    <EntityEditorShell
      open={open}
      onOpenChange={handleOpenChange}
      title="Solicitar proceso de selección"
    >
      {catalogsLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : catalogsError ? (
        <p className="text-sm text-destructive" role="alert">
          No se pudieron cargar los datos para la solicitud.
        </p>
      ) : (
        <VacancyRequestForm
          values={form}
          onChange={setForm}
          onSubmit={submitForm}
          onCancel={() => handleOpenChange(false)}
          submitting={saveMutation.isPending}
          error={formError}
          positions={positionOptions}
          areas={areaOptions}
          jobLevels={levelOptions}
          employees={[]}
          linkedEmployeeExists={linkedEmployeeExists}
          canProxyRequester={false}
          submitLabel="Crear solicitud"
        />
      )}
    </EntityEditorShell>
  );
}
