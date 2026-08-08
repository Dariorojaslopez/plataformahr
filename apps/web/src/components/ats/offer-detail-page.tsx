"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
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
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCompanyId } from "@/hooks/use-company-id";
import { atsKeys } from "@/lib/api/ats";
import { ApiError, getErrorMessage } from "@/lib/api/errors";
import { offerKeys, offersApi } from "@/lib/api/offers";
import { formatDate, formatDateShort } from "@/lib/ats/labels";
import {
  formatMoney,
  isOfferExpiredClient,
  OFFER_EMPLOYMENT_TYPE_LABELS,
  OFFER_STATUS_LABELS,
  offerStatusVariant,
  SALARY_PERIOD_LABELS,
} from "@/lib/ats/offer-labels";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type {
  CreateJobOfferInput,
  JobOffer,
  OfferEmploymentType,
  SalaryPeriod,
  UpdateJobOfferInput,
} from "@/types/offers";

type OfferFormState = {
  positionTitle: string;
  salaryAmount: string;
  salaryCurrency: string;
  salaryPeriod: SalaryPeriod;
  employmentType: OfferEmploymentType;
  startDate: string;
  expiresAt: string;
  notes: string;
};

function emptyForm(defaults?: Partial<OfferFormState>): OfferFormState {
  return {
    positionTitle: "",
    salaryAmount: "",
    salaryCurrency: "COP",
    salaryPeriod: "MONTHLY",
    employmentType: "FULL_TIME",
    startDate: "",
    expiresAt: "",
    notes: "",
    ...defaults,
  };
}

function offerToForm(offer: JobOffer): OfferFormState {
  return {
    positionTitle: offer.positionTitle,
    salaryAmount: String(offer.salaryAmount),
    salaryCurrency: offer.salaryCurrency,
    salaryPeriod: offer.salaryPeriod,
    employmentType: offer.employmentType,
    startDate: offer.startDate ? offer.startDate.slice(0, 10) : "",
    expiresAt: offer.expiresAt
      ? new Date(offer.expiresAt).toISOString().slice(0, 16)
      : "",
    notes: offer.notes ?? "",
  };
}

function toCreatePayload(form: OfferFormState): CreateJobOfferInput {
  const payload: CreateJobOfferInput = {
    positionTitle: form.positionTitle.trim(),
    salaryAmount: form.salaryAmount.trim(),
    salaryCurrency: form.salaryCurrency.trim().toUpperCase(),
    salaryPeriod: form.salaryPeriod,
    employmentType: form.employmentType,
  };
  if (form.startDate) payload.startDate = form.startDate;
  if (form.expiresAt) payload.expiresAt = new Date(form.expiresAt).toISOString();
  if (form.notes.trim()) payload.notes = form.notes.trim();
  return payload;
}

function toUpdatePayload(form: OfferFormState): UpdateJobOfferInput {
  return {
    positionTitle: form.positionTitle.trim(),
    salaryAmount: form.salaryAmount.trim(),
    salaryCurrency: form.salaryCurrency.trim().toUpperCase(),
    salaryPeriod: form.salaryPeriod,
    employmentType: form.employmentType,
    startDate: form.startDate || null,
    expiresAt: form.expiresAt
      ? new Date(form.expiresAt).toISOString()
      : null,
    notes: form.notes.trim() || null,
  };
}

