"use client";

import { ArrowLeft, Copy, KeyRound, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
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
  createPlatformOwnerRequest,
  platformOwnersRequest,
  resetPlatformOwnerPasswordRequest,
  updatePlatformOwnerRequest,
} from "@/lib/api/auth";
import { getErrorMessage } from "@/lib/api/errors";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type {
  CreatePlatformOwnerInput,
  ManagedPlatformOwner,
} from "@/types/auth";

const emptyForm: CreatePlatformOwnerInput = {
  firstName: "",
  lastName: "",
  email: "",
};

type TemporaryCredential = {
  email: string;
  password: string;
};

export default function PlatformOwnersPage() {
  return (
    <AuthGuard requireCompany={false} requirePlatformOwner>
      <PlatformOwnersAdministration />
    </AuthGuard>
  );
}

function PlatformOwnersAdministration() {
  const { user } = useSession();
  const [owners, setOwners] = useState<ManagedPlatformOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [pending, setPending] = useState(false);
  const [credential, setCredential] =
    useState<TemporaryCredential | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOwners(await platformOwnersRequest());
      setError(null);
    } catch (err) {
      setError(
        getErrorMessage(err, "No se pudieron cargar los superadministradores."),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void platformOwnersRequest()
      .then((items) => {
        if (!cancelled) setOwners(items);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            getErrorMessage(
              err,
              "No se pudieron cargar los superadministradores.",
            ),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function createOwner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      const created = await createPlatformOwnerRequest(form);
      setCredential({
        email: created.owner.email,
        password: created.temporaryPassword,
      });
      setDialogOpen(false);
      setForm(emptyForm);
      await load();
      notifySuccess("Superadministrador creado");
    } catch (err) {
      notifyError(err, "No se pudo crear el superadministrador.");
    } finally {
      setPending(false);
    }
  }

  async function resetPassword(owner: ManagedPlatformOwner) {
    try {
      const result = await resetPlatformOwnerPasswordRequest(owner.id);
      setCredential({ email: owner.email, password: result.temporaryPassword });
      await load();
      notifySuccess("Contraseña temporal generada");
    } catch (err) {
      notifyError(err, "No se pudo restablecer la contraseña.");
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <Button variant="ghost" asChild>
        <Link href="/platform">
          <ArrowLeft className="size-4" />
          Volver a compañías
        </Link>
      </Button>
      <PageHeader
        title="Superadministradores"
        description="Administra identidades globales. Las contraseñas temporales se muestran una sola vez."
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" />
                Nuevo superadministrador
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={createOwner}>
                <DialogHeader>
                  <DialogTitle>Crear superadministrador</DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    Tendrá acceso global y deberá cambiar su contraseña al entrar.
                  </p>
                </DialogHeader>
                <div className="space-y-4">
                  <Field
                    id="owner-first-name"
                    label="Nombres"
                    value={form.firstName}
                    onChange={(firstName) =>
                      setForm((current) => ({ ...current, firstName }))
                    }
                  />
                  <Field
                    id="owner-last-name"
                    label="Apellidos"
                    value={form.lastName}
                    onChange={(lastName) =>
                      setForm((current) => ({ ...current, lastName }))
                    }
                  />
                  <Field
                    id="owner-email"
                    label="Email"
                    type="email"
                    value={form.email}
                    onChange={(email) =>
                      setForm((current) => ({ ...current, email }))
                    }
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={pending}>
                    {pending ? "Creando…" : "Crear"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {credential ? (
        <Card className="border-success/40">
          <CardHeader>
            <CardTitle className="text-base">Credencial temporal</CardTitle>
            <CardDescription>
              Cópiala ahora y entrégala por un canal seguro.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1 text-sm">
              <p>{credential.email}</p>
              <p className="break-all font-mono">{credential.password}</p>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                void navigator.clipboard
                  .writeText(credential.password)
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
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={() => void load()} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {owners.map((owner) => (
            <OwnerCard
              key={owner.id}
              owner={owner}
              isSelf={owner.id === user?.id}
              onReload={load}
              onResetPassword={resetPassword}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function OwnerCard({
  owner,
  isSelf,
  onReload,
  onResetPassword,
}: {
  owner: ManagedPlatformOwner;
  isSelf: boolean;
  onReload: () => Promise<void>;
  onResetPassword: (owner: ManagedPlatformOwner) => Promise<void>;
}) {
  const [firstName, setFirstName] = useState(owner.firstName);
  const [lastName, setLastName] = useState(owner.lastName);
  const [email, setEmail] = useState(owner.email);
  const [pending, setPending] = useState(false);
  const [demoteOpen, setDemoteOpen] = useState(false);

  async function update(body: Parameters<typeof updatePlatformOwnerRequest>[1]) {
    setPending(true);
    try {
      await updatePlatformOwnerRequest(owner.id, body);
      await onReload();
      setDemoteOpen(false);
      notifySuccess("Superadministrador actualizado");
    } catch (err) {
      notifyError(err, "No se pudo actualizar el superadministrador.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <div className="rounded-md bg-muted p-2">
          <ShieldCheck className="size-4" />
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">
              {owner.firstName} {owner.lastName}
              {isSelf ? " (Tú)" : ""}
            </CardTitle>
            <Badge variant={owner.status === "ACTIVE" ? "success" : "warning"}>
              {owner.status === "ACTIVE" ? "Activo" : owner.status}
            </Badge>
          </div>
          <CardDescription>
            {owner.mustChangePassword
              ? "Cambio de contraseña pendiente"
              : "Credencial vigente"}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            id={`first-${owner.id}`}
            label="Nombres"
            value={firstName}
            onChange={setFirstName}
          />
          <Field
            id={`last-${owner.id}`}
            label="Apellidos"
            value={lastName}
            onChange={setLastName}
          />
        </div>
        <Field
          id={`email-${owner.id}`}
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() => void update({ firstName, lastName, email })}
          >
            Guardar
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending || isSelf}
            onClick={() => void onResetPassword(owner)}
          >
            <KeyRound className="size-4" />
            Restablecer contraseña
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending || isSelf}
            onClick={() =>
              void update({
                status: owner.status === "ACTIVE" ? "BLOCKED" : "ACTIVE",
              })
            }
          >
            {owner.status === "ACTIVE" ? "Bloquear" : "Activar"}
          </Button>
          <Dialog open={demoteOpen} onOpenChange={setDemoteOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="destructive"
                disabled={pending || isSelf}
              >
                Quitar superadmin
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Quitar privilegios globales</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {owner.firstName} perderá inmediatamente el acceso de
                  superadministrador y se revocarán sus sesiones activas.
                </p>
              </DialogHeader>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDemoteOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => void update({ isPlatformOwner: false })}
                >
                  Confirmar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email";
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        required
        maxLength={type === "email" ? 255 : 100}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
