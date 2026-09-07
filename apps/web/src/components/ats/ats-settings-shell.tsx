"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/ats/settings/approvals", label: "Flujos aprobación" },
  { href: "/ats/settings/evaluators", label: "Niveles evaluación" },
  { href: "/ats/settings/active-processes", label: "Procesos activos" },
  { href: "/ats/settings/templates", label: "Plantillas" },
  {
    href: "/ats/settings/contract-approvers",
    label: "Aprobadores de contrato",
  },
] as const;

export function AtsSettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Panel de configuración global
          </h1>
          <p className="text-sm text-muted-foreground">
            Administración central de flujos, evaluaciones y procesos de
            selección.
          </p>
        </div>
        <Link
          href="/ats/pipeline"
          className="text-sm font-medium text-primary hover:underline"
        >
          ← Volver al tablero Kanban
        </Link>
      </div>
      <nav className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
