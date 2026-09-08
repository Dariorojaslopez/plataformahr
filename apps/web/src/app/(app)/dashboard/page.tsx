"use client";

import { useSession } from "@/components/auth/session-provider";
import { CompanyHome } from "@/components/dashboard/company-home";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  homeShortcutsFor,
  resolveHomeRoleFromAccess,
} from "@/lib/home/home-view";

export default function DashboardPage() {
  const {
    user,
    activeCompany,
    companyAccess,
    companyAccessLoading,
    companyAccessError,
    refreshCompanyAccess,
  } = useSession();

  if (companyAccessLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!companyAccess) {
    return (
      <ErrorState
        title="No se pudo entrar a la compañía"
        description={
          companyAccessError ??
          "Recarga o vuelve a seleccionar la empresa. Si sigue igual, pide acceso a un administrador."
        }
        onRetry={() => void refreshCompanyAccess()}
      />
    );
  }

  const homeRole = resolveHomeRoleFromAccess(companyAccess);

  return (
    <CompanyHome
      firstName={user?.firstName ?? ""}
      companyName={activeCompany?.name ?? ""}
      companySlug={activeCompany?.slug ?? ""}
      homeRole={homeRole}
      hasDirectReports={companyAccess.hasDirectReports ?? false}
      shortcuts={homeShortcutsFor(homeRole, companyAccess)}
    />
  );
}
