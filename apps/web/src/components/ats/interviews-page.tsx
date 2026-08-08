"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  emptyInterviewForm,
  InterviewForm,
  toCreateInterviewPayload,
  type InterviewFormValues,
} from "@/components/ats/interview-form";
import { EntityEditorShell } from "@/components/organization/entity-editor-shell";
import { FormSelect } from "@/components/organization/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCompanyId } from "@/hooks/use-company-id";
import { atsApi, atsKeys } from "@/lib/api/ats";
import { getErrorMessage } from "@/lib/api/errors";
import { interviewKeys, interviewsApi } from "@/lib/api/interviews";
import { organizationApi, orgKeys } from "@/lib/api/organization";
import {
  canScheduleInterviewForStage,
  formatDate,
  formatEmployeeName,
  INTERVIEW_STATUS_LABELS,
  INTERVIEW_TYPE_LABELS,
  interviewStatusVariant,
} from "@/lib/ats/labels";
import { notifyError, notifySuccess } from "@/lib/ui/notify";

/**
 * No hay GET tenant-wide de interviews. Esta pantalla lista por Application
 * seleccionada (o via ?applicationId=).
 */
export function InterviewsPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const applicationId = searchParams.get("applicationId") ?? "";

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyInterviewForm());
  const [formError, setFormError] = useState<string | null>(null);

  const applicationsQuery = useQuery({
    queryKey: atsKeys.applications(companyId, { page: 1, limit: 100 }),
    queryFn: () => atsApi.listApplications({ page: 1, limit: 100 }),
  });

  const applicationQuery = useQuery({
    queryKey: atsKeys.application(companyId, applicationId),
    queryFn: () => atsApi.getApplication(applicationId),
    enabled: Boolean(applicationId),
  });

  const interviewsQuery = useQuery({
    queryKey: interviewKeys.byApplication(companyId, applicationId),
    queryFn: () => interviewsApi.listByApplication(applicationId),
    enabled: Boolean(applicationId),
  });

  const employeesQuery = useQuery({
    queryKey: orgKeys.employees(companyId, {
      status: "ACTIVE",
      page: 1,
      limit: 100,
    }),
    queryFn: () =>
      organizationApi.listEmployees({
        status: "ACTIVE",
        page: 1,
        limit: 100,
      }),
    enabled: open,
  });

  const templatesQuery = useQuery({
    queryKey: interviewKeys.templates(companyId),
    queryFn: () => interviewsApi.listTemplates(),
    enabled: open,
  });

  const applicationOptions = useMemo(
    () =>
      (applicationsQuery.data?.items ?? []).map((app) => ({
        value: app.id,
        label: `${app.candidate ? `${app.candidate.firstName} ${app.candidate.lastName}` : app.candidateId} · ${app.vacancy?.title ?? app.vacancyId}`,
      })),
    [applicationsQuery.data],
  );

  const employeeOptions = useMemo(
    () =>
      (employeesQuery.data?.items ?? []).map((e) => ({
        value: e.id,
        label: `${e.firstName} ${e.lastName}`,
      })),
    [employeesQuery.data],
  );

  const templateOptions = useMemo(
    () =>
      (templatesQuery.data ?? [])
        .filter((t) => t.status === "ACTIVE")
        .map((t) => ({ value: t.id, label: t.name })),
    [templatesQuery.data],
  );

  function setApplication(nextId: string) {
    const sp = new URLSearchParams();
    if (nextId) sp.set("applicationId", nextId);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  const createMutation = useMutation({
    mutationFn: (values: InterviewFormValues) =>
      interviewsApi.createForApplication(
        applicationId,
        toCreateInterviewPayload(values),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: interviewKeys.all(companyId),
      });
      setOpen(false);
      setForm(emptyInterviewForm());
      setFormError(null);
      notifySuccess("Entrevista creada");
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, "No se pudo crear la entrevista."));
      notifyError(error, "No se pudo crear la entrevista.");
    },
  });

  const canCreate =
    applicationQuery.data &&
    canScheduleInterviewForStage(applicationQuery.data.stage);

  const items = interviewsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entrevistas"
        description="Las entrevistas se listan por proceso de selección (no hay listado global en la API)."
        actions={
          applicationId && canCreate ? (
            <Button
              type="button"
              onClick={() => {
                setForm(emptyInterviewForm());
                setFormError(null);
                setOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden />
              Programar entrevista
            </Button>
          ) : null
        }
      />

      <FormSelect
        id="iv-application"
        label="Proceso / aplicación"
        value={applicationId}
        onChange={setApplication}
        options={applicationOptions}
        allowEmpty
        emptyLabel="Seleccionar aplicación…"
        placeholder={
          applicationsQuery.isLoading ? "Cargando…" : "Seleccionar"
        }
      />

      {!applicationId ? (
        <EmptyState title="Selecciona una aplicación para ver sus entrevistas." />
      ) : null}

      {applicationId && interviewsQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : null}

      {interviewsQuery.isError ? (
        <ErrorState
          title="No se pudieron cargar las entrevistas"
          description={getErrorMessage(
            interviewsQuery.error,
            "Error al cargar.",
          )}
          onRetry={() => void interviewsQuery.refetch()}
        />
      ) : null}

      {applicationId && interviewsQuery.isSuccess && items.length === 0 ? (
        <EmptyState
          title="Aún no hay entrevistas en este proceso."
          action={
            canCreate ? (
              <Button type="button" onClick={() => setOpen(true)}>
                Programar entrevista
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Programada</TableHead>
                  <TableHead>Entrevistadores</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((interview) => (
                  <TableRow key={interview.id}>
                    <TableCell>
                      {INTERVIEW_TYPE_LABELS[interview.type]}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={interviewStatusVariant(interview.status)}
                      >
                        {INTERVIEW_STATUS_LABELS[interview.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatDate(interview.scheduledAt)}
                    </TableCell>
                    <TableCell>
                      {(interview.interviewers ?? [])
                        .map((i) => formatEmployeeName(i.employee))
                        .join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" asChild>
                        <Link
                          href={`/ats/interviews/${interview.id}`}
                          aria-label="Ver entrevista"
                        >
                          <Eye className="size-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {items.map((interview) => (
              <div
                key={interview.id}
                className="rounded-lg border border-border p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">
                    {INTERVIEW_TYPE_LABELS[interview.type]}
                  </p>
                  <Badge variant={interviewStatusVariant(interview.status)}>
                    {INTERVIEW_STATUS_LABELS[interview.status]}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDate(interview.scheduledAt)}
                </p>
                <Button className="mt-3" variant="outline" size="sm" asChild>
                  <Link href={`/ats/interviews/${interview.id}`}>Abrir</Link>
                </Button>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <EntityEditorShell
        open={open}
        onOpenChange={setOpen}
        title="Programar entrevista"
      >
        <InterviewForm
          values={form}
          onChange={setForm}
          onCancel={() => setOpen(false)}
          onSubmit={() => createMutation.mutate(form)}
          submitting={createMutation.isPending}
          error={formError}
          employees={employeeOptions}
          templates={templateOptions}
        />
      </EntityEditorShell>
    </div>
  );
}
