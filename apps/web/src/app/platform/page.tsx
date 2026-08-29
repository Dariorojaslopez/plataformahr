"use client";

import {
  Building2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  Plus,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import {
  COMPANY_STANDARD_ACCESS_CATALOG,
  splitCompanyAccess,
  type CompanyFeatureCode,
  type CompanyModuleCode,
} from "@talento/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useSession } from "@/components/auth/session-provider";
import { PlatformBillingSection } from "@/components/platform/platform-billing-section";
import { PlatformConfigShortcuts } from "@/components/platform/platform-config-shortcuts";
import { PlatformPremiumSection } from "@/components/platform/platform-premium-section";
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
  updateManagedCompanyFeaturesRequest,
  resetManagedCompanyAdminPasswordRequest,
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
  initialPassword: "",
  enabledModules: [],
  enabledFeatures: [],
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
        initialPassword: form.initialPassword?.trim() || undefined,
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
          description="Configura compañías, opciones premium y facturación. Entra a un tenant para organización, ATS, performance y sistema."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href="/platform/superadmins">
                  <ShieldCheck className="size-4" />
                  Superadministradores
                </Link>
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="size-4" />
                    Nueva compañía
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-hidden p-0">
                  <form
                    onSubmit={createCompany}
                    className="flex max-h-[90vh] min-h-0 flex-col"
                  >
                    <DialogHeader className="mb-0 shrink-0 px-6 pb-4 pt-6 pr-12">
                    <DialogTitle>Crear compañía</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                      Se creará también el administrador inicial y una contraseña temporal.
                    </p>
                  </DialogHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-1">
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
                      <div className="mt-4">
                        <PasswordControl
                          id="initial-password"
                          label="Contraseña inicial"
                          value={form.initialPassword ?? ""}
                          onChange={(initialPassword) =>
                            setForm((value) => ({
                              ...value,
                              initialPassword,
                            }))
                          }
                          help="Puedes escribirla o generar una segura. Si queda vacía, el servidor generará una."
                        />
                      </div>
                      <div className="my-5">
                        <AccessSelector
                          enabledModules={form.enabledModules}
                          enabledFeatures={form.enabledFeatures}
                          onChange={(enabledModules, enabledFeatures) =>
                            setForm((value) => ({
                              ...value,
                              enabledModules,
                              enabledFeatures,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <DialogFooter className="mt-0 shrink-0 border-t bg-card px-6 pb-6 pt-4">
                    <Button type="submit" disabled={pending}>
                      {pending ? "Creando…" : "Crear compañía"}
                    </Button>
                  </DialogFooter>
                </form>
                </DialogContent>
              </Dialog>
            </div>
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

        <PlatformConfigShortcuts />
        {loading ? null : (
          <PlatformPremiumSection
            companies={companies}
            onSaved={refreshCompanies}
          />
        )}
        <PlatformBillingSection />

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
                  <p className="text-xs text-muted-foreground">
                    {company.enabledModules.length} módulos activos
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
                    <CompanyAccessDialog
                      company={company}
                      onSaved={refreshCompanies}
                    />
                    <ResetAdminPasswordDialog company={company} />
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

function ResetAdminPasswordDialog({ company }: { company: ManagedCompany }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await resetManagedCompanyAdminPasswordRequest(company.id, password);
      setChanged(true);
      notifySuccess("Contraseña restablecida y sesiones revocadas");
    } catch (err) {
      notifyError(err, "No se pudo restablecer la contraseña.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setPassword("");
          setChanged(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={!company.initialAdmin}
        >
          <KeyRound className="size-4" />
          Cambiar contraseña
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contraseña del administrador inicial</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {company.initialAdmin?.email}. La contraseña anterior no puede
            consultarse; esta nueva credencial se mostrará únicamente aquí.
          </p>
        </DialogHeader>
        <PasswordControl
          id={`reset-password-${company.id}`}
          label="Nueva contraseña temporal"
          value={password}
          onChange={(value) => {
            setPassword(value);
            setChanged(false);
          }}
          help="Al guardar se revocarán las sesiones y deberá cambiarla al ingresar."
        />
        {changed ? (
          <div className="rounded-md border border-success/40 p-3 text-sm">
            <p className="font-medium">Contraseña actualizada</p>
            <p className="mt-1 break-all font-mono">{password}</p>
            <Button
              className="mt-3"
              size="sm"
              variant="outline"
              onClick={() =>
                void navigator.clipboard
                  .writeText(password)
                  .then(() => notifySuccess("Contraseña copiada"))
              }
            >
              <Copy className="size-4" />
              Copiar
            </Button>
          </div>
        ) : null}
        <DialogFooter>
          <Button
            disabled={saving || password.length < 12 || changed}
            onClick={() => void save()}
          >
            {saving ? "Guardando…" : "Restablecer contraseña"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompanyAccessDialog({
  company,
  onSaved,
}: {
  company: ManagedCompany;
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [modules, setModules] = useState(company.enabledModules);
  const [features, setFeatures] = useState(company.enabledFeatures);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateManagedCompanyFeaturesRequest(company.id, {
        enabledModules: modules,
        enabledFeatures: features,
      });
      await onSaved();
      setOpen(false);
      notifySuccess("Accesos actualizados");
    } catch (err) {
      notifyError(err, "No se pudieron actualizar los accesos.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          const split = splitCompanyAccess(
            company.enabledModules,
            company.enabledFeatures,
          );
          setModules(split.modules);
          setFeatures(split.features);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Settings2 className="size-4" />
          Configurar accesos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Accesos de {company.name}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Los cambios afectan el menú y la autorización de la API.
          </p>
        </DialogHeader>
        <AccessSelector
          enabledModules={modules}
          enabledFeatures={features}
          onChange={(nextModules, nextFeatures) => {
            setModules(nextModules);
            setFeatures(nextFeatures);
          }}
        />
        <DialogFooter>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? "Guardando…" : "Guardar accesos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PasswordControl({
  id,
  label,
  value,
  onChange,
  help,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  help: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id={id}
            type={visible ? "text" : "password"}
            minLength={12}
            maxLength={256}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? "Ocultar contraseña" : "Ver contraseña"}
          >
            {visible ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            onChange(generateTemporaryPassword());
            setVisible(true);
          }}
        >
          Generar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{help}</p>
    </div>
  );
}

function generateTemporaryPassword(): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function AccessSelector({
  enabledModules,
  enabledFeatures,
  onChange,
}: {
  enabledModules: CompanyModuleCode[];
  enabledFeatures: CompanyFeatureCode[];
  onChange: (
    modules: CompanyModuleCode[],
    features: CompanyFeatureCode[],
  ) => void;
}) {
  const modules = new Set(enabledModules);
  const features = new Set(enabledFeatures);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Módulos y opciones</p>
        <p className="text-xs text-muted-foreground">
          Inicio permanece disponible como función básica.
        </p>
      </div>
      {COMPANY_STANDARD_ACCESS_CATALOG.map((module) => {
        const moduleEnabled = modules.has(module.code);
        return (
          <div key={module.code} className="rounded-md border p-3">
            <label className="flex cursor-pointer items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={moduleEnabled}
                onChange={(event) => {
                  const nextModules = new Set(modules);
                  const nextFeatures = new Set(features);
                  if (event.target.checked) {
                    nextModules.add(module.code);
                    module.features.forEach(({ code }) =>
                      nextFeatures.add(code),
                    );
                  } else {
                    nextModules.delete(module.code);
                    module.features.forEach(({ code }) =>
                      nextFeatures.delete(code),
                    );
                  }
                  onChange([...nextModules], [...nextFeatures]);
                }}
              />
              {module.label}
            </label>
            {moduleEnabled ? (
              <div className="mt-3 grid gap-2 pl-6 sm:grid-cols-2">
                {module.features.map((feature) => (
                  <label
                    key={feature.code}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={features.has(feature.code)}
                      onChange={(event) => {
                        const next = new Set(features);
                        if (event.target.checked) next.add(feature.code);
                        else next.delete(feature.code);
                        onChange([...modules], [...next]);
                      }}
                    />
                    {feature.label}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
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
