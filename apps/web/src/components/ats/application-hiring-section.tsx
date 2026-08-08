"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
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
import { formatDateShort } from "@/lib/ats/labels";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type { JobOffer } from "@/types/offers";

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
      notifySuccess("Contratación registrada");
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
    <section className="space-y-3 rounded-md border border-border p-4">
      <h2 className="text-lg font-semibold">Contratación</h2>
      {!canHire ? (
        <p className="text-sm text-muted-foreground">
          Disponible cuando la oferta esté aceptada.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            La oferta está aceptada. Puedes registrar la contratación formal.
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
            Esta acción cerrará el proceso de selección y creará el colaborador
            en Organización.
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
