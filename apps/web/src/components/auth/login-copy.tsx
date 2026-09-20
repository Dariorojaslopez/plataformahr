"use client";

import { PLATFORM_BRAND_PRIMARY } from "@/lib/company/brand-tokens";
import { LanguageSwitcher } from "@/i18n/language-switcher";
import { useT } from "@/i18n/locale-provider";

export function LoginHeroCopy() {
  const t = useT();
  return (
    <>
      <h1 className="login-rise login-rise-delay-1 text-[clamp(1.85rem,3.1vw,2.75rem)] font-semibold leading-[1.12] tracking-[-0.02em]">
        {t("Contrata más rápido.")}
        <span className="block text-white/70">{t("Evalúa con criterio.")}</span>
      </h1>
      <p className="login-rise login-rise-delay-2 max-w-md text-base leading-relaxed text-white/75 sm:text-lg">
        {t(
          "La plataforma de RRHH que ordena organización, selección y performance para equipos que venden resultados, no procesos.",
        )}
      </p>
    </>
  );
}

export function LoginHeroFooter() {
  const t = useT();
  return (
    <p className="login-rise login-rise-delay-3 relative text-xs font-medium uppercase tracking-[0.16em] text-white/45">
      {t("Multi-tenant · Acceso seguro por compañía")}
    </p>
  );
}

export function LoginMobileIntro() {
  const t = useT();
  return (
    <div className="space-y-3 lg:hidden">
      <p className="login-brand text-2xl font-semibold tracking-[-0.02em] text-[var(--login-ink)] sm:text-3xl">
        Talentgrowthos
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--login-ink)]">
        {t("Entra y opera")}
      </h1>
    </div>
  );
}

export function LoginWelcomeCopy() {
  const t = useT();
  return (
    <div className="hidden space-y-3 lg:block">
      <p
        className="text-xs font-semibold uppercase tracking-[0.18em]"
        style={{ color: PLATFORM_BRAND_PRIMARY }}
      >
        {t("Acceso")}
      </p>
      <h1 className="text-3xl font-semibold tracking-[-0.02em] text-[var(--login-ink)]">
        {t("Bienvenido de nuevo")}
      </h1>
      <p className="text-[0.95rem] leading-relaxed text-black/55">
        {t(
          "Usa tu email corporativo. En segundos estás dentro del ciclo de talento.",
        )}
      </p>
    </div>
  );
}

export function LoginLanguageBar() {
  return (
    <div className="flex justify-end">
      <LanguageSwitcher />
    </div>
  );
}
