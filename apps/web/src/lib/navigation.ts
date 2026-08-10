import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  FileText,
  Gauge,
  GitBranch,
  LayoutDashboard,
  Layers3,
  Medal,
  Network,
  SlidersHorizontal,
  Target,
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
      {
        label: "Plantillas de entrevista",
        href: "/ats/interview-templates",
        icon: FileText,
      },
    ],
  },
  {
    title: "Performance",
    items: [
      {
        label: "Ciclos",
        href: "/performance/cycles",
        icon: Gauge,
      },
      {
        label: "Mis evaluaciones",
        href: "/performance/my-evaluations",
        icon: ClipboardList,
      },
      {
        label: "Mis resultados",
        href: "/performance/my-results",
        icon: Medal,
      },
      {
        label: "Resultados",
        href: "/performance/results",
        icon: ChartColumn,
      },
      {
        label: "Competencias",
        href: "/performance/competencies",
        icon: Target,
      },
      {
        label: "Escalas",
        href: "/performance/scales",
        icon: SlidersHorizontal,
      },
    ],
  },
  {
    title: "Objetivos",
    items: [
      {
        label: "Periodos",
        href: "/goals/cycles",
        icon: CalendarDays,
      },
      {
        label: "Objetivos",
        href: "/goals",
        icon: Target,
      },
      {
        label: "Mis objetivos",
        href: "/my-goals",
        icon: Medal,
      },
      {
        label: "Mi equipo",
        href: "/goals/team",
        icon: Users,
      },
      {
        label: "Revisión de cierres",
        href: "/goals/reviews",
        icon: ClipboardList,
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
  if (pathname.startsWith("/ats/interviews/")) return "Entrevista";
  if (pathname === "/ats/interview-templates") return "Plantillas de entrevista";
  if (pathname.startsWith("/performance/cycles/")) return "Ciclo";
  if (pathname.startsWith("/performance/scales/")) return "Escala";
  if (pathname.startsWith("/performance/evaluations/")) return "Evaluación";
  if (pathname.startsWith("/performance/results/")) return "Resultado";
  if (pathname.startsWith("/performance/my-results/")) return "Mi resultado";
  if (pathname === "/performance/my-evaluations") return "Mis evaluaciones";
  if (pathname === "/performance/my-results") return "Mis resultados";
  if (pathname === "/performance/results") return "Resultados";
  if (pathname === "/performance") return "Performance";
  if (pathname.startsWith("/goals/cycles/")) return "Periodo de objetivos";
  if (pathname === "/goals/team") return "Mi equipo";
  if (pathname === "/goals/reviews") return "Revisión de cierres";
  if (pathname.startsWith("/goals/") && pathname !== "/goals/cycles")
    return "Objetivo";
  if (pathname === "/goals/cycles") return "Periodos";
  if (pathname === "/goals") return "Objetivos";
  if (pathname === "/my-goals") return "Mis objetivos";
  if (pathname === "/select-company") return "Seleccionar compañía";
  if (pathname === "/platform") return "Platform";
  return "Talento";
}
