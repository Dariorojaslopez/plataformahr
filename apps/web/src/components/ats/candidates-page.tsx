"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  CandidateForm,
  candidateToForm,
  emptyCandidateForm,
  toCreateCandidatePayload,
  toUpdateCandidatePayload,
  type CandidateFormValues,
} from "@/components/ats/candidate-form";
import { EntityEditorShell } from "@/components/organization/entity-editor-shell";
import { FormSelect } from "@/components/organization/form-select";
import { PaginationControls } from "@/components/organization/pagination-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
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
import { hiringApi } from "@/lib/api/hiring";
import { offersApi } from "@/lib/api/offers";
import {
  candidateAvailableDocuments,
  type CandidateDownloadItem,
} from "@/lib/ats/candidate-documents";
import { candidateInterviewSummaries } from "@/lib/ats/candidate-interviews";
import {
  CANDIDATE_STATUS_LABELS,
  candidateStatusVariant,
  formatDate,
  interviewStatusVariant,
} from "@/lib/ats/labels";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type { Candidate, CandidateStatus, ListCandidatesParams } from "@/types/ats";

function useCandidateFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const params: ListCandidatesParams = {
    search: searchParams.get("search") ?? undefined,
    status: (searchParams.get("status") as CandidateStatus | null) ?? undefined,
    vacancyId: searchParams.get("vacancyId") ?? undefined,
    page: Number(searchParams.get("page") ?? "1") || 1,
    limit: 20,
  };
  function setParams(next: Partial<ListCandidatesParams>) {
    const merged = { ...params, ...next };
    const sp = new URLSearchParams();
    if (merged.search) sp.set("search", merged.search);
    if (merged.status) sp.set("status", merged.status);
    if (merged.vacancyId) sp.set("vacancyId", merged.vacancyId);
    if (merged.page && merged.page > 1) sp.set("page", String(merged.page));
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }
  return { params, setParams };
}

