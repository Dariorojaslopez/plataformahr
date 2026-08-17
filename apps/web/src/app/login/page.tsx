import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { PLATFORM_BRAND_PRIMARY } from "@/lib/company/brand-tokens";

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section
        className="relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-12"
        style={{ backgroundColor: PLATFORM_BRAND_PRIMARY }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.08),transparent_35%)]" />
        <div className="relative">
          <p className="text-sm font-medium tracking-wide text-white/80">
            Talento
          </p>
        </div>
        <div className="relative max-w-md space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight">
            Gestiona el ciclo de talento con claridad.
          </h1>
          <p className="text-base leading-relaxed text-white/80">
            Organización, selección y performance en una experiencia sobria
            pensada para equipos de RRHH.
          </p>
        </div>
        <p className="relative text-xs text-white/60">
          Acceso seguro por compañía · Multi-tenant
        </p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2 lg:hidden">
            <p className="text-sm font-medium text-primary">Talento</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Inicia sesión
            </h1>
          </div>
          <div className="hidden space-y-2 lg:block">
            <h1 className="text-2xl font-semibold tracking-tight">
              Bienvenido de nuevo
            </h1>
            <p className="text-sm text-muted-foreground">
              Ingresa con tu email corporativo para continuar.
            </p>
          </div>
          <LoginForm />
        </div>
      </section>
    </div>
  );
}