export function OfferDetailPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<OfferFormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    "send" | "accept" | "reject" | "withdraw" | null
  >(null);

  const offerQuery = useQuery({
    queryKey: offerKeys.detail(companyId, id),
    queryFn: () => offersApi.getById(id),
  });

  async function invalidateAll(offer?: JobOffer) {
    const applicationId = offer?.applicationId ?? offerQuery.data?.applicationId;
    await queryClient.invalidateQueries({ queryKey: offerKeys.all(companyId) });
    await queryClient.invalidateQueries({ queryKey: atsKeys.all(companyId) });
    if (applicationId) {
      await queryClient.invalidateQueries({
        queryKey: offerKeys.byApplication(companyId, applicationId),
      });
      await queryClient.invalidateQueries({
        queryKey: atsKeys.application(companyId, applicationId),
      });
      await queryClient.invalidateQueries({
        queryKey: atsKeys.applicationHistory(companyId, applicationId),
      });
      const vacancyId = offer?.application?.vacancyId;
      if (vacancyId) {
        await queryClient.invalidateQueries({
          queryKey: atsKeys.pipeline(companyId, vacancyId),
        });
      }
    }
  }

  const updateMutation = useMutation({
    mutationFn: () => offersApi.update(id, toUpdatePayload(form)),
    onSuccess: async (offer) => {
      await invalidateAll(offer);
      setEditOpen(false);
      setFormError(null);
      notifySuccess("Oferta actualizada");
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, "No se pudo actualizar."));
      notifyError(error, "No se pudo actualizar.");
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => offersApi.send(id),
    onSuccess: async (offer) => {
      await invalidateAll(offer);
      setConfirm(null);
      notifySuccess("Oferta enviada");
    },
    onError: (error) => {
      setConfirm(null);
      notifyError(error, "No se pudo enviar la oferta.");
    },
  });

  const acceptMutation = useMutation({
    mutationFn: () => offersApi.accept(id),
    onSuccess: async (offer) => {
      await invalidateAll(offer);
      setConfirm(null);
      notifySuccess("Aceptación registrada");
    },
    onError: (error) => {
      setConfirm(null);
      if (error instanceof ApiError && error.status === 400) {
        notifyError(error, "La oferta no se puede aceptar.");
        return;
      }
      notifyError(error, "No se pudo registrar la aceptación.");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => offersApi.reject(id),
    onSuccess: async (offer) => {
      await invalidateAll(offer);
      setConfirm(null);
      notifySuccess("Rechazo registrado");
    },
    onError: (error) => {
      setConfirm(null);
      notifyError(error, "No se pudo registrar el rechazo.");
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: () => offersApi.withdraw(id),
    onSuccess: async (offer) => {
      await invalidateAll(offer);
      setConfirm(null);
      notifySuccess("Oferta retirada");
    },
    onError: (error) => {
      setConfirm(null);
      notifyError(error, "No se pudo retirar la oferta.");
    },
  });

  if (offerQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (offerQuery.isError || !offerQuery.data) {
    return (
      <ErrorState
        title="No se pudo cargar la oferta"
        description={getErrorMessage(offerQuery.error, "Oferta no disponible.")}
      />
    );
  }

  const offer = offerQuery.data;
  const expired =
    isOfferExpiredClient(offer.status, offer.expiresAt) ||
    offer.status === "EXPIRED";
  const displayStatus = expired && offer.status === "SENT" ? "EXPIRED" : offer.status;
  const candidate = offer.application?.candidate;
  const vacancy = offer.application?.vacancy;
  const pending =
    updateMutation.isPending ||
    sendMutation.isPending ||
    acceptMutation.isPending ||
    rejectMutation.isPending ||
    withdrawMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title={offer.positionTitle}
        description="Oferta laboral"
        actions={
          <div className="flex flex-wrap gap-2">
            {offer.applicationId ? (
              <Button variant="outline" asChild>
                <Link href={`/ats/applications/${offer.applicationId}`}>
                  Ver aplicación
                </Link>
              </Button>
            ) : null}
            {offer.status === "DRAFT" ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => {
                    setForm(offerToForm(offer));
                    setFormError(null);
                    setEditOpen(true);
                  }}
                >
                  Editar
                </Button>
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirm("send")}
                >
                  Enviar oferta
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setConfirm("withdraw")}
                >
                  Retirar
                </Button>
              </>
            ) : null}
            {offer.status === "SENT" && !expired ? (
              <>
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirm("accept")}
                >
                  Registrar aceptación
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => setConfirm("reject")}
                >
                  Registrar rechazo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setConfirm("withdraw")}
                >
                  Retirar
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      {expired ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="status"
        >
          Oferta vencida. No se puede registrar aceptación.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Estado">
          <Badge variant={offerStatusVariant(displayStatus)}>
            {OFFER_STATUS_LABELS[displayStatus]}
          </Badge>
        </Field>
        <Field label="Candidato">
          {candidate
            ? `${candidate.firstName} ${candidate.lastName}`
            : "—"}
        </Field>
        <Field label="Vacante">{vacancy?.title ?? "—"}</Field>
        <Field label="Cargo / plaza">{vacancy?.position?.name ?? "—"}</Field>
        <Field label="Salario">
          {formatMoney(offer.salaryAmount, offer.salaryCurrency)}
          <span className="ml-1 text-muted-foreground">
            ({SALARY_PERIOD_LABELS[offer.salaryPeriod]})
          </span>
        </Field>
        <Field label="Vinculación">
          {OFFER_EMPLOYMENT_TYPE_LABELS[offer.employmentType]}
        </Field>
        <Field label="Inicio">
          {offer.startDate ? formatDateShort(offer.startDate) : "—"}
        </Field>
        <Field label="Válida hasta">
          {offer.expiresAt ? formatDate(offer.expiresAt) : "—"}
        </Field>
        <Field label="Enviada">{formatDate(offer.sentAt)}</Field>
        <Field label="Aceptada">{formatDate(offer.acceptedAt)}</Field>
        <Field label="Rechazada">{formatDate(offer.rejectedAt)}</Field>
        <Field label="Retirada">{formatDate(offer.withdrawnAt)}</Field>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Notas</h2>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {offer.notes?.trim() || "Sin notas."}
        </p>
      </section>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar oferta</DialogTitle>
          </DialogHeader>
          <OfferFormFields form={form} setForm={setForm} />
          {formError ? (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={updateMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate()}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirm === "send"}
        title="Enviar oferta"
        description="Después de enviarla, las condiciones quedarán bloqueadas."
        confirmLabel="Enviar"
        pending={sendMutation.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => sendMutation.mutate()}
      />
      <ConfirmDialog
        open={confirm === "accept"}
        title="Registrar aceptación"
        description="Registra administrativamente que el candidato aceptó la oferta. No crea contratación ni empleado."
        confirmLabel="Registrar aceptación"
        pending={acceptMutation.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => acceptMutation.mutate()}
      />
      <ConfirmDialog
        open={confirm === "reject"}
        title="Registrar rechazo"
        description="Registra administrativamente que el candidato rechazó la oferta."
        confirmLabel="Registrar rechazo"
        pending={rejectMutation.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => rejectMutation.mutate()}
      />
      <ConfirmDialog
        open={confirm === "withdraw"}
        title="Retirar oferta"
        description="La oferta quedará retirada y no podrá enviarse ni aceptarse."
        confirmLabel="Retirar"
        pending={withdrawMutation.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => withdrawMutation.mutate()}
      />
    </div>
  );
}

