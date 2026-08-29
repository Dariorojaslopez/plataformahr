"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "@/components/auth/session-provider";
import { FormSelect } from "@/components/organization/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyId } from "@/hooks/use-company-id";
import { atsApi, atsKeys } from "@/lib/api/ats";
import { homeKeys } from "@/lib/api/home";
import { getErrorMessage } from "@/lib/api/errors";
import { publicJobUrl } from "@/lib/ats/public-job-url";
import { formatMoney } from "@/lib/ats/offer-labels";
import {
  formatDate,
  formatEmployeeName,
  VACANCY_STATUS_LABELS,
  vacancyStatusVariant,
} from "@/lib/ats/labels";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type { Vacancy } from "@/types/ats";

export function VacancyDetailPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();

  const detailQuery = useQuery({
    queryKey: atsKeys.vacancy(companyId, id),
    queryFn: () => atsApi.getVacancy(id),
  });

  const publicationMutation = useMutation({
    mutationFn: (action: "publish" | "unpublish") =>
      action === "publish"
        ? atsApi.publishVacancy(id)
        : atsApi.unpublishVacancy(id),
    onSuccess: async (_, action) => {
      await queryClient.invalidateQueries({ queryKey: atsKeys.all(companyId) });
      notifySuccess(
        action === "publish" ? "Vacante publicada" : "Vacante despublicada",
      );
    },
    onError: (error) =>
      notifyError(error, "No se pudo cambiar la publicación."),
  });

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <ErrorState
        title="Vacante no disponible"
        description={getErrorMessage(
          detailQuery.error,
          "No se encontró la vacante.",
        )}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  const vacancy = detailQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={vacancy.title}
        description="Detalle de vacante"
        actions={
          <div className="flex flex-wrap gap-2">
            {vacancy.status === "OPEN" && !vacancy.publishedAt ? (
              <Button
                type="button"
                disabled={publicationMutation.isPending}
                onClick={() => publicationMutation.mutate("publish")}
              >
                Publicar
              </Button>
            ) : null}
            <Button variant="outline" asChild>
              <Link href={`/ats/vacancies/${vacancy.id}/preview`}>
                <ExternalLink className="size-4" />
                Preview
              </Link>
            </Button>
            {vacancy.publishedAt ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={publicationMutation.isPending}
                  onClick={() => publicationMutation.mutate("unpublish")}
                >
                  Despublicar
                </Button>
                {vacancy.publicId ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void copyPublicLink(vacancy.publicId!)}
                    >
                      <Copy className="size-4" />
                      Copiar enlace
                    </Button>
                    <Button variant="outline" asChild>
                      <a
                        href={`/jobs/${encodeURIComponent(vacancy.publicId)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="size-4" />
                        Abrir pública
                      </a>
                    </Button>
                  </>
                ) : null}
              </>
            ) : null}
            <Button asChild>
              <Link href={`/ats/pipeline?vacancyId=${vacancy.id}`}>
                Ver pipeline
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/ats/candidates`}>Candidatos</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Estado">
          <Badge variant={vacancyStatusVariant(vacancy.status)}>
            {VACANCY_STATUS_LABELS[vacancy.status]}
          </Badge>
        </Field>
        <Field label="Publicación">
          <Badge variant={vacancy.publishedAt ? "success" : "secondary"}>
            {vacancy.publishedAt ? "Publicada" : "No publicada"}
          </Badge>
        </Field>
        <Field label="Cargo">{vacancy.position?.name ?? "—"}</Field>
        <Field label="Área">{vacancy.area?.name ?? "—"}</Field>
        <RecruiterAssignmentField vacancy={vacancy} />
        <SalaryPublicationField
          key={`${vacancy.id}-${vacancy.salaryAmount ?? ""}`}
          vacancy={vacancy}
        />
        <Field label="Plazas">
          {vacancy.filledCount} / {vacancy.headcount}
          <p className="mt-1 text-xs text-muted-foreground">
            Contador de cobertura de la vacante (no implica contratación formal
            todavía).
          </p>
        </Field>
        <Field label="Apertura">{formatDate(vacancy.openedAt)}</Field>
        <Field label="Cierre">{formatDate(vacancy.closedAt)}</Field>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Descripción</h2>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {vacancy.description?.trim() || "Sin descripción."}
        </p>
      </section>
    </div>
  );
}

