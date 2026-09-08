"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordRequest } from "@/lib/api/auth";
import { getErrorMessage } from "@/lib/api/errors";
import { PLATFORM_BRAND_PRIMARY } from "@/lib/company/brand-tokens";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      setError("Ingresa un email válido.");
      return;
    }
    setLoading(true);
    try {
      await forgotPasswordRequest(trimmed);
      setSent(true);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "No se pudo procesar la solicitud. Intenta de nuevo.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f1eb] px-6 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-3">
          <p
            className="text-sm font-semibold tracking-[-0.02em]"
            style={{ color: PLATFORM_BRAND_PRIMARY }}
          >
            Talentgrowthos
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#041110]">
            Recuperar contraseña
          </h1>
          <p className="text-sm leading-relaxed text-black/55">
            Te enviaremos una contraseña temporal a tu correo corporativo. Al
            entrar deberás cambiarla. Si no llega, un administrador puede
            generarte una desde Colaboradores.
          </p>
        </div>

        {sent ? (
          <div className="space-y-5 rounded-lg border border-black/10 bg-white p-5">
            <p className="text-sm leading-relaxed text-[#041110]">
              Si el email está registrado y el correo está configurado,
              recibirás una contraseña temporal en unos minutos. Revisa también
              spam. Si no llega, pide a un administrador que te genere el
              acceso desde Colaboradores.
            </p>
            <Button asChild className="w-full">
              <Link href="/login">Volver a iniciar sesión</Link>
            </Button>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={onSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-black/70">
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
                className="h-12 border-black/15 bg-white"
                required
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="h-12 w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Enviando…
                </>
              ) : (
                "Enviar contraseña temporal"
              )}
            </Button>
            <p className="text-center text-sm text-black/55">
              <Link href="/login" className="font-medium text-primary hover:underline">
                Volver al login
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
