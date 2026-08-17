"use client";

import { Building2, Copy, LogIn, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useSession } from "@/components/auth/session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createManagedCompanyRequest,
  grantPlatformTenantAccessRequest,
  managedCompaniesRequest,
  platformCompaniesRequest,
  updateManagedCompanyStatusRequest,
} from "@/lib/api/auth";
import { getErrorMessage } from "@/lib/api/errors";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type {
  CreateManagedCompanyInput,
  CreateManagedCompanyResponse,
  ManagedCompany,
} from "@/types/auth";

const emptyForm: CreateManagedCompanyInput = {
  name: "",
  legalName: "",
  slug: "",
  adminFirstName: "",
  adminLastName: "",
  adminEmail: "",
};

export default function PlatformPage() {
  return (
    <AuthGuard requireCompany={false} requirePlatformOwner>
      <PlatformAdministration />
    </AuthGuard>
  );
}

function PlatformAdministration() {
  const router = useRouter();
  const { user, logout, selectCompany, setPlatformCompanies } = useSession();
  const [companies, setCompanies] = useState<ManagedCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [pending, setPending] = useState(false);
  const [credentials, setCredentials] =
    useState<CreateManagedCompanyResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCompanies(await managedCompaniesRequest());
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudieron cargar las compañías."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void managedCompaniesRequest()
      .then((items) => {
        if (cancelled) return;
        setCompanies(items);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getErrorMessage(err, "No se pudieron cargar las compañías."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function createCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      const created = await createManagedCompanyRequest({
        ...form,
        legalName: form.legalName?.trim() || undefined,
      });
      setCredentials(created);
      setForm(emptyForm);
      setDialogOpen(false);
      await refreshCompanies();
      notifySuccess("Compañía y administrador creados");
    } catch (err) {
      notifyError(err, "No se pudo crear la compañía.");
    } finally {
      setPending(false);
    }
  }

  async function refreshCompanies() {
    const [managed, active] = await Promise.all([
      managedCompaniesRequest(),
      platformCompaniesRequest(),
    ]);
    setCompanies(managed);
    setPlatformCompanies(active);
  }

  async function enterCompany(companyId: string) {
    try {
      await grantPlatformTenantAccessRequest(companyId);
      const active = await platformCompaniesRequest();
      setPlatformCompanies(active);
      selectCompany(companyId);
      router.push("/dashboard");
    } catch (err) {
      notifyError(err, "No se pudo entrar a la compañía.");
    }
  }

  async function toggleStatus(company: ManagedCompany) {
    const next = company.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      await updateManagedCompanyStatusRequest(company.id, next);
      await refreshCompanies();
      notifySuccess(next === "ACTIVE" ? "Compañía activada" : "Compañía suspendida");
    } catch (err) {
      notifyError(err, "No se pudo actualizar la compañía.");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-14 items-center justify-between border-b px-4 sm:px-6">
        <div>
          <p className="text-sm font-semibold">Talento</p>
          <p className="text-xs text-muted-foreground">
            Superadministración · {user?.firstName}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void logout().then(() => router.replace("/login"))}
        >
          Cerrar sesión
        </Button>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <PageHeader
          title="Administración global"
          description="Crea compañías, entrega el acceso inicial y entra con una membresía CLIENT_ADMIN real."
          actions={
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" />
                  Nueva compañía
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={createCompany}>
                  <DialogHeader>
                    <DialogTitle>Crear compañía</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                      Se creará también el administrador inicial y una contraseña temporal.
                    </p>
                  </DialogHeader>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      id="company-name"
                      label="Nombre comercial"
                      value={form.name}
                      onChange={(name) => setForm((v) => ({ ...v, name }))}
                    />
                    <Field
                      id="company-legal-name"
                      label="Razón social"
                      required={false}
                      value={form.legalName ?? ""}
                      onChange={(legalName) =>
                        setForm((v) => ({ ...v, legalName }))
                      }
                    />
                    <Field
                      id="company-slug"
                      label="Identificador"
                      value={form.slug}
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      onChange={(slug) =>
                        setForm((v) => ({
                          ...v,
                          slug: slug.toLowerCase().replace(/\s+/g, "-"),
                        }))
                      }
                    />
                    <Field
                      id="admin-email"
                      label="Email administrador"
                      type="email"
                      value={form.adminEmail}
                      onChange={(adminEmail) =>
                        setForm((v) => ({ ...v, adminEmail }))
                      }
                    />
                    <Field
                      id="admin-first-name"
                      label="Nombres administrador"
                      value={form.adminFirstName}
                      onChange={(adminFirstName) =>
                        setForm((v) => ({ ...v, adminFirstName }))
                      }
                    />
                    <Field
                      id="admin-last-name"
                      label="Apellidos administrador"
                      value={form.adminLastName}
                      onChange={(adminLastName) =>
                        setForm((v) => ({ ...v, adminLastName }))
                      }
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={pending}>
                      {pending ? "Creando…" : "Crear compañía"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          }
        />

        {credentials ? (
          <Card className="border-success/40">
            <CardHeader>
              <CardTitle className="text-base">Acceso inicial generado</CardTitle>
              <CardDescription>
                Copia la contraseña ahora. No volverá a mostrarse y deberá cambiarse al iniciar sesión.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Email: </span>
                  {credentials.initialAdmin.email}
                </p>
                <p className="break-all font-mono">
                  <span className="font-sans text-muted-foreground">
                    Contraseña temporal:{" "}
                  </span>
                  {credentials.temporaryPassword}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(credentials.temporaryPassword)
                    .then(() => notifySuccess("Contraseña copiada"))
                }
              >
                <Copy className="size-4" />
                Copiar
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        ) : error ? (
          <ErrorState description={error} onRetry={() => void load()} />
        ) : companies.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No hay compañías. Crea la primera para comenzar.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {companies.map((company) => (
              <Card key={company.id}>
                <CardHeader className="flex-row items-start gap-3 space-y-0">
                  <div className="rounded-md bg-muted p-2">
                    <Building2 className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{company.name}</CardTitle>
                      <Badge
                        variant={
                          company.status === "ACTIVE" ? "success" : "warning"
                        }
                      >
                        {company.status === "ACTIVE" ? "Activa" : "Suspendida"}
                      </Badge>
                    </div>
                    <CardDescription>{company.slug}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Administrador inicial
                    </p>
                    <p>
                      {company.initialAdmin
                        ? `${company.initialAdmin.firstName} ${company.initialAdmin.lastName}`
                        : "Sin administrador asignado"}
                    </p>
                    <p className="text-muted-foreground">
                      {company.initialAdmin?.email ?? "—"}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {company.membershipCount} membresías
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={company.status !== "ACTIVE"}
                      onClick={() => void enterCompany(company.id)}
                    >
                      <LogIn className="size-4" />
                      Entrar como administrador
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void toggleStatus(company)}
                    >
                      {company.status === "ACTIVE" ? "Suspender" : "Activar"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = true,
  pattern,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email";
  required?: boolean;
  pattern?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        id={id}
        type={type}
        required={required}
        maxLength={type === "email" ? 255 : 160}
        pattern={pattern}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
