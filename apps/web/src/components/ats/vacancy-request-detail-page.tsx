"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  emptyVacancyRequestForm,
  toUpdateVacancyRequestPayload,
  VacancyRequestForm,
  vacancyRequestToForm,
} from "@/components/ats/vacancy-request-form";
import { EntityEditorShell } from "@/components/organization/entity-editor-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCompanyId } from "@/hooks/use-company-id";
import { atsApi, atsKeys } from "@/lib/api/ats";
import { ApiError, getErrorMessage } from "@/lib/api/errors";
import { organizationApi, orgKeys } from "@/lib/api/organization";
import {
  APPROVAL_STATUS_LABELS,
  APPROVAL_STEP_LABELS,
  approvalStatusVariant,
  formatDate,
  formatEmployeeName,
  VACANCY_REQUEST_STATUS_LABELS,
  VACANCY_REQUEST_TYPE_LABELS,
  vacancyRequestStatusVariant,
} from "@/lib/ats/labels";

export function VacancyRequestDetailPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState(emptyVacancyRequestForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [approveComment, setApproveComment] = useState("");
  const [rejectComment, setRejectComment] = useState("");

  const detailQuery = useQuery({
    queryKey: atsKeys.vacancyRequest(companyId, id),
    queryFn: () => atsApi.getVacancyRequest(id),
  });

  const positionsQuery = useQuery({
    queryKey: orgKeys.positions(companyId),
    queryFn: () => organizationApi.listPositions(),
  });
  const areasQuery = useQuery({
    queryKey: orgKeys.areas(companyId),
    queryFn: () => organizationApi.listAreas(),
  });
  const levelsQuery = useQuery({
    queryKey: orgKeys.jobLevels(companyId),
    queryFn: () => organizationApi.listJobLevels(),
  });
  const employeesQuery = useQuery({
    queryKey: orgKeys.employees(companyId, { page: 1, limit: 100 }),
    queryFn: () => organizationApi.listEmployees({ page: 1, limit: 100 }),
  });

  const request = detailQuery.data;
  const approvals = useMemo(
    () =>
      [...(request?.approvals ?? [])].sort((a, b) => a.sequence - b.sequence),
    [request?.approvals],
  );

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: atsKeys.all(companyId) });
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      atsApi.updateVacancyRequest(id, toUpdateVacancyRequestPayload(form)),
    onSuccess: async () => {
      await invalidate();
      setEditOpen(false);
      setFormError(null);
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, "No se pudo actualizar."));
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => atsApi.submitVacancyRequest(id),
    onSuccess: async () => {
      await invalidate();
      setSubmitOpen(false);
      setActionError(null);
    },
    onError: (error) => {
      setActionError(getErrorMessage(error, "No se pudo enviar."));
      setSubmitOpen(false);
    },
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      atsApi.approveVacancyRequest(id, {
        comment: approveComment.trim() || undefined,
      }),
    onSuccess: async () => {
      await invalidate();
      setApproveOpen(false);
      setApproveComment("");
      setActionError(null);
    },
    onError: (error) => {
      setActionError(getErrorMessage(error, "No se pudo aprobar."));
      if (error instanceof ApiError && error.status === 403) {
        setApproveOpen(false);
      }
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      atsApi.rejectVacancyRequest(id, { comment: rejectComment.trim() }),
    onSuccess: async () => {
      await invalidate();
      setRejectOpen(false);
      setRejectComment("");
      setActionError(null);
    },
    onError: (error) => {
      setActionError(getErrorMessage(error, "No se pudo rechazar."));
    },
  });

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (detailQuery.isError || !request) {
    return (
      <ErrorState
        title="Solicitud no disponible"
        description={getErrorMessage(
          detailQuery.error,
          "No se encontró la solicitud.",
        )}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  const title =
    request.type === "EXISTING_POSITION"
      ? (request.existingPosition?.name ?? "Cargo existente")
      : (request.requestedPositionName ?? "Cargo nuevo");

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={`Solicitud · ${VACANCY_REQUEST_TYPE_LABELS[request.type]}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {request.status === "DRAFT" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setForm(vacancyRequestToForm(request));
                    setFormError(null);
                    setEditOpen(true);
                  }}
                >
                  Editar
                </Button>
                <Button type="button" onClick={() => setSubmitOpen(true)}>
                  Enviar a aprobación
                </Button>
              </>
            ) : null}
            {request.status === "PENDING_APPROVAL" ? (
              <>
                <Button type="button" onClick={() => setApproveOpen(true)}>
                  Aprobar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setRejectOpen(true)}
                >
                  Rechazar
                </Button>
              </>
            ) : null}
            {request.vacancy ? (
              <Button variant="secondary" asChild>
                <Link href={`/ats/vacancies/${request.vacancy.id}`}>
                  Ver vacante
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {actionError ? (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Info label="Estado">
          <Badge variant={vacancyRequestStatusVariant(request.status)}>
            {VACANCY_REQUEST_STATUS_LABELS[request.status]}
          </Badge>
        </Info>
        <Info label="Solicitante">
          {formatEmployeeName(request.requestedByEmployee)}
        </Info>
        <Info label="Headcount">{request.requestedHeadcount}</Info>
        <Info label="Área">
          {request.requestedArea?.name ??
            request.existingPosition?.name ??
            "—"}
        </Info>
        <Info label="Nivel">{request.requestedJobLevel?.name ?? "—"}</Info>
        <Info label="Creada">{formatDate(request.createdAt)}</Info>
        <Info label="Enviada">{formatDate(request.submittedAt)}</Info>
        <Info label="Decidida">{formatDate(request.decidedAt)}</Info>
        <Info label="Gerencia General">
          {request.generalManagerApprovalRequired ? "Requerida" : "No"}
        </Info>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Justificación</h2>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {request.justification}
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Flujo de aprobación</h2>
        {approvals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay pasos de aprobación. Envía la solicitud para iniciar el
            flujo.
          </p>
        ) : (
          <ol className="space-y-0">
            {approvals.map((step, index) => (
              <li key={step.id} className="relative flex gap-4 pb-8 last:pb-0">
                {index < approvals.length - 1 ? (
                  <span
                    className="absolute left-[0.7rem] top-8 h-[calc(100%-1.5rem)] w-px bg-border"
                    aria-hidden
                  />
                ) : null}
                <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-card text-xs">
                  {step.sequence}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">
                      {APPROVAL_STEP_LABELS[step.step]}
                    </p>
                    <Badge variant={approvalStatusVariant(step.status)}>
                      {APPROVAL_STATUS_LABELS[step.status]}
                    </Badge>
                  </div>
                  {step.approverEmployeeId ? (
                    <p className="text-xs text-muted-foreground">
                      Approver employee: {step.approverEmployeeId}
                    </p>
                  ) : null}
                  {step.requiredRoleCode ? (
                    <p className="text-xs text-muted-foreground">
                      Rol requerido: {step.requiredRoleCode}
                    </p>
                  ) : null}
                  {step.decidedAt ? (
                    <p className="text-xs text-muted-foreground">
                      Decidido: {formatDate(step.decidedAt)}
                      {step.decidedByUserId
                        ? ` · userId ${step.decidedByUserId}`
                        : ""}
                    </p>
                  ) : null}
                  {step.comment ? (
                    <p className="text-sm">{step.comment}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <EntityEditorShell
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Editar solicitud"
      >
        <VacancyRequestForm
          values={form}
          onChange={setForm}
          onCancel={() => setEditOpen(false)}
          onSubmit={() => updateMutation.mutate()}
          submitting={updateMutation.isPending}
          error={formError}
          positions={(positionsQuery.data ?? []).map((p) => ({
            value: p.id,
            label: p.name,
          }))}
          areas={(areasQuery.data ?? []).map((a) => ({
            value: a.id,
            label: a.name,
          }))}
          jobLevels={(levelsQuery.data ?? []).map((l) => ({
            value: l.id,
            label: l.name,
          }))}
          employees={(employeesQuery.data?.items ?? []).map((e) => ({
            value: e.id,
            label: `${e.firstName} ${e.lastName}`,
          }))}
          submitLabel="Guardar cambios"
        />
      </EntityEditorShell>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar a aprobación</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            La solicitud pasará a estado En aprobación y se crearán los pasos
            del flujo.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSubmitOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
            >
              Confirmar envío
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprobar paso</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="approve-comment">Comentario (opcional)</Label>
            <Textarea
              id="approve-comment"
              value={approveComment}
              onChange={(e) => setApproveComment(e.target.value)}
              maxLength={1000}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setApproveOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={approveMutation.isPending}
              onClick={() => approveMutation.mutate()}
            >
              Aprobar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar solicitud</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-comment">Comentario *</Label>
            <Textarea
              id="reject-comment"
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              required
              maxLength={1000}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                rejectMutation.isPending || rejectComment.trim().length === 0
              }
              onClick={() => rejectMutation.mutate()}
            >
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({
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
