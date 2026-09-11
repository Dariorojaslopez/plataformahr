"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CONFIGURABLE_COMPANY_ROLES,
  defaultMenuHrefsForRole,
  type ConfigurableCompanyRole,
} from "@talento/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/components/auth/session-provider";
import { useCompanyId } from "@/hooks/use-company-id";
import { companyApi, companyKeys } from "@/lib/api/company";
import { getErrorMessage } from "@/lib/api/errors";
import { COMPANY_ROLE_LABELS } from "@/lib/ats/labels";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type { RoleMenuCatalogItem, RoleMenuConfig } from "@/types/company";

function hrefsByRole(config: RoleMenuConfig): Record<ConfigurableCompanyRole, string[]> {
  const next = {} as Record<ConfigurableCompanyRole, string[]>;
  for (const role of CONFIGURABLE_COMPANY_ROLES) {
    next[role] =
      config.roles.find((item) => item.roleCode === role)?.hrefs ??
      defaultMenuHrefsForRole(role);
  }
  return next;
}

function catalogSections(catalog: RoleMenuCatalogItem[]) {
  const sections: Array<{ section: string; items: RoleMenuCatalogItem[] }> = [];
  for (const item of catalog) {
    const current = sections.find((group) => group.section === item.section);
    if (current) {
      current.items.push(item);
      continue;
    }
    sections.push({ section: item.section, items: [item] });
  }
  return sections;
}

export function RoleMenuPageClient() {
  const companyId = useCompanyId();
  const query = useQuery({
    queryKey: companyKeys.roleMenus(companyId),
    queryFn: () => companyApi.getRoleMenus(),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="No se pudieron cargar los permisos de menú"
        description={getErrorMessage(query.error, "Inténtalo de nuevo.")}
      />
    );
  }

  return (
    <RoleMenuForm key={companyId} companyId={companyId} config={query.data} />
  );
}

function RoleMenuForm({
  companyId,
  config,
}: {
  companyId: string;
  config: RoleMenuConfig;
}) {
  const queryClient = useQueryClient();
  const { refreshCompanyAccess } = useSession();
  const [selectedRole, setSelectedRole] = useState<ConfigurableCompanyRole>(
    CONFIGURABLE_COMPANY_ROLES[0],
  );
  const [grants, setGrants] = useState(() => hrefsByRole(config));
  const sections = useMemo(
    () => catalogSections(config.catalog),
    [config.catalog],
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      companyApi.updateRoleMenus({
        roles: CONFIGURABLE_COMPANY_ROLES.map((roleCode) => ({
          roleCode,
          hrefs: grants[roleCode],
        })),
      }),
    onSuccess: (next) => {
      setGrants(hrefsByRole(next));
      void queryClient.invalidateQueries({
        queryKey: companyKeys.roleMenus(companyId),
      });
      void refreshCompanyAccess();
      notifySuccess("Permisos de menú guardados.");
    },
    onError: (error) => {
      notifyError(getErrorMessage(error, "No se pudieron guardar los permisos."));
    },
  });

  function toggleHref(role: ConfigurableCompanyRole, href: string, checked: boolean) {
    setGrants((current) => {
      const hrefs = new Set(current[role]);
      if (checked) hrefs.add(href);
      else hrefs.delete(href);
      return { ...current, [role]: [...hrefs] };
    });
  }

  function restoreRole(role: ConfigurableCompanyRole) {
    setGrants((current) => ({
      ...current,
      [role]: defaultMenuHrefsForRole(role),
    }));
  }

  const selectedHrefs = new Set(grants[selectedRole]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Permisos de menú"
        description="Elige qué opciones del menú ve cada rol. El administrador de la compañía siempre ve todo. Inicio queda visible para todos."
      />

      <Tabs
        value={selectedRole}
        onValueChange={(value) =>
          setSelectedRole(value as ConfigurableCompanyRole)
        }
      >
        <TabsList className="flex h-auto w-full flex-wrap justify-start">
          {CONFIGURABLE_COMPANY_ROLES.map((role) => (
            <TabsTrigger key={role} value={role}>
              {COMPANY_ROLE_LABELS[role] ?? role}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Los colaboradores con rol {COMPANY_ROLE_LABELS[selectedRole] ?? selectedRole}{" "}
          verán solo las opciones marcadas.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => restoreRole(selectedRole)}
        >
          Restaurar predeterminado
        </Button>
      </div>

      <div className="space-y-6">
        {sections.map((group) => (
          <fieldset key={group.section} className="space-y-3">
            <legend className="text-sm font-medium">{group.section}</legend>
            <ul className="grid gap-2 sm:grid-cols-2">
              {group.items.map((item) => {
                const checkboxId = `role-menu-${selectedRole}-${item.href}`;
                return (
                  <li key={item.href}>
                    <label
                      htmlFor={checkboxId}
                      className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3"
                    >
                      <Checkbox
                        id={checkboxId}
                        checked={selectedHrefs.has(item.href)}
                        onCheckedChange={(value) =>
                          toggleHref(selectedRole, item.href, value === true)
                        }
                      />
                      <span className="min-w-0">
                        <Label htmlFor={checkboxId} className="cursor-pointer">
                          {item.label}
                        </Label>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? "Guardando…" : "Guardar permisos"}
        </Button>
      </div>
    </div>
  );
}
