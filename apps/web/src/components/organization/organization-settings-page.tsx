"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/components/auth/session-provider";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ErrorState } from "@/components/ui/error-state";
import { useCompanyId } from "@/hooks/use-company-id";
import { companyApi, companyKeys } from "@/lib/api/company";
import { getErrorMessage } from "@/lib/api/errors";
import { notifyError, notifySuccess } from "@/lib/ui/notify";

export function OrganizationSettingsPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const isAdmin = (useSession().companyAccess?.roleCodes ?? []).includes(
    "CLIENT_ADMIN",
  );

  const companyQuery = useQuery({
    queryKey: companyKeys.current(companyId),
    queryFn: () => companyApi.getCurrent(),
  });

  const mutation = useMutation({
    mutationFn: (showNineBoxOnMyResults: boolean) =>
      companyApi.updatePerformanceSettings({ showNineBoxOnMyResults }),
    onSuccess: async (company) => {
      queryClient.setQueryData(companyKeys.current(companyId), company);
      notifySuccess(
        company.showNineBoxOnMyResults
          ? "El 9Box se muestra en mis resultados."
          : "El 9Box quedó oculto en mis resultados.",
      );
    },
    onError: (error) => notifyError(error, "No se pudo guardar."),
  });

  if (companyQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (companyQuery.isError) {
    return (
      <ErrorState
        title="No se pudieron cargar los ajustes"
        description={getErrorMessage(companyQuery.error, "Error")}
        onRetry={() => void companyQuery.refetch()}
      />
    );
  }

  const showNineBox = companyQuery.data?.showNineBoxOnMyResults !== false;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ajustes de resultados"
        description="El administrador puede ocultar el 9Box en la vista de mis resultados."
      />
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Label htmlFor="ninebox-switch">Mostrar 9Box en mis resultados</Label>
          <p className="text-sm text-muted-foreground">
            Si se apaga, las personas no ven su posición en el 9Box.
          </p>
        </div>
        <Switch
          id="ninebox-switch"
          checked={showNineBox}
          disabled={!isAdmin || mutation.isPending}
          onCheckedChange={(checked) => mutation.mutate(checked)}
          aria-label="Mostrar 9Box en mis resultados"
        />
      </section>
    </div>
  );
}
