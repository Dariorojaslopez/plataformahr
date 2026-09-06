"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyId } from "@/hooks/use-company-id";
import { atsKeys } from "@/lib/api/ats";
import { ApiError, getErrorMessage } from "@/lib/api/errors";
import { hiringApi, hiringKeys } from "@/lib/api/hiring";
import { offerKeys, offersApi } from "@/lib/api/offers";
import { orgKeys, organizationApi } from "@/lib/api/organization";
import {
  PRE_HIRE_CHECK_STATUS_LABELS,
  PRE_HIRE_DOCUMENT_KIND_LABELS,
  formatDateShort,
} from "@/lib/ats/labels";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type {
  PreHireCheckStatus,
  PreHireDocumentKind,
} from "@/types/ats";
import type { JobOffer } from "@/types/offers";

const PRE_HIRE_STATUS_OPTIONS: Array<{
  value: PreHireCheckStatus;
  label: string;
}> = (
  Object.keys(PRE_HIRE_CHECK_STATUS_LABELS) as PreHireCheckStatus[]
).map((value) => ({
  value,
  label: PRE_HIRE_CHECK_STATUS_LABELS[value],
}));

const DOC_KINDS: PreHireDocumentKind[] = ["SECURITY_STUDY", "MEDICAL_EXAM"];

