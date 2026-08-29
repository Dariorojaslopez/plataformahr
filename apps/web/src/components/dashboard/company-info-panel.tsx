"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCompanyId } from "@/hooks/use-company-id";
import {
  EMPTY_HOME_COMPANY_INFO,
  homeApi,
  homeKeys,
  type HomeCompanyInfo,
} from "@/lib/api/home";
import { getErrorMessage } from "@/lib/api/errors";
import {
  fromDatetimeLocalValue,
  hasVisibleCompanyInfo,
  homeInfoScheduleError,
  toDatetimeLocalValue,
} from "@/lib/home/company-info";
import { notifyError, notifySuccess } from "@/lib/ui/notify";

export type CompanyInfoPanelProps = {
  canManage: boolean;
};

export function CompanyInfoPanel({ canManage }: CompanyInfoPanelProps) {
  const companyId = useCompanyId();
  const query = useQuery({
    queryKey: homeKeys.companyInfo(companyId),
    queryFn: () => homeApi.getCompanyInfo(),
  });

  if (query.isLoading) {
    if (!canManage) return null;
    return (
      <aside className="w-full lg:sticky lg:top-4 lg:w-80">
        <Skeleton className="h-72 w-full" />
      </aside>
    );
  }

  if (query.isError) {
    if (!canManage) return null;
    return (
      <aside className="w-full lg:sticky lg:top-4 lg:w-80">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Información de la compañía</CardTitle>
            <CardDescription>
              {getErrorMessage(query.error, "No se pudo cargar esta sección.")}
            </CardDescription>
          </CardHeader>
        </Card>
      </aside>
    );
  }

  const info = query.data ?? EMPTY_HOME_COMPANY_INFO;
  if (!canManage && !hasVisibleCompanyInfo(info)) return null;

  return (
    <CompanyInfoPanelBody
      companyId={companyId}
      info={info}
      canManage={canManage}
    />
  );
}

function CompanyInfoPanelBody({
  companyId,
  info,
  canManage,
}: {
  companyId: string;
  info: HomeCompanyInfo;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(info.title);
  const [description, setDescription] = useState(info.description);
  const [publishedAt, setPublishedAt] = useState(
    toDatetimeLocalValue(info.publishedAt) ||
      toDatetimeLocalValue(new Date().toISOString()),
  );
  const [unpublishedAt, setUnpublishedAt] = useState(
    toDatetimeLocalValue(info.unpublishedAt),
  );

  useEffect(() => {
    setTitle(info.title);
    setDescription(info.description);
    setPublishedAt(
      toDatetimeLocalValue(info.publishedAt) ||
        toDatetimeLocalValue(new Date().toISOString()),
    );
    setUnpublishedAt(toDatetimeLocalValue(info.unpublishedAt));
  }, [info]);

  const showMedia = info.hasMedia && (canManage || info.isLive);
  const mediaQuery = useQuery({
    queryKey: homeKeys.companyInfoMedia(companyId, info.mediaUpdatedAt),
    queryFn: async () => {
      const { blob } = await homeApi.getCompanyInfoMediaBlob();
      return URL.createObjectURL(blob);
    },
    enabled: showMedia,
  });

  useEffect(() => {
    const url = mediaQuery.data;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [mediaQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmed = title.trim();
      if (!trimmed) throw new Error("El título es obligatorio.");
      const scheduleError = homeInfoScheduleError(publishedAt, unpublishedAt);
      if (scheduleError) throw new Error(scheduleError);
      const publishedIso = fromDatetimeLocalValue(publishedAt);
      if (!publishedIso) throw new Error("La fecha de publicación es obligatoria.");
      return homeApi.updateCompanyInfo({
        title: trimmed,
        description: description.trim(),
        publishedAt: publishedIso,
        unpublishedAt: fromDatetimeLocalValue(unpublishedAt),
      });
    },
    onSuccess: (result) => {
      queryClient.setQueryData(homeKeys.companyInfo(companyId), result);
      notifySuccess("Información de la compañía guardada.");
    },
    onError: (error) =>
      notifyError(error, "No se pudo guardar la información de la compañía."),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => homeApi.uploadCompanyInfoMedia(file),
    onSuccess: (result) => {
      queryClient.setQueryData(homeKeys.companyInfo(companyId), result);
      notifySuccess("Archivo actualizado.");
    },
    onError: (error) => notifyError(error, "No se pudo subir el archivo."),
  });

  const removeMutation = useMutation({
    mutationFn: () => homeApi.removeCompanyInfoMedia(),
    onSuccess: (result) => {
      queryClient.setQueryData(homeKeys.companyInfo(companyId), result);
      notifySuccess("Archivo eliminado.");
    },
    onError: (error) => notifyError(error, "No se pudo eliminar el archivo."),
  });

  return (
    <aside className="w-full lg:sticky lg:top-4 lg:w-80">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información de la compañía</CardTitle>
          <CardDescription>
            {canManage
              ? "Imagen o video de comunicación. Solo se muestra en Inicio entre las fechas de publicación."
              : "Comunicación de la compañía."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CompanyInfoPreview
            info={info}
            mediaUrl={mediaQuery.data ?? null}
            canManage={canManage}
          />

          {canManage ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                saveMutation.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="home-company-info-title">Título</Label>
                <Input
                  id="home-company-info-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="home-company-info-description">Descripción</Label>
                <Textarea
                  id="home-company-info-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={2000}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="home-company-info-published">
                  Fecha de publicación
                </Label>
                <Input
                  id="home-company-info-published"
                  type="datetime-local"
                  value={publishedAt}
                  onChange={(event) => setPublishedAt(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="home-company-info-unpublished">
                  Fecha de despublicación
                </Label>
                <Input
                  id="home-company-info-unpublished"
                  type="datetime-local"
                  value={unpublishedAt}
                  onChange={(event) => setUnpublishedAt(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="home-company-info-media">Imagen o video</Label>
                <Input
                  id="home-company-info-media"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) uploadMutation.mutate(file);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  PNG, JPEG o WebP (máx. 5 MB) o MP4/WebM (máx. 20 MB).
                </p>
                {info.hasMedia ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeMutation.mutate()}
                    disabled={removeMutation.isPending}
                  >
                    Quitar archivo
                  </Button>
                ) : null}
              </div>
              <Button type="submit" disabled={saveMutation.isPending}>
                Guardar
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </aside>
  );
}

function CompanyInfoPreview({
  info,
  mediaUrl,
  canManage,
}: {
  info: HomeCompanyInfo;
  mediaUrl: string | null;
  canManage: boolean;
}) {
  const visible = hasVisibleCompanyInfo(info) || (canManage && info.hasMedia);
  if (!visible && !canManage) return null;

  if (!info.hasMedia && canManage) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay una imagen o un video cargado.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {mediaUrl && info.mediaKind === "VIDEO" ? (
        <video
          className="aspect-video w-full rounded-md bg-muted"
          src={mediaUrl}
          controls
          playsInline
        />
      ) : mediaUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaUrl}
          alt={info.title || "Información de la compañía"}
          className="w-full rounded-md object-cover"
        />
      ) : info.hasMedia ? (
        <Skeleton className="aspect-video w-full" />
      ) : null}
      {info.title ? (
        <div>
          <p className="font-medium">{info.title}</p>
          {info.description ? (
            <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
              {info.description}
            </p>
          ) : null}
        </div>
      ) : canManage ? (
        <p className="text-sm text-muted-foreground">
          Agrega un título para publicar este contenido en Inicio.
        </p>
      ) : null}
    </div>
  );
}
