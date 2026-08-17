"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyId } from "@/hooks/use-company-id";
import { companyApi, companyKeys } from "@/lib/api/company";
import { getErrorMessage } from "@/lib/api/errors";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import {
  PLATFORM_BRAND_PRIMARY,
  brandCssVars,
  normalizeBrandColor,
} from "@/lib/company/brand-tokens";
import { updateSessionCompany } from "@/lib/auth/session-store";
import type { CompanyBranding } from "@/types/company";

export function CompanyBrandingPageClient() {
  const companyId = useCompanyId();
  const query = useQuery({
    queryKey: companyKeys.branding(companyId),
    queryFn: () => companyApi.getBranding(),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="No se pudo cargar la apariencia"
        description={getErrorMessage(query.error, "Inténtalo de nuevo.")}
      />
    );
  }

  return (
    <CompanyBrandingForm
      key={companyId}
      companyId={companyId}
      branding={query.data}
    />
  );
}

function CompanyBrandingForm({
  companyId,
  branding,
}: {
  companyId: string;
  branding: CompanyBranding;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(branding.name);
  const [color, setColor] = useState(
    branding.brandPrimaryColor ?? PLATFORM_BRAND_PRIMARY,
  );
  const [colorTouched, setColorTouched] = useState(false);

  const logoQuery = useQuery({
    queryKey: companyKeys.logo(companyId, branding.logoUpdatedAt),
    queryFn: async () => {
      const { blob } = await companyApi.getLogoBlob();
      return URL.createObjectURL(blob);
    },
    enabled: branding.hasLogo,
  });

  useEffect(() => {
    const url = logoQuery.data;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [logoQuery.data]);

  const previewColor = useMemo(
    () => normalizeBrandColor(color) ?? PLATFORM_BRAND_PRIMARY,
    [color],
  );
  const previewVars = brandCssVars(previewColor);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("El nombre comercial es obligatorio.");
      const normalized = normalizeBrandColor(color);
      if (!normalized) {
        throw new Error("El color debe tener el formato #RRGGBB.");
      }
      return companyApi.updateBranding({
        name: trimmed,
        brandPrimaryColor: normalized,
      });
    },
    onSuccess: (result) => {
      updateSessionCompany(result.id, { name: result.name });
      queryClient.setQueryData(companyKeys.branding(companyId), result);
      setColorTouched(false);
      notifySuccess("Apariencia guardada.");
    },
    onError: (error) => notifyError(error, "No se pudo guardar la apariencia."),
  });

  const restoreColorMutation = useMutation({
    mutationFn: () => companyApi.updateBranding({ brandPrimaryColor: null }),
    onSuccess: (result) => {
      queryClient.setQueryData(companyKeys.branding(companyId), result);
      setColor(PLATFORM_BRAND_PRIMARY);
      setColorTouched(false);
      notifySuccess("Color restaurado al de Plataforma HR.");
    },
    onError: (error) => notifyError(error, "No se pudo restaurar el color."),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => companyApi.uploadLogo(file),
    onSuccess: (result) => {
      queryClient.setQueryData(companyKeys.branding(companyId), result);
      notifySuccess("Logo actualizado.");
    },
    onError: (error) => notifyError(error, "No se pudo subir el logo."),
  });

  const removeLogoMutation = useMutation({
    mutationFn: () => companyApi.removeLogo(),
    onSuccess: (result) => {
      queryClient.setQueryData(companyKeys.branding(companyId), result);
      notifySuccess("Logo eliminado.");
    },
    onError: (error) => notifyError(error, "No se pudo eliminar el logo."),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Apariencia"
        description="Identidad visual de esta compañía. No cambia el tema de otras compañías ni los colores de error, alerta o éxito."
      />

      <div
        data-testid="branding-preview"
        className="overflow-hidden rounded-lg border border-border bg-card"
        style={previewVars}
      >
        <div className="flex items-center gap-3 bg-sidebar px-4 py-3 text-sidebar-foreground">
          {branding.hasLogo && logoQuery.data ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoQuery.data}
              alt=""
              className="h-8 w-8 rounded object-contain bg-white"
            />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded bg-sidebar-accent text-xs font-semibold text-white">
              {name.slice(0, 2).toUpperCase() || "HR"}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{name || "Compañía"}</p>
            <p className="text-[11px] text-sidebar-foreground/60">Vista previa</p>
          </div>
          <span className="ml-auto rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground">
            Color de marca
          </span>
        </div>
        <div className="flex gap-2 p-4 text-xs">
          <span className="rounded bg-destructive px-2 py-1 text-destructive-foreground">
            Error
          </span>
          <span className="rounded bg-warning px-2 py-1 text-warning-foreground">
            Alerta
          </span>
          <span className="rounded bg-success px-2 py-1 text-success-foreground">
            Éxito
          </span>
        </div>
      </div>

      <form
        className="max-w-xl space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          saveMutation.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="company-display-name">Nombre comercial</Label>
          <Input
            id="company-display-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
          />
          {branding.legalName ? (
            <p className="text-xs text-muted-foreground">
              Razón social: {branding.legalName}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="company-brand-color">Color principal</Label>
          <div className="flex items-center gap-3">
            <input
              id="company-brand-color-picker"
              type="color"
              value={previewColor.toLowerCase()}
              onChange={(event) => {
                setColor(event.target.value.toUpperCase());
                setColorTouched(true);
              }}
              className="h-10 w-12 cursor-pointer rounded border border-border bg-card"
              aria-label="Selector de color"
            />
            <Input
              id="company-brand-color"
              value={color}
              onChange={(event) => {
                setColor(event.target.value);
                setColorTouched(true);
              }}
              placeholder={PLATFORM_BRAND_PRIMARY}
              className="font-mono uppercase"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Formato #RRGGBB. Usa restaurar para volver al color de Plataforma HR.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="company-logo">Logo</Label>
          <Input
            id="company-logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) uploadMutation.mutate(file);
            }}
          />
          {branding.hasLogo ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => removeLogoMutation.mutate()}
              disabled={removeLogoMutation.isPending}
            >
              Quitar logo
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saveMutation.isPending}>
            Guardar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => restoreColorMutation.mutate()}
            disabled={
              restoreColorMutation.isPending ||
              (!branding.brandPrimaryColor && !colorTouched)
            }
          >
            Restaurar color por defecto
          </Button>
        </div>
      </form>
    </div>
  );
}