export function ApplicationHiringSection({
  applicationId,
  offer,
}: {
  applicationId: string;
  offer: JobOffer | null;
}) {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hireDate, setHireDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [businessUnitId, setBusinessUnitId] = useState("");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const hiringQuery = useQuery({
    queryKey: hiringKeys.byApplication(companyId, applicationId),
    queryFn: () => hiringApi.getByApplication(applicationId),
    retry: (n, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return n < 2;
    },
  });

  const buQuery = useQuery({
    queryKey: orgKeys.businessUnits(companyId),
    queryFn: () => organizationApi.listBusinessUnits(),
    enabled: open,
  });

  async function invalidateAll(employeeId?: string) {
    await queryClient.invalidateQueries({ queryKey: atsKeys.all(companyId) });
    await queryClient.invalidateQueries({
      queryKey: hiringKeys.all(companyId),
    });
    await queryClient.invalidateQueries({
      queryKey: offerKeys.all(companyId),
    });
    await queryClient.invalidateQueries({ queryKey: orgKeys.all(companyId) });
    if (employeeId) {
      await queryClient.invalidateQueries({
        queryKey: orgKeys.employeeProfile(companyId, employeeId),
      });
    }
  }

  const hireMutation = useMutation({
    mutationFn: () =>
      hiringApi.hire(applicationId, {
        hireDate: hireDate || undefined,
        businessUnitId: businessUnitId || undefined,
        phone: phone.trim() || undefined,
      }),
    onSuccess: async (hiring) => {
      await invalidateAll(hiring.employeeId);
      setConfirmOpen(false);
      setOpen(false);
      setFormError(null);
      notifySuccess(pdiHireMessage(hiring.pdi));
    },
    onError: (error) => {
      setConfirmOpen(false);
      setFormError(getErrorMessage(error, "No se pudo contratar."));
      notifyError(error, "No se pudo registrar la contratación.");
    },
  });

  const missing =
    hiringQuery.isError &&
    hiringQuery.error instanceof ApiError &&
    hiringQuery.error.status === 404;

  if (hiringQuery.isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (hiringQuery.isSuccess && hiringQuery.data) {
    const hiring = hiringQuery.data;
    const employee = hiring.employee;
    return (
      <div className="space-y-4">
        <section className="space-y-3 rounded-md border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Contratación</h2>
            <Badge variant="success">Contratado</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Fecha de ingreso:{" "}
            {hiring.hireDate ? formatDateShort(hiring.hireDate) : "—"}
          </p>
          {employee ? (
            <p className="text-sm">
              Colaborador: {employee.firstName} {employee.lastName}
            </p>
          ) : null}
          <Button asChild size="sm" variant="outline">
            <Link href={`/organization/employees/${hiring.employeeId}`}>
              Ver colaborador
            </Link>
          </Button>
        </section>
        <ApplicationPdiSection applicationId={applicationId} hired />
      </div>
    );
  }

  if (!missing && hiringQuery.isError) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {getErrorMessage(hiringQuery.error, "No se pudo cargar la contratación.")}
      </p>
    );
  }

  const canHire = offer?.status === "ACCEPTED";

  return (
    <div className="space-y-4">
      <PreHireChecklistSection applicationId={applicationId} />
      <ApplicationPdiSection
        applicationId={applicationId}
        hired={false}
      />

      <section className="space-y-3 rounded-md border border-border p-4">
        <h2 className="text-lg font-semibold">Contratación</h2>
        {!canHire ? (
          <p className="text-sm text-muted-foreground">
            Disponible cuando la oferta esté aceptada.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              La oferta está aceptada. Completa seguridad y médicos antes de
              contratar.
            </p>
            <Button type="button" size="sm" onClick={() => setOpen(true)}>
              Registrar contratación
            </Button>
          </>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Registrar contratación</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-muted-foreground">Candidato:</span>{" "}
                {offer?.application?.candidate
                  ? `${offer.application.candidate.firstName} ${offer.application.candidate.lastName}`
                  : "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Vacante:</span>{" "}
                {offer?.application?.vacancy?.title ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Oferta:</span>{" "}
                {offer?.positionTitle ?? "—"} (aceptada)
              </p>
            </div>
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label htmlFor="hire-date">Fecha de ingreso</Label>
                <Input
                  id="hire-date"
                  type="date"
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                />
              </div>
              <FormSelect
                id="hire-bu"
                label="Unidad de negocio (opcional)"
                value={businessUnitId}
                onChange={setBusinessUnitId}
                allowEmpty
                emptyLabel="Sin unidad"
                options={(buQuery.data ?? []).map((bu) => ({
                  value: bu.id,
                  label: bu.name,
                }))}
              />
              <div className="space-y-2">
                <Label htmlFor="hire-phone">Teléfono (opcional)</Label>
                <Input
                  id="hire-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
            {formError ? (
              <p className="text-sm text-destructive" role="alert">
                {formError}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={hireMutation.isPending}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={hireMutation.isPending}
                onClick={() => setConfirmOpen(true)}
              >
                Continuar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar contratación</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Esta acción cerrará el proceso de selección y creará el
              colaborador en Organización.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Aplicación → Contratado / Cerrado</li>
              <li>Candidato → Contratado</li>
              <li>Vacante: plazas cubiertas +1</li>
              <li>Se crea el colaborador</li>
            </ul>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={hireMutation.isPending}
                onClick={() => setConfirmOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={hireMutation.isPending}
                onClick={() => hireMutation.mutate()}
              >
                Confirmar contratación
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    </div>
  );
}

function pdiHireMessage(
  pdi: import("@/lib/api/hiring").HirePdiSyncResult | undefined,
): string {
  if (!pdi || pdi.status === "SKIPPED_NO_FEATURE") {
    return "Contratación registrada";
  }
  if (pdi.status === "SYNCED") {
    return `Contratación registrada. PDI cargado en Performance${
      pdi.cycleName ? ` (${pdi.cycleName})` : ""
    }.`;
  }
  if (pdi.status === "SKIPPED_NO_CYCLE") {
    return "Contratación registrada. PDI listo para descargar; no hay ciclo Performance activo.";
  }
  return "Contratación registrada. Sin aportes de entrevista para armar el PDI.";
}

function ApplicationPdiSection({
  applicationId,
  hired,
}: {
  applicationId: string;
  hired: boolean;
}) {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const pdiQuery = useQuery({
    queryKey: hiringKeys.pdi(companyId, applicationId),
    queryFn: () => hiringApi.getPdi(applicationId),
  });

  const syncMutation = useMutation({
    mutationFn: () => hiringApi.syncPdi(applicationId),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: hiringKeys.pdi(companyId, applicationId),
      });
      notifySuccess(pdiHireMessage(result).replace("Contratación registrada. ", ""));
    },
    onError: (error) => {
      notifyError(error, "No se pudo sincronizar el PDI.");
    },
  });

  if (pdiQuery.isLoading) {
    return <Skeleton className="h-28 w-full" />;
  }

  if (pdiQuery.isError || !pdiQuery.data) {
    return null;
  }

  const draft = pdiQuery.data.draft;

  return (
    <section className="space-y-3 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">PDI (selección)</h2>
        <Badge variant="secondary">
          {draft.sourceCount} aporte{draft.sourceCount === 1 ? "" : "s"}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Se arma con fortalezas y oportunidades de las entrevistas.{" "}
        {hired
          ? "Tras contratar, puedes sincronizarlo al ciclo Performance activo (premium.pdi)."
          : "Al contratar con premium.pdi se carga automáticamente a Performance si hay ciclo activo."}
      </p>
      <p className="text-sm font-medium">{draft.name}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Fortalezas</p>
          <p className="whitespace-pre-wrap text-sm">
            {draft.strengths || "—"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Oportunidades de mejora
          </p>
          <p className="whitespace-pre-wrap text-sm">
            {draft.improvements || "—"}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={async () => {
            try {
              const { blob, filename } =
                await hiringApi.downloadPdi(applicationId);
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = filename || "pdi.txt";
              a.click();
              URL.revokeObjectURL(url);
            } catch (error) {
              notifyError(error, "No se pudo descargar el PDI.");
            }
          }}
        >
          Descargar .txt
        </Button>
        {hired ? (
          <Button
            type="button"
            size="sm"
            disabled={syncMutation.isPending}
            onClick={() => syncMutation.mutate()}
          >
            {syncMutation.isPending
              ? "Sincronizando…"
              : "Sincronizar a Performance"}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function PreHireChecklistSection({
  applicationId,
}: {
  applicationId: string;
}) {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const fileRefs = useRef<Record<PreHireDocumentKind, HTMLInputElement | null>>(
    {
      SECURITY_STUDY: null,
      MEDICAL_EXAM: null,
    },
  );

  const preHireQuery = useQuery({
    queryKey: hiringKeys.preHire(companyId, applicationId),
    queryFn: () => hiringApi.getPreHire(applicationId),
  });

  const updateMutation = useMutation({
    mutationFn: (body: {
      securityStudyStatus?: PreHireCheckStatus;
      medicalExamStatus?: PreHireCheckStatus;
    }) => hiringApi.updatePreHire(applicationId, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: hiringKeys.preHire(companyId, applicationId),
      });
      await queryClient.invalidateQueries({
        queryKey: atsKeys.application(companyId, applicationId),
      });
      notifySuccess("Checklist precontratación actualizado");
    },
    onError: (error) => {
      notifyError(error, "No se pudo actualizar el checklist.");
    },
  });

  const uploadMutation = useMutation({
    mutationFn: ({
      kind,
      file,
    }: {
      kind: PreHireDocumentKind;
      file: File;
    }) => hiringApi.uploadPreHireDocument(applicationId, kind, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: hiringKeys.preHire(companyId, applicationId),
      });
      notifySuccess("Documento cargado");
    },
    onError: (error) => {
      notifyError(error, "No se pudo cargar el documento.");
    },
  });

  if (preHireQuery.isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (preHireQuery.isError || !preHireQuery.data) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {getErrorMessage(
          preHireQuery.error,
          "No se pudo cargar el checklist precontratación.",
        )}
      </p>
    );
  }

  const data = preHireQuery.data;
  const docsByKind = new Map(data.documents.map((d) => [d.kind, d]));

  return (
    <section className="space-y-3 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Checklist precontratación</h2>
        <Badge variant={data.ready ? "success" : "secondary"}>
          {data.ready ? "Listo para contratar" : "Pendiente"}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Estudio de seguridad y exámenes médicos deben estar aprobados o
        marcados como no requeridos.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <FormSelect
          id="security-study-status"
          label="Estudio de seguridad"
          value={data.securityStudyStatus}
          onChange={(value) =>
            updateMutation.mutate({
              securityStudyStatus: value as PreHireCheckStatus,
            })
          }
          options={PRE_HIRE_STATUS_OPTIONS}
          disabled={updateMutation.isPending}
        />
        <FormSelect
          id="medical-exam-status"
          label="Exámenes médicos"
          value={data.medicalExamStatus}
          onChange={(value) =>
            updateMutation.mutate({
              medicalExamStatus: value as PreHireCheckStatus,
            })
          }
          options={PRE_HIRE_STATUS_OPTIONS}
          disabled={updateMutation.isPending}
        />
      </div>
      <div className="space-y-3">
        {DOC_KINDS.map((kind) => {
          const doc = docsByKind.get(kind);
          return (
            <div
              key={kind}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">
                  {PRE_HIRE_DOCUMENT_KIND_LABELS[kind]}
                </p>
                <p className="text-xs text-muted-foreground">
                  {doc ? doc.originalName : "Sin archivo adjunto"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {doc ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const { blob } = await hiringApi.downloadPreHireDocument(
                          applicationId,
                          kind,
                        );
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = doc.originalName;
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch (error) {
                        notifyError(error, "No se pudo descargar.");
                      }
                    }}
                  >
                    Descargar
                  </Button>
                ) : null}
                <input
                  ref={(el) => {
                    fileRefs.current[kind] = el;
                  }}
                  type="file"
                  accept=".pdf,.docx,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) uploadMutation.mutate({ kind, file });
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={uploadMutation.isPending}
                  onClick={() => fileRefs.current[kind]?.click()}
                >
                  {doc ? "Reemplazar" : "Subir"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ApplicationHiringSectionConnected({
  applicationId,
}: {
  applicationId: string;
}) {
  const companyId = useCompanyId();
  const offerQuery = useQuery({
    queryKey: offerKeys.byApplication(companyId, applicationId),
    queryFn: () => offersApi.getByApplication(applicationId),
    retry: (n, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return n < 2;
    },
  });

  const offer =
    offerQuery.isSuccess && offerQuery.data ? offerQuery.data : null;

  return (
    <ApplicationHiringSection applicationId={applicationId} offer={offer} />
  );
}
