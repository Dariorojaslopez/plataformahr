"use client";

import { useCallback, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useSession } from "@/components/auth/session-provider";
import { CompanyBrandingProvider } from "@/components/company/company-branding-provider";
import { AppHeader } from "@/components/layout/app-header";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import {
  getSidebarCollapsed,
  setSidebarCollapsed,
  subscribeSidebar,
} from "@/lib/auth/session-store";
import { cn } from "@/lib/utils";
import { resolveCompanyAccessForPath, isNavHrefGranted } from "@/lib/navigation";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";

export function AppShell({ children }: { children: ReactNode }) {
  const {
    activeCompanyId,
    companyAccess,
    companyAccessLoading,
    companyAccessError,
    refreshCompanyAccess,
  } = useSession();
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(
    subscribeSidebar,
    getSidebarCollapsed,
    () => false,
  );

  const toggle = useCallback(() => {
    setSidebarCollapsed(!getSidebarCollapsed());
  }, []);
  const requiredAccess = resolveCompanyAccessForPath(pathname);
  const hasAccess =
    (!requiredAccess ||
      (companyAccess?.enabledModules.includes(requiredAccess.module) &&
        companyAccess.enabledFeatures.includes(requiredAccess.feature))) &&
    (!companyAccess || isNavHrefGranted(companyAccess, pathname));

  return (
    <AuthGuard requireCompany>
      <CompanyBrandingProvider key={activeCompanyId ?? "none"}>
        {companyAccessLoading ? (
          <div className="mx-auto max-w-7xl space-y-4 px-4 py-8">
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-72 w-full" />
          </div>
        ) : !companyAccess ? (
          <div className="mx-auto max-w-7xl px-4 py-8">
            <ErrorState
              title="No se pudo cargar la compañía"
              description={
                companyAccessError ??
                "Vuelve a intentar. Si el panel se queda en blanco, recarga."
              }
              onRetry={() => void refreshCompanyAccess()}
            />
          </div>
        ) : !hasAccess ? (
          <div className="flex min-h-screen items-center justify-center p-6 text-center">
            <div>
              <h1 className="text-xl font-semibold">Función no habilitada</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Esta opción no está activa para la compañía seleccionada.
              </p>
            </div>
          </div>
        ) : (
        <div className="min-h-screen bg-background">
          <aside
            className={cn(
              "fixed inset-y-0 left-0 z-40 hidden overflow-hidden border-r border-sidebar-border transition-[width] lg:block",
              collapsed ? "w-[4.5rem]" : "w-64",
            )}
          >
            <SidebarNav
              collapsed={collapsed}
              onToggleCollapse={toggle}
              showCollapseToggle
            />
          </aside>
          <div
            className={cn(
              "min-h-screen transition-[padding]",
              collapsed ? "lg:pl-[4.5rem]" : "lg:pl-64",
            )}
          >
            <AppHeader onToggleSidebar={toggle} />
            <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
              {children}
            </main>
          </div>
        </div>
        )}
      </CompanyBrandingProvider>
    </AuthGuard>
  );
}
