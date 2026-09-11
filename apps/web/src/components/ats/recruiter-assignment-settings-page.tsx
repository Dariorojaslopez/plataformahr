"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { FormSelect } from "@/components/organization/form-select";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyId } from "@/hooks/use-company-id";
import { atsApi, atsKeys } from "@/lib/api/ats";
import { getErrorMessage } from "@/lib/api/errors";
import { homeKeys } from "@/lib/api/home";
import { formatEmployeeName, VACANCY_STATUS_LABELS } from "@/lib/ats/labels";
import { approvedActiveProcessesForRecruiterAssignment } from "@/lib/ats/vacancies-view";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type { VacancyStatus } from "@/types/ats";

export function RecruiterAssignmentSettingsPageClient() {
  const companyId = useCompanyId();
  const processesQuery = useQuery({
    queryKey: atsKeys.activeProcesses(companyId),
    queryFn: () => atsApi.listActiveProcesses(),
  });

  if (processesQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (processesQuery.isError) {
    return (
      <ErrorState
        title="No se pudieron cargar los procesos"
        description={getErrorMessage(
          processesQuery.error,
          "Inténtalo de nuevo.",
        )}
        onRetry={() => void processesQuery.refetch()}
      />
    );
  }

  return (
    <RecruiterAssignmentForm
      companyId={companyId}
      processes={approvedActiveProcessesForRecruiterAssignment(
        processesQuery.data?.items ?? [],
      )}
    />
  );
}

function RecruiterAssignmentForm({
  companyId,
  processes,
}: {
  companyId: string;
  processes: Array<{
    title: string;
    vacancyId: string;
    vacancyStatus: VacancyStatus | null;
  }>;
}) {
  const queryClient = useQueryClient();
  const [vacancyId, setVacancyId] = useState("");
  const [recruiterId, setRecruiterId] = useState("");

  const vacancyQuery = useQuery({
    queryKey: atsKeys.vacancy(companyId, vacancyId),
    queryFn: () => atsApi.getVacancy(vacancyId),
    enabled: Boolean(vacancyId),
  });
  const recruitersQuery = useQuery({
    queryKey: atsKeys.recruiters(companyId, "RECRUITER"),
    queryFn: () => atsApi.listRecruiters({ roleCode: "RECRUITER" }),
    enabled: Boolean(vacancyId),
  });

  useEffect(() => {
    if (!vacancyId) {
      setRecruiterId("");
      return;
    }
    setRecruiterId(vacancyQuery.data?.assignedRecruiterEmployeeId ?? "");
  }, [vacancyId, vacancyQuery.data?.assignedRecruiterEmployeeId]);

  const processOptions = useMemo(
    () =>
      processes.map((item) => ({
        value: item.vacancyId,
        label:
          item.vacancyStatus && item.vacancyStatus !== "OPEN"
            ? `${item.title} (${VACANCY_STATUS_LABELS[item.vacancyStatus]})`
            : item.title,
      })),
    [processes],
  );

  const recruiterOptions = useMemo(() => {
    const recruiters = recruitersQuery.data ?? [];
    const current = vacancyQuery.data?.assignedRecruiter;
    const hasCurrent = current
      ? recruiters.some((item) => item.id === current.id)
      : true;
    const items = hasCurrent || !current ? recruiters : [current, ...recruiters];
    return items.map((employee) => ({
      value: employee.id,
      label: formatEmployeeName(employee),
    }));
  }, [recruitersQuery.data, vacancyQuery.data?.assignedRecruiter]);

  const saveMutation = useMutation({
    mutationFn: () =>
      atsApi.updateVacancy(vacancyId, {
        assignedRecruiterEmployeeId: recruiterId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: atsKeys.all(companyId) });
      await queryClient.invalidateQueries({ queryKey: homeKeys.feed(companyId) });
      notifySuccess("Reclutador asignado. El proceso queda en su bandeja.");
    },
    onError: (error) =>
      notifyError(error, "No se pudo asignar el reclutador."),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Asignación de reclutador</h2>
        <p className="text-sm text-muted-foreground">
          Elige un proceso de selección ya aprobado y el reclutador que lo
          atenderá. Solo esa persona lo verá en su bandeja de vacantes.
        </p>
      </div>

      {processes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay procesos activos con la solicitud ya aprobada.
        </p>
      ) : (
        <div className="grid max-w-xl gap-4">
          <FormSelect
            id="recruiter-assignment-process"
            label="Proceso de selección"
            required
            placeholder="Seleccionar proceso"
            value={vacancyId}
            onChange={setVacancyId}
            options={processOptions}
          />
          {vacancyId ? (
            <FormSelect
              id="recruiter-assignment-recruiter"
              label="Reclutador"
              required
              placeholder="Seleccionar reclutador"
              value={recruiterId}
              onChange={setRecruiterId}
              options={recruiterOptions}
              disabled={vacancyQuery.isLoading || recruitersQuery.isLoading}
              hint={
                recruitersQuery.isFetched && recruiterOptions.length === 0
                  ? "No hay colaboradores con rol Reclutador. Asígnale ese rol en la ficha del colaborador."
                  : undefined
              }
            />
          ) : null}
        </div>
      )}

      <Button
        type="button"
        disabled={
          !vacancyId ||
          !recruiterId ||
          saveMutation.isPending ||
          vacancyQuery.isFetching
        }
        onClick={() => saveMutation.mutate()}
      >
        {saveMutation.isPending ? "Guardando…" : "Guardar"}
      </Button>
    </div>
  );
}
