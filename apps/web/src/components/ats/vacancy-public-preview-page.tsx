"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PublicJobPage } from "@/components/ats/public-job-page";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyId } from "@/hooks/use-company-id";
import { atsApi, atsKeys } from "@/lib/api/ats";
import { getErrorMessage } from "@/lib/api/errors";

export function VacancyPublicPreviewPage() {
  const companyId = useCompanyId();
  const { id } = useParams<{ id: string }>();

  const previewQuery = useQuery({
    queryKey: atsKeys.vacancyPublicPreview(companyId, id),
    queryFn: () => atsApi.previewVacancyPublic(id),
  });

  if (previewQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (previewQuery.isError || !previewQuery.data) {
    return (
      <ErrorState
        title="No se pudo cargar la vista previa"
        description={getErrorMessage(
          previewQuery.error,
          "La vacante no está disponible.",
        )}
        onRetry={() => void previewQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="outline" asChild>
        <Link href={`/ats/vacancies/${id}`}>Volver a la vacante</Link>
      </Button>
      <PublicJobPage job={previewQuery.data} preview />
    </div>
  );
}
