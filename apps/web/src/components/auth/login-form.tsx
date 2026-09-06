"use client";

import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { getErrorMessage, useSession } from "@/components/auth/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/errors";

export function LoginForm({ aggressive = false }: { aggressive?: boolean }) {
  const router = useRouter();
  const { login } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Completa email y contraseña.");
      return;
    }
    if (!trimmedEmail.includes("@")) {
      setError("Ingresa un email válido.");
      return;
    }

    setLoading(true);
    try {
      const result = await login(trimmedEmail, password);
      if (result.user.mustChangePassword) {
        router.replace("/change-password");
        return;
      }
      if (result.user.isPlatformOwner) {
        router.replace("/platform");
        return;
      }
      if (result.companies.length === 1) {
        router.replace("/dashboard");
        return;
      }
      if (result.companies.length > 1) {
        router.replace("/select-company");
        return;
      }
      router.replace("/select-company");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Credenciales incorrectas.");
      } else {
        setError(getErrorMessage(err, "No se pudo iniciar sesión."));
      }
    } finally {
      setLoading(false);
    }
  }

  const fieldClass = aggressive
    ? "h-12 border-black/15 bg-white text-[var(--login-ink,#041110)] shadow-none placeholder:text-black/35 focus-visible:ring-[var(--login-teal,#0f5c5a)]"
    : undefined;

  return (
    <form
      className={aggressive ? "space-y-6" : "space-y-5"}
      method="post"
      action="#"
      onSubmit={onSubmit}
      noValidate
      autoComplete="on"
    >
      <div className="space-y-2">
        <Label
          htmlFor="email"
          className={
            aggressive
              ? "text-[0.8rem] font-semibold tracking-wide text-black/70"
              : undefined
          }
        >
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tu@empresa.com"
          className={fieldClass}
          required
        />
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="password"
          className={
            aggressive
              ? "text-[0.8rem] font-semibold tracking-wide text-black/70"
              : undefined
          }
        >
          Contraseña
        </Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={aggressive ? `${fieldClass} pr-11` : "pr-10"}
            required
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className={
              aggressive
                ? "text-sm font-medium text-[var(--login-teal,#0f5c5a)] hover:underline"
                : "text-sm text-primary hover:underline"
            }
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        size={aggressive ? "lg" : "default"}
        className={
          aggressive
            ? "h-12 w-full text-base font-semibold tracking-wide transition-transform hover:-translate-y-0.5 active:translate-y-0"
            : "w-full"
        }
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Entrando…
          </>
        ) : aggressive ? (
          "Entrar a Talentgrowthos"
        ) : (
          "Iniciar sesión"
        )}
      </Button>
    </form>
  );
}