export function CandidatesPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const { params, setParams } = useCandidateFilters();
  const [searchInput, setSearchInput] = useState(params.search ?? "");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Candidate | null>(null);
  const [form, setForm] = useState(emptyCandidateForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Candidate | null>(null);

  const listQuery = useQuery({
    queryKey: atsKeys.candidates(companyId, params),
    queryFn: () => atsApi.listCandidates(params),
  });

  const vacanciesQuery = useQuery({
    queryKey: atsKeys.vacancies(companyId, { limit: 100 }),
    queryFn: () => atsApi.listVacancies({ page: 1, limit: 100 }),
  });

  const vacancyOptions = useMemo(
    () =>
      (vacanciesQuery.data?.items ?? []).map((vacancy) => ({
        value: vacancy.id,
        label: vacancy.title,
      })),
    [vacanciesQuery.data],
  );

  const saveMutation = useMutation({
    mutationFn: async (values: CandidateFormValues) => {
      if (editing) {
        return atsApi.updateCandidate(
          editing.id,
          toUpdateCandidatePayload(values),
        );
      }
      return atsApi.createCandidate(toCreateCandidatePayload(values));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: atsKeys.all(companyId) });
      setOpen(false);
      setEditing(null);
      setForm(emptyCandidateForm());
      setFormError(null);
      notifySuccess(editing ? "Candidato actualizado" : "Candidato creado");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setFormError(
          error.message ||
            "Ya existe un candidato con este email o documento.",
        );
        notifyError(
          error,
          "Ya existe un candidato con este email o documento.",
        );
        return;
      }
      setFormError(getErrorMessage(error, "No se pudo guardar el candidato."));
      notifyError(error, "No se pudo guardar el candidato.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => atsApi.deleteCandidate(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: atsKeys.all(companyId) });
      setDeleting(null);
      notifySuccess("Candidato eliminado");
    },
    onError: (error) => {
      notifyError(error, "No se pudo eliminar el candidato.");
    },
  });

  const items = listQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidatos"
        description="Talento en proceso de selección."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/ats/pipeline">Ver tablero Kanban</Link>
            </Button>
            <Button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm(emptyCandidateForm());
                setFormError(null);
                setOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden />
              Nuevo candidato
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <form
          className="flex min-w-[16rem] flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setParams({ search: searchInput.trim() || undefined, page: 1 });
          }}
        >
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar nombre, email o documento…"
            aria-label="Buscar candidatos"
          />
          <Button type="submit" variant="secondary" aria-label="Buscar">
            <Search className="size-4" />
          </Button>
        </form>
        <FormSelect
          id="cand-vacancy"
          label="Proceso de selección"
          className="w-full sm:w-64"
          value={params.vacancyId ?? ""}
          onChange={(vacancyId) =>
            setParams({
              vacancyId: vacancyId || undefined,
              page: 1,
            })
          }
          allowEmpty
          emptyLabel="Todos"
          options={vacancyOptions}
        />
        <FormSelect
          id="cand-status"
          label="Estado"
          className="w-full sm:w-48"
          value={params.status ?? ""}
          onChange={(status) =>
            setParams({
              status: (status || undefined) as CandidateStatus | undefined,
              page: 1,
            })
          }
          allowEmpty
          emptyLabel="Todos"
          options={Object.entries(CANDIDATE_STATUS_LABELS).map(
            ([value, label]) => ({ value, label }),
          )}
        />
      </div>

      {listQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : null}

      {listQuery.isError ? (
        <ErrorState
          title="No se pudieron cargar los candidatos"
          description={getErrorMessage(listQuery.error, "Error al cargar.")}
          onRetry={() => void listQuery.refetch()}
        />
      ) : null}

      {listQuery.isSuccess && items.length === 0 ? (
        <EmptyState
          title="Aún no hay candidatos registrados."
          action={
            <Button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm(emptyCandidateForm());
                setOpen(true);
              }}
            >
              Nuevo candidato
            </Button>
          }
        />
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead>Fuente</TableHead>
                  <TableHead>Proceso</TableHead>
                  <TableHead>Entrevistas</TableHead>
                  <TableHead>Documentos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((candidate) => (
                  <TableRow key={candidate.id}>
                    <TableCell className="font-medium">
                      {candidate.firstName} {candidate.lastName}
                    </TableCell>
                    <TableCell>{candidate.email}</TableCell>
                    <TableCell>{candidate.phone ?? "—"}</TableCell>
                    <TableCell>{candidate.city ?? "—"}</TableCell>
                    <TableCell>{candidate.source ?? "—"}</TableCell>
                    <TableCell>
                      <CandidateProcesses candidate={candidate} />
                    </TableCell>
                    <TableCell>
                      <CandidateInterviews candidate={candidate} />
                    </TableCell>
                    <TableCell>
                      <CandidateDocumentsMenu candidate={candidate} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={candidateStatusVariant(candidate.status)}>
                        {CANDIDATE_STATUS_LABELS[candidate.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" asChild>
                        <Link
                          href={`/ats/candidates/${candidate.id}`}
                          aria-label="Ver candidato"
                        >
                          <Eye className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Editar candidato"
                        onClick={() => {
                          setEditing(candidate);
                          setForm(candidateToForm(candidate));
                          setFormError(null);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      {candidate.status === "INACTIVE" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Borrar candidato"
                          onClick={() => setDeleting(candidate)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {items.map((candidate) => (
              <div
                key={candidate.id}
                className="rounded-lg border border-border p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {candidate.firstName} {candidate.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {candidate.email}
                    </p>
                  </div>
                  <Badge variant={candidateStatusVariant(candidate.status)}>
                    {CANDIDATE_STATUS_LABELS[candidate.status]}
                  </Badge>
                </div>
                <div className="mt-3 space-y-2">
                  <CandidateProcesses candidate={candidate} />
                  <CandidateInterviews candidate={candidate} />
                  <CandidateDocumentsMenu candidate={candidate} />
                </div>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/ats/candidates/${candidate.id}`}>Ver</Link>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditing(candidate);
                      setForm(candidateToForm(candidate));
                      setOpen(true);
                    }}
                  >
                    Editar
                  </Button>
                  {candidate.status === "INACTIVE" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleting(candidate)}
                    >
                      Borrar
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <PaginationControls
            page={listQuery.data?.page ?? 1}
            totalPages={listQuery.data?.totalPages ?? 1}
            total={listQuery.data?.total ?? 0}
            onPageChange={(page) => setParams({ page })}
          />
        </>
      ) : null}

      <EntityEditorShell
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Editar candidato" : "Nuevo candidato"}
      >
        <CandidateForm
          values={form}
          onChange={setForm}
          onCancel={() => setOpen(false)}
          onSubmit={() => saveMutation.mutate(form)}
          submitting={saveMutation.isPending}
          error={formError}
          allowStatus={Boolean(editing)}
          submitLabel={editing ? "Guardar cambios" : "Crear candidato"}
        />
      </EntityEditorShell>

      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Borrar candidato</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {deleting
                ? `Vas a borrar a ${deleting.firstName} ${deleting.lastName}. Solo se pueden borrar candidatos inactivos.`
                : null}
            </p>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleting(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending || !deleting}
              onClick={() => {
                if (deleting) deleteMutation.mutate(deleting.id);
              }}
            >
              {deleteMutation.isPending ? "Borrando…" : "Borrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CandidateProcesses({ candidate }: { candidate: Candidate }) {
  const applications = candidate.applications ?? [];
  if (applications.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <div className="flex max-w-xs flex-col gap-1">
      {applications.map((application) => (
        <Link
          key={application.id}
          href={`/ats/pipeline?vacancyId=${application.vacancyId}`}
          className="text-sm text-primary hover:underline"
        >
          {application.vacancyTitle}
        </Link>
      ))}
    </div>
  );
}

function CandidateInterviews({ candidate }: { candidate: Candidate }) {
  const interviews = candidateInterviewSummaries(candidate);
  if (interviews.length === 0) {
    return <span className="text-xs text-muted-foreground">Sin entrevistas</span>;
  }
  return (
    <div className="flex max-w-xs flex-col gap-2">
      {interviews.map((interview) => (
        <Link
          key={interview.id}
          href={interview.href}
          className="space-y-0.5 text-sm hover:underline"
        >
          <span className="flex flex-wrap items-center gap-1">
            <span className="font-medium text-foreground">{interview.title}</span>
            <Badge variant={interviewStatusVariant(interview.status)}>
              {interview.statusLabel}
            </Badge>
          </span>
          <span className="block text-xs text-muted-foreground">
            {[interview.scheduledAt ? formatDate(interview.scheduledAt) : null, interview.interviewers]
              .filter(Boolean)
              .join(" · ") || "Sin fecha"}
          </span>
        </Link>
      ))}
    </div>
  );
}

function CandidateDocumentsMenu({ candidate }: { candidate: Candidate }) {
  const documents = candidateAvailableDocuments(candidate);
  if (documents.length === 0) {
    return <span className="text-xs text-muted-foreground">Sin documentos</span>;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Download className="size-4" aria-hidden />
          Descargar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {documents.map((document) => (
          <DropdownMenuItem
            key={document.key}
            onSelect={() => void downloadCandidateDocument(document)}
          >
            {document.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function downloadCandidateDocument(item: CandidateDownloadItem) {
  try {
    if (item.kind === "cv") {
      const file = await atsApi.downloadCandidateCv(item.candidateId);
      triggerBlobDownload(file.blob, file.filename || "hoja-de-vida");
      return;
    }
    if (!item.applicationId) {
      throw new Error("Falta la aplicación del documento.");
    }
    if (item.kind === "SECURITY_STUDY" || item.kind === "MEDICAL_EXAM") {
      const { blob, filename } = await hiringApi.downloadPreHireDocument(
        item.applicationId,
        item.kind,
      );
      triggerBlobDownload(
        blob,
        filename ||
          (item.kind === "SECURITY_STUDY"
            ? "estudio-seguridad"
            : "examenes-medicos"),
      );
      return;
    }
    if (item.kind === "offer-letter") {
      const { blob, filename } = await offersApi.downloadFilledLetter(
        item.applicationId,
      );
      triggerBlobDownload(blob, filename || "carta-oferta");
      return;
    }
    const { blob, filename } = await offersApi.downloadFilledContract(
      item.applicationId,
    );
    triggerBlobDownload(blob, filename || "contrato");
  } catch (error) {
    notifyError(error, `No se pudo descargar ${item.label.toLowerCase()}.`);
  }
}
