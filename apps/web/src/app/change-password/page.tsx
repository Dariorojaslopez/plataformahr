"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useSession } from "@/components/auth/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/api/errors";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { status, user, companies, changePassword } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
    if (status === "authenticated" && user && !user.mustChangePassword) {
      router.replace(user.isPlatformOwner ? "/platform" : "/select-company");
    }
  }, [status, user, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (newPassword.length < 12) {
      setError("La nueva contraseña debe tener al menos 12 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    setPending(true);
    try {
      const updated = await changePassword(currentPassword, newPassword);
      if (updated.isPlatformOwner) router.replace("/platform");
      else if (companies.length === 1) router.replace("/dashboard");
      else router.replace("/select-company");
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo cambiar la contraseña."));
    } finally {
      setPending(false);
    }
  }

  if (status === "loading" || !user) return null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-6 py-12">
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-5 rounded-xl border bg-card p-6"
      >
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">Talento</p>
          <h1 className="text-2xl font-semibold">Cambia tu contraseña</h1>
          <p className="text-sm text-muted-foreground">
            La contraseña temporal debe reemplazarse antes de continuar.
          </p>
        </div>
        <PasswordField
          id="current-password"
          label="Contraseña temporal"
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
        />
        <PasswordField
          id="new-password"
          label="Nueva contraseña"
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
        />
        <PasswordField
          id="confirm-password"
          label="Confirmar nueva contraseña"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button className="w-full" type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Cambiar contraseña"}
        </Button>
      </form>
    </main>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        required
        minLength={id === "current-password" ? 1 : 12}
        maxLength={256}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