function RecruiterAssignmentField({ vacancy }: { vacancy: Vacancy }) {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const roleCodes = new Set(useSession().companyAccess?.roleCodes ?? []);
  const canAssign = roleCodes.has("CLIENT_ADMIN");

  const recruitersQuery = useQuery({
    queryKey: atsKeys.recruiters(companyId),
    queryFn: () => atsApi.listRecruiters(),
    enabled: canAssign,
  });

  const assignMutation = useMutation({
    mutationFn: (assignedRecruiterEmployeeId: string | null) =>
      atsApi.updateVacancy(vacancy.id, { assignedRecruiterEmployeeId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: atsKeys.all(companyId) });
      await queryClient.invalidateQueries({ queryKey: homeKeys.feed(companyId) });
      notifySuccess("Reclutador actualizado");
    },
    onError: (error) =>
      notifyError(error, "No se pudo asignar el reclutador."),
  });

  const options = useMemo(() => {
    const recruiters = recruitersQuery.data ?? [];
    const current = vacancy.assignedRecruiter;
    const hasCurrent = current
      ? recruiters.some((item) => item.id === current.id)
      : true;
    const items = hasCurrent || !current ? recruiters : [current, ...recruiters];
    return items.map((employee) => ({
      value: employee.id,
      label: formatEmployeeName(employee),
    }));
  }, [recruitersQuery.data, vacancy.assignedRecruiter]);

  if (!canAssign) {
    return (
      <Field label="Reclutador">
        {vacancy.assignedRecruiter
          ? formatEmployeeName(vacancy.assignedRecruiter)
          : "Sin asignar"}
      </Field>
    );
  }

  return (
    <FormSelect
      id="vacancy-assigned-recruiter"
      label="Reclutador"
      className="w-full"
      value={vacancy.assignedRecruiterEmployeeId ?? ""}
      onChange={(value) => assignMutation.mutate(value ? value : null)}
      options={options}
      allowEmpty
      emptyLabel="Sin asignar"
    />
  );
}

function SalaryPublicationField({ vacancy }: { vacancy: Vacancy }) {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const isAdmin = (useSession().companyAccess?.roleCodes ?? []).includes(
    "CLIENT_ADMIN",
  );
  const [amount, setAmount] = useState(vacancy.salaryAmount ?? "");

  const saveMutation = useMutation({
    mutationFn: (payload: {
      salaryAmount: string | null;
      showSalaryPublic: boolean;
    }) => atsApi.updateVacancy(vacancy.id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: atsKeys.all(companyId) });
      notifySuccess("Salario actualizado");
    },
    onError: (error) => notifyError(error, "No se pudo guardar el salario."),
  });

  if (!isAdmin) {
    return (
      <Field label="Salario público">
        {vacancy.showSalaryPublic && vacancy.salaryAmount
          ? formatMoney(vacancy.salaryAmount, vacancy.salaryCurrency)
          : "Oculto en la vacante pública"}
      </Field>
    );
  }

  return (
    <div className="space-y-2 sm:col-span-2">
      <Label htmlFor="vacancy-salary">Salario (opcional)</Label>
      <Input
        id="vacancy-salary"
        inputMode="decimal"
        placeholder="Ej. 4500000"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        onBlur={() => {
          const trimmed = amount.trim();
          if (trimmed === (vacancy.salaryAmount ?? "")) return;
          void saveMutation.mutate({
            salaryAmount: trimmed || null,
            showSalaryPublic: trimmed ? vacancy.showSalaryPublic : false,
          });
        }}
      />
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={vacancy.showSalaryPublic}
          disabled={!vacancy.salaryAmount || saveMutation.isPending}
          onCheckedChange={(checked) =>
            saveMutation.mutate({
              salaryAmount: vacancy.salaryAmount,
              showSalaryPublic: checked === true,
            })
          }
        />
        Mostrar salario en la vacante pública
      </label>
      <p className="text-xs text-muted-foreground">
        Si está activo, el salario aparece en el enlace público de la vacante.
      </p>
    </div>
  );
}

async function copyPublicLink(publicId: string) {
  try {
    await navigator.clipboard.writeText(
      publicJobUrl(publicId, window.location.origin),
    );
    notifySuccess("Enlace público copiado");
  } catch {
    notifyError(new Error("Clipboard unavailable"), "No se pudo copiar.");
  }
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
