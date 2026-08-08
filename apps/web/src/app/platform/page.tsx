"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useSession } from "@/components/auth/session-provider";
import { ThemeToggleButton } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { platformMeRequest } from "@/lib/api/auth";
import { getErrorMessage } from "@/lib/api/errors";
import type { PlatformMeResponse } from "@/types/auth";

export default function PlatformPage() {
  return (
    <AuthGuard requireCompany={false} requirePlatformOwner>
      <PlatformContent />
    </AuthGuard>
  );
}

function PlatformContent() {
  const router = useRouter();
  const { user, logout } = useSession();
  const [data, setData] = useState<PlatformMeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const me = await platformMeRequest();
        if (cancelled) return;
        setData(me);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(getErrorMessage(err, "No se pudo cargar /platform/me"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border px-4 sm:px-6">
        <div>
          <p className="text-sm font-semibold">Talento Sin Clave</p>
          <p className="text-xs text-muted-foreground">Platform Owner</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggleButton />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void logout().then(() => router.replace("/login"));
            }}
          >
            Cerrar sesión
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <PageHeader
          title="Administración global"
          description="Espacio separado del tenant. Sin proxy ni impersonación en esta fase."
        />

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : error ? (
          <ErrorState
            description={error}
            onRetry={() => {
              setLoading(true);
              setError(null);
              void platformMeRequest()
                .then((me) => {
                  setData(me);
                  setLoading(false);
                })
                .catch((err: unknown) => {
                  setError(
                    getErrorMessage(err, "No se pudo cargar /platform/me"),
                  );
                  setLoading(false);
                });
            }}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identidad</CardTitle>
              <CardDescription>Respuesta de GET /platform/me</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Nombre: </span>
                {data?.firstName} {data?.lastName}
              </p>
              <p>
                <span className="text-muted-foreground">Email: </span>
                {data?.email ?? user?.email}
              </p>
              <p>
                <span className="text-muted-foreground">Platform Owner: </span>
                {data?.isPlatformOwner ? "Sí" : "No"}
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
