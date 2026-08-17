"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyId } from "@/hooks/use-company-id";
import { atsApi, atsKeys } from "@/lib/api/ats";
import { getErrorMessage } from "@/lib/api/errors";
import { publicJobUrl } from "@/lib/ats/public-job-url";
import {
  formatDate,
  VACANCY_STATUS_LABELS,
  vacancyStatusVariant,
} from "@/lib/ats/labels";
import { notifyError, notifySuccess } from "@/lib/ui/notify";

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