export function ApplicationOfferSection({
  applicationId,
  applicationStage,
}: {
  applicationId: string;
  applicationStage: string;
}) {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<OfferFormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);

  const offerQuery = useQuery({
    queryKey: offerKeys.byApplication(companyId, applicationId),
    queryFn: () => offersApi.getByApplication(applicationId),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 2;
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      offersApi.createForApplication(applicationId, toCreatePayload(form)),
    onSuccess: async (offer) => {
      await queryClient.invalidateQueries({
        queryKey: offerKeys.all(companyId),
      });
      await queryClient.invalidateQueries({
        queryKey: atsKeys.application(companyId, applicationId),
      });
      setCreateOpen(false);
      setFormError(null);
      notifySuccess("Oferta creada");
      // keep form for next time empty
      setForm(emptyForm({ positionTitle: form.positionTitle }));
      void offer;
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, "No se pudo crear la oferta."));
      notifyError(error, "No se pudo crear la oferta.");
    },
  });

  const missing =
    offerQuery.isError &&
    offerQuery.error instanceof ApiError &&
    offerQuery.error.status === 404;

  if (offerQuery.isLoading) {
    return <Skeleton className="h-28 w-full" />;
  }

  if (offerQuery.isSuccess && offerQuery.data) {
    const offer = offerQuery.data;
    const expired = isOfferExpiredClient(offer.status, offer.expiresAt);
    const status =
      expired && offer.status === "SENT" ? "EXPIRED" : offer.status;
    return (
      <section className="space-y-3 rounded-md border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Oferta laboral</h2>
          <Badge variant={offerStatusVariant(status)}>
            {OFFER_STATUS_LABELS[status]}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatMoney(offer.salaryAmount, offer.salaryCurrency)} ·{" "}
          {SALARY_PERIOD_LABELS[offer.salaryPeriod]}
        </p>
        <Button asChild size="sm">
          <Link href={`/ats/offers/${offer.id}`}>Ver oferta</Link>
        </Button>
      </section>
    );
  }

  if (!missing && offerQuery.isError) {
    return (
      <ErrorState
        title="No se pudo cargar la oferta"
        description={getErrorMessage(offerQuery.error, "Error inesperado.")}
      />
    );
  }

  const canCreate = applicationStage === "INTERVIEW";

  return (
    <section className="space-y-3 rounded-md border border-border p-4">
      <h2 className="text-lg font-semibold">Oferta laboral</h2>
      <p className="text-sm text-muted-foreground">Sin oferta.</p>
      {canCreate ? (
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          Crear oferta
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          La oferta se crea cuando la aplicación está en etapa Entrevista.
        </p>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Crear oferta laboral</DialogTitle>
          </DialogHeader>
          <OfferFormFields form={form} setForm={setForm} />
          {formError ? (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={createMutation.isPending}
              onClick={() => setCreateOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={
                createMutation.isPending ||
                !form.positionTitle.trim() ||
                !form.salaryAmount.trim()
              }
              onClick={() => createMutation.mutate()}
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function OfferFormFields({
  form,
  setForm,
}: {
  form: OfferFormState;
  setForm: Dispatch<SetStateAction<OfferFormState>>;
}) {
  return (
    <div className="grid gap-3">
      <div className="space-y-2">
        <Label htmlFor="offer-title">Cargo / título</Label>
        <Input
          id="offer-title"
          value={form.positionTitle}
          onChange={(e) =>
            setForm((f) => ({ ...f, positionTitle: e.target.value }))
          }
          required
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="offer-salary">Salario</Label>
          <Input
            id="offer-salary"
            inputMode="decimal"
            value={form.salaryAmount}
            onChange={(e) =>
              setForm((f) => ({ ...f, salaryAmount: e.target.value }))
            }
            placeholder="4500000.00"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="offer-currency">Moneda (ISO)</Label>
          <Input
            id="offer-currency"
            value={form.salaryCurrency}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                salaryCurrency: e.target.value.toUpperCase(),
              }))
            }
            maxLength={3}
          />
        </div>
      </div>
      <FormSelect
        id="offer-period"
        label="Periodo salarial"
        value={form.salaryPeriod}
        onChange={(v) =>
          setForm((f) => ({ ...f, salaryPeriod: v as SalaryPeriod }))
        }
        options={Object.entries(SALARY_PERIOD_LABELS).map(([value, label]) => ({
          value,
          label,
        }))}
      />
      <FormSelect
        id="offer-employment"
        label="Tipo de vinculación"
        value={form.employmentType}
        onChange={(v) =>
          setForm((f) => ({
            ...f,
            employmentType: v as OfferEmploymentType,
          }))
        }
        options={Object.entries(OFFER_EMPLOYMENT_TYPE_LABELS).map(
          ([value, label]) => ({ value, label }),
        )}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="offer-start">Fecha de inicio</Label>
          <Input
            id="offer-start"
            type="date"
            value={form.startDate}
            onChange={(e) =>
              setForm((f) => ({ ...f, startDate: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="offer-expires">Válida hasta</Label>
          <Input
            id="offer-expires"
            type="datetime-local"
            value={form.expiresAt}
            onChange={(e) =>
              setForm((f) => ({ ...f, expiresAt: e.target.value }))
            }
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="offer-notes">Notas</Label>
        <Textarea
          id="offer-notes"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={3}
        />
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
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

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onCancel() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{description}</p>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <Button type="button" disabled={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
