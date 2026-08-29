import { BriefcaseBusiness, Building2, Gauge, Palette } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";

const PLATFORM_CONFIG_SHORTCUTS = [
  {
    title: "Configuración de organización",
    description:
      "Estructura, cargos y personas. Entra a la compañía para administrarlos.",
    icon: Building2,
  },
  {
    title: "Configuración de ATS",
    description:
      "Flujos de selección, aprobaciones y plantillas de entrevista.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Configuración de performance",
    description: "Ciclos y periodos de objetivos.",
    icon: Gauge,
  },
  {
    title: "Configuración del sistema",
    description: "Apariencia y ajustes generales de cada compañía.",
    icon: Palette,
  },
] as const;

export function PlatformConfigShortcuts() {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Configuración</h2>
        <p className="text-sm text-muted-foreground">
          Usa Entrar como administrador para configurar cada compañía. Estas
          áreas viven dentro del tenant, no en la consola global.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {PLATFORM_CONFIG_SHORTCUTS.map((item) => (
          <StatCard
            key={item.title}
            title={item.title}
            description={item.description}
            icon={item.icon}
          />
        ))}
      </div>
    </section>
  );
}
