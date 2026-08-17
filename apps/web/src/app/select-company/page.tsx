"use client";

import { Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { platformCompaniesRequest } from "@/lib/api/auth";
import { getErrorMessage } from "@/lib/api/errors";

export default function SelectCompanyPage() {
  const router = useRouter();
  const {
    status,
    user,
    companies,
    selectCompany,
    logout,
    setPlatformCompanies,
  } = useSession();
  const [platformError, setPlatformError] = useState<string | null>(null);
  const [platformFetchFinished, setPlatformFetchFinished] = useState(false);
  const loadingPlatform =
    Boolean(user?.isPlatformOwner) &&
    companies.length === 0 &&
    !platformFetchFinished &&
    platformError === null;

  useEffect(() => {
    if (status === "loading") return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!user.isPlatformOwner || companies.length > 0) return;

    let cancelled = false;
    void platformCompaniesRequest()
      .then((list) => {
        if (cancelled) return;
        setPlatformCompanies(list);
        setPlatformError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPlatformError(
          getErrorMessage(err, "No se pudieron cargar las compañías"),
        );
      })
      .finally(() => {
        if (!cancelled) setPlatformFetchFinished(true);
      });
    return () => {
      cancelled = true;
    };
  }, [status, user, companies.length, router, setPlatformCompanies]);

  if (status === "loading" || !user || loadingPlatform) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-4 p-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (platformError) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center p-6">
        <EmptyState
          title="No se pudieron cargar compañías"
          description={platformError}
          action={
            <Button type="button" variant="outline" onClick={() => router.refresh()}>
              Reintentar
            </Button>
          }
        />
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center p-6">
        <EmptyState
          title="Sin compañías activas"
          description={
            user.isPlatformOwner
              ? "No hay compañías activas en la plataforma."
              : "Tu usuario no tiene memberships activas. Contacta a un administrador."
          }
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void logout().then(() => router.replace("/login"));
              }}
            >
              Cerrar sesión
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-8 p-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">Talento</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Selecciona una compañía
        </h1>
        <p className="text-sm text-muted-foreground">
          Hola {user.firstName}, elige el contexto con el que quieres trabajar.
          {user.isPlatformOwner
            ? " Como Platform Owner puedes entrar a cualquier compañía activa."
            : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {companies.map((company) => (
          <button
            key={company.id}
            type="button"
            className="text-left focus-visible:outline-none"
            onClick={() => {
              selectCompany(company.id);
              router.push("/dashboard");
            }}
          >
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                <div className="rounded-md bg-muted p-2">
                  <Building2 className="h-4 w-4" aria-hidden />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-base">{company.name}</CardTitle>
                  <CardDescription>{company.slug}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <span className="text-xs text-muted-foreground">
                  Continuar al dashboard
                </span>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      {user.isPlatformOwner ? (
        <Button
          type="button"
          variant="ghost"
          className="self-start"
          onClick={() => router.push("/platform")}
        >
          Volver a Platform
        </Button>
      ) : null}
    </div>
  );
}
