import type { Metadata } from "next";
import { DM_Sans, Plus_Jakarta_Sans } from "next/font/google";
import { LoginForm } from "@/components/auth/login-form";
import { PLATFORM_BRAND_PRIMARY } from "@/lib/company/brand-tokens";
import "./login.css";

const loginDisplay = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-login-display",
  weight: ["500", "600", "700", "800"],
});

const loginBody = DM_Sans({
  subsets: ["latin"],
  variable: "--font-login-body",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

export default function LoginPage() {
  return (
    <div
      className={`${loginDisplay.variable} ${loginBody.variable} login-shell grid min-h-screen lg:grid-cols-[1.15fr_0.85fr]`}
    >
      <section className="login-hero login-hero-sheen relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="login-hero-grid absolute inset-0" aria-hidden />
        <div className="login-hero-slash absolute inset-0" aria-hidden />

        <p className="login-brand login-rise relative max-w-[95%] text-[clamp(1.75rem,4.2vw,2.85rem)] font-semibold leading-none tracking-[-0.02em]">
          Talentgrowthos
        </p>

        <div className="relative max-w-xl space-y-5">
          <h1 className="login-rise login-rise-delay-1 text-[clamp(1.85rem,3.1vw,2.75rem)] font-semibold leading-[1.12] tracking-[-0.02em]">
            Contrata más rápido.
            <span className="block text-white/70">Evalúa con criterio.</span>
          </h1>
          <p className="login-rise login-rise-delay-2 max-w-md text-base leading-relaxed text-white/75 sm:text-lg">
            La plataforma de RRHH que ordena organización, selección y
            performance para equipos que venden resultados, no procesos.
          </p>
        </div>

        <p className="login-rise login-rise-delay-3 relative text-xs font-medium uppercase tracking-[0.16em] text-white/45">
          Multi-tenant · Acceso seguro por compañía
        </p>
      </section>

      <section className="login-panel relative flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="relative w-full max-w-[26rem] space-y-8">
          <div className="space-y-3 lg:hidden">
            <p className="login-brand text-2xl font-semibold tracking-[-0.02em] text-[var(--login-ink)] sm:text-3xl">
              Talentgrowthos
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--login-ink)]">
              Entra y opera
            </h1>
          </div>

          <div className="hidden space-y-3 lg:block">
            <p
              className="text-xs font-semibold uppercase tracking-[0.18em]"
              style={{ color: PLATFORM_BRAND_PRIMARY }}
            >
              Acceso
            </p>
            <h1 className="text-3xl font-semibold tracking-[-0.02em] text-[var(--login-ink)]">
              Bienvenido de nuevo
            </h1>
            <p className="text-[0.95rem] leading-relaxed text-black/55">
              Usa tu email corporativo. En segundos estás dentro del ciclo de
              talento.
            </p>
          </div>

          <LoginForm aggressive />
        </div>
      </section>
    </div>
  );
}
