import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ClipboardList,
  Gauge,
  GitBranch,
  LayoutDashboard,
  Layers3,
  Network,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
};

export type NavSection = {
  title?: string;
  items: NavItem[];
};

export const APP_NAV: NavSection[] = [
  {
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "Organización",
    items: [
      {
        label: "Colaboradores",
        href: "/organization/employees",
        icon: Users,
      },
      {
        label: "Unidades de negocio",
        href: "/organization/business-units",
        icon: Building2,
      },
      {
        label: "Áreas",
        href: "/organization/areas",
        icon: Network,
      },
      {
        label: "Cargos",
        href: "/organization/positions",
        icon: BriefcaseBusiness,
      },
      {
        label: "Niveles",
        href: "/organization/job-levels",
        icon: Layers3,
      },
    ],
  },
  {
    title: "ATS",
    items: [
      {
        label: "Solicitudes",
        href: "/ats/vacancy-requests",
        icon: ClipboardList,
      },
      {
        label: "Vacantes",
        href: "/ats/vacancies",
        icon: Building2,
      },
      {
        label: "Candidatos",
        href: "/ats/candidates",
        icon: Users,
      },
      {
        label: "Pipeline",
        href: "/ats/pipeline",
        icon: GitBranch,
      },
      {
        label: "Entrevistas",
        href: "/ats/interviews",
        icon: CalendarDays,
      },
    ],
  },
  {
    title: "Performance",
    items: [
      {
        label: "Performance",
        href: "/performance",
        icon: Gauge,
        disabled: true,
      },
    ],
  },
];

export function resolvePageTitle(pathname: string): string {
  for (const section of APP_NAV) {
    for (const item of section.items) {
      if (item.href === pathname) return item.label;
    }
  }
  if (pathname.startsWith("/organization/employees/")) return "Perfil";
  if (pathname.startsWith("/ats/vacancy-requests/")) return "Solicitud";
  if (pathname.startsWith("/ats/vacancies/")) return "Vacante";
  if (pathname.startsWith("/ats/candidates/")) return "Candidato";
  if (pathname.startsWith("/ats/applications/")) return "Aplicación";
  if (pathname === "/select-company") return "Seleccionar compañía";
  if (pathname === "/platform") return "Platform";
  return "Talento Sin Clave";
}
