"use client";

import { Building2 } from "lucide-react";
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
import {
  platformCompaniesRequest,
  platformMeRequest,
} from "@/lib/api/auth";
import { getErrorMessage } from "@/lib/api/errors";
import type { PlatformMeResponse, PublicCompany } from "@/types/auth";

export default function PlatformPage() {
  return (
    <AuthGuard requireCompany={false} requirePlatformOwner>
      <PlatformContent />
    </AuthGuard>
  );
}

function PlatformContent() {
  const router = useRouter();
  const { user, logout, selectCompany, setPlatformCompanies } = useSession();
  const [data, setData] = useState<PlatformMeResponse | null>(null);
  const [companies, setCompanies] = useState<PublicCompany[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [me, companyList] = await Promise.all([
          platformMeRequest(),
          platformCompaniesRequest(),
        ]);
        if (cancelled) return;
        setData(me);
        setCompanies(companyList);
        setPlatformCompanies(companyList);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(getErrorMessage(err, "No se pudo cargar la consola platform"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [setPlatformCompanies]);

  function enterCompany(companyId: string) {
    selectCompany(companyId);
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border px-4 sm:px-6">
        <div>
          <p className="text-sm font-semibold">Talento</p>
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

      <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 sm:px-6">
        <PageHeader
          title="Administración global"
          description="Puedes entrar a cualquier compañía activa. Los usuarios de tenant solo ven las suyas."
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
              void Promise.all([
                platformMeRequest(),
                platformCompaniesRequest(),
              ])
                .then(([me, companyList]) => {
                  setData(me);
                  setCompanies(companyList);
                  setPlatformCompanies(companyList);
                  setLoading(false);
                })
                .catch((err: unknown) => {
                  setError(
                    getErrorMessage(err, "No se pudo cargar la consola platform"),
                  );
                  setLoading(false);
                });
            }}
          />
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Identidad</CardTitle>
                <CardDescription>GET /platform/me</CardDescription>
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

            <div className="space-y-3">
              <div>
                <h2 className="text-base font-semibold">Entrar a una compañía</h2>
                <p className="text-sm text-muted-foreground">
                  Acceso completo al tenant sin membership (auditoría vía
                  Platform Owner).
                </p>
              </div>
              {companies.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-sm text-muted-foreground">
                    No hay compañías activas.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {companies.map((company) => (
                    <button
                      key={company.id}
                      type="button"
                      className="text-left focus-visible:outline-none"
                      onClick={() => enterCompany(company.id)}
                    >
                      <Card className="h-full transition-colors hover:border-primary/40">
                        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                          <div className="rounded-md bg-muted p-2">
                            <Building2 className="h-4 w-4" aria-hidden />
                          </div>
                          <div className="space-y-1">
                            <CardTitle className="text-base">
                              {company.name}
                            </CardTitle>
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
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
