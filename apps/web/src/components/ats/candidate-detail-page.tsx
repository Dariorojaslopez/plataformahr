"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  CandidateForm,
  candidateToForm,
  emptyCandidateForm,
  toUpdateCandidatePayload,
} from "@/components/ats/candidate-form";
import { EntityEditorShell } from "@/components/organization/entity-editor-shell";
import { FormSelect } from "@/components/organization/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ApiError, getErrorMessage } from "@/lib/api/errors";
import {
  APPLICATION_STAGE_LABELS,
  APPLICATION_STATUS_LABELS,
  applicationStageVariant,
  CANDIDATE_STATUS_LABELS,
  candidateStatusVariant,
  formatDate,
} from "@/lib/ats/labels";

export function CandidateDetailPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState(emptyCandidateForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [vacancyId, setVacancyId] = useState("");
  const [applyError, setApplyError] = useState<string | null>(null);

  const candidateQuery = useQuery({
    queryKey: atsKeys.candidate(companyId, id),
    queryFn: () => atsApi.getCandidate(id),
  });

  const applicationsQuery = useQuery({
    queryKey: atsKeys.applications(companyId, { candidateId: id, limit: 50 }),
    queryFn: () =>
      atsApi.listApplications({ candidateId: id, page: 1, limit: 50 }),
  });

  const openVacanciesQuery = useQuery({
    queryKey: atsKeys.vacancies(companyId, { status: "OPEN", limit: 100 }),
    queryFn: () => atsApi.listVacancies({ status: "OPEN", page: 1, limit: 100 }),
    enabled: applyOpen,
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      atsApi.updateCandidate(id, toUpdateCandidatePayload(form)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: atsKeys.all(companyId) });
      setEditOpen(false);
      setFormError(null);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setFormError(
          error.message ||
            "Ya existe un candidato con este email o documento.",
        );
        return;
      }
      setFormError(getErrorMessage(error, "No se pudo actualizar."));
    },
  });

  const applyMutation = useMutation({
    mutationFn: () =>
      atsApi.createApplicationForCandidate(id, { vacancyId }),
    onSuccess: async (application) => {
      await queryClient.invalidateQueries({ queryKey: atsKeys.all(companyId) });
      if (application.vacancyId) {
        await queryClient.invalidateQueries({
          queryKey: atsKeys.pipeline(companyId, application.vacancyId),
        });
      }
      setApplyOpen(false);
      setVacancyId("");
      setApplyError(null);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setApplyError("Este candidato ya participa en esta vacante.");
        return;
      }
      setApplyError(getErrorMessage(error, "No se pudo postular."));
    },
  });

  const vacancyOptions = useMemo(
    () =>
      (openVacanciesQuery.data?.items ?? []).map((v) => ({
        value: v.id,
        label: v.title,
      })),
    [openVacanciesQuery.data],
  );

  if (candidateQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (candidateQuery.isError || !candidateQuery.data) {
    return (
      <ErrorState
        title="Candidato no disponible"
        description={getErrorMessage(
          candidateQuery.error,
          "No se encontró el candidato.",
        )}
        onRetry={() => void candidateQuery.refetch()}
      />
    );
  }

  const candidate = candidateQuery.data;
  const applications = applicationsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${candidate.firstName} ${candidate.lastName}`}
        description={candidate.email}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setForm(candidateToForm(candidate));
                setFormError(null);
                setEditOpen(true);
              }}
            >
              Editar
            </Button>
            <Button
              type="button"
              onClick={() => {
                setApplyError(null);
                setVacancyId("");
                setApplyOpen(true);
              }}
            >
              Postular a vacante
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Estado">
          <Badge variant={candidateStatusVariant(candidate.status)}>
            {CANDIDATE_STATUS_LABELS[candidate.status]}
          </Badge>
        </Field>
        <Field label="Teléfono">{candidate.phone ?? "—"}</Field>
        <Field label="Documento">
          {[candidate.documentType, candidate.documentNumber]
            .filter(Boolean)
            .join(" ") || "—"}
        </Field>
        <Field label="País">{candidate.country ?? "—"}</Field>
        <Field label="Estado/Provincia">{candidate.state ?? "—"}</Field>
        <Field label="Ciudad">{candidate.city ?? "—"}</Field>
        <Field label="Fuente">{candidate.source ?? "—"}</Field>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Procesos de selección</h2>
        {applicationsQuery.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : null}
        {applicationsQuery.isError ? (
          <ErrorState
            title="No se pudieron cargar las aplicaciones"
            description={getErrorMessage(
              applicationsQuery.error,
              "Error al cargar.",
            )}
            onRetry={() => void applicationsQuery.refetch()}
          />
        ) : null}
        {applicationsQuery.isSuccess && applications.length === 0 ? (
          <EmptyState title="Sin procesos de selección." />
        ) : null}
        {applications.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vacante</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Aplicó</TableHead>
                <TableHead>Último cambio</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell>{app.vacancy?.title ?? app.vacancyId}</TableCell>
                  <TableCell>
                    <Badge variant={applicationStageVariant(app.stage)}>
                      {APPLICATION_STAGE_LABELS[app.stage]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {APPLICATION_STATUS_LABELS[app.status]}
                  </TableCell>
                  <TableCell>{formatDate(app.appliedAt)}</TableCell>
                  <TableCell>{formatDate(app.lastStageChangedAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/ats/applications/${app.id}`}>Ver</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </section>

      <EntityEditorShell
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Editar candidato"
      >
        <CandidateForm
          values={form}
          onChange={setForm}
          onCancel={() => setEditOpen(false)}
          onSubmit={() => updateMutation.mutate()}
          submitting={updateMutation.isPending}
          error={formError}
          allowStatus
          submitLabel="Guardar cambios"
        />
      </EntityEditorShell>

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Postular a vacante</DialogTitle>
          </DialogHeader>
          <FormSelect
            id="apply-vacancy"
            label="Vacante abierta"
            required
            value={vacancyId}
            onChange={setVacancyId}
            options={vacancyOptions}
            placeholder={
              openVacanciesQuery.isLoading
                ? "Cargando…"
                : "Seleccionar vacante"
            }
          />
          {applyError ? (
            <p className="text-sm text-destructive" role="alert">
              {applyError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setApplyOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!vacancyId || applyMutation.isPending}
              onClick={() => applyMutation.mutate()}
            >
              Postular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="text-sm">{children}</div>
    </div>
  );
}
