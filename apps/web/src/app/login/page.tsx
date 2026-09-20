import type { Metadata } from "next";
import { DM_Sans, Plus_Jakarta_Sans } from "next/font/google";
import {
  LoginHeroCopy,
  LoginHeroFooter,
  LoginLanguageBar,
  LoginMobileIntro,
  LoginWelcomeCopy,
} from "@/components/auth/login-copy";
import { LoginForm } from "@/components/auth/login-form";
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
          <LoginHeroCopy />
        </div>

        <LoginHeroFooter />
      </section>

      <section className="login-panel relative flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="relative w-full max-w-[26rem] space-y-8">
          <LoginLanguageBar />
          <LoginMobileIntro />
          <LoginWelcomeCopy />
          <LoginForm aggressive />
        </div>
      </section>
    </div>
  );
}
