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
  ListChecks,
  Medal,
  Network,
  Palette,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  moduleForCompanyFeature,
  type CompanyFeatureCode,
  type CompanyModuleCode,
} from "@talento/shared";
import type { CompanyAccess } from "@/types/auth";

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
        label: "Organigrama",
        href: "/organization/org-chart",
        icon: Share2,
      },
      {
        label: "Importación masiva",
        href: "/organization/import",
        icon: Upload,
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
        label: "Campos personalizados de cargos",
        href: "/organization/position-fields",
        icon: ListChecks,
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
      {
        label: "Aprobación de solicitudes",
        href: "/ats/settings/approvals",
        icon: ShieldCheck,
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
  {
    title: "Configuración",
    items: [
      {
        label: "Apariencia",
        href: "/settings/branding",
        icon: Palette,
      },
    ],
  },
];

const NAV_FEATURE_BY_HREF: Record<string, CompanyFeatureCode> = {
  "/organization/employees": "organization.employees",
  "/organization/org-chart": "organization.org-chart",
  "/organization/import": "organization.import",
  "/organization/business-units": "organization.business-units",
  "/organization/areas": "organization.areas",
  "/organization/positions": "organization.positions",
  "/organization/position-fields": "organization.position-fields",
  "/organization/job-levels": "organization.job-levels",
  "/ats/vacancy-requests": "ats.vacancy-requests",
  "/ats/vacancies": "ats.vacancies",
  "/ats/candidates": "ats.candidates",
  "/ats/pipeline": "ats.pipeline",
  "/ats/interviews": "ats.interviews",
  "/ats/interview-templates": "ats.interview-templates",
  "/ats/settings/approvals": "ats.approvals",
  "/performance/cycles": "performance.cycles",
  "/performance/my-evaluations": "performance.my-evaluations",
  "/performance/my-results": "performance.my-results",
  "/performance/results": "performance.results",
  "/performance/competencies": "performance.competencies",
  "/performance/scales": "performance.scales",
  "/goals/cycles": "goals.cycles",
  "/goals": "goals.goals",
  "/my-goals": "goals.mine",
  "/goals/team": "goals.team",
  "/goals/reviews": "goals.reviews",
  "/settings/branding": "settings.branding",
};

export function resolveCompanyAccessForPath(pathname: string): {
  module: CompanyModuleCode;
  feature: CompanyFeatureCode;
} | null {
  const detailRoutes: Array<{
    prefix: string;
    module: CompanyModuleCode;
    feature: CompanyFeatureCode;
  }> = [
    {
      prefix: "/ats/applications",
      module: "ATS",
      feature: "ats.pipeline",
    },
    { prefix: "/ats/offers", module: "ATS", feature: "ats.pipeline" },
    {
      prefix: "/performance/evaluations",
      module: "PERFORMANCE",
      feature: "performance.my-evaluations",
    },
  ];
  const detail = detailRoutes.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (detail) return { module: detail.module, feature: detail.feature };
  const href = Object.keys(NAV_FEATURE_BY_HREF)
    .filter((candidate) => navHrefMatchesPath(candidate, pathname))
    .sort((a, b) => b.length - a.length)[0];
  if (!href) return null;
  const feature = NAV_FEATURE_BY_HREF[href];
  const moduleCode = moduleForCompanyFeature(feature);
  return moduleCode ? { module: moduleCode, feature } : null;
}

export function filterNavigation(
  sections: NavSection[],
  access: CompanyAccess,
): NavSection[] {
  const modules = new Set(access.enabledModules);
  const features = new Set(access.enabledFeatures);
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const required = resolveCompanyAccessForPath(item.href);
        return (
          !required ||
          (modules.has(required.module) && features.has(required.feature))
        );
      }),
    }))
    .filter((section) => section.items.length > 0);
}

export function flattenNavItems(sections: NavSection[] = APP_NAV): NavItem[] {
  return sections.flatMap((section) => section.items);
}

/** Exact href or a nested path under that href (`href/` + remainder). */
export function navHrefMatchesPath(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Among every nav item whose href matches the pathname, keep the longest
 * (most specific) href so a parent like `/goals` is not active together with
 * `/goals/cycles`, `/goals/team`, or `/goals/reviews`.
 */
export function resolveActiveNavHref(
  pathname: string,
  items: Array<Pick<NavItem, "href" | "disabled">> = flattenNavItems(),
): string | null {
  let best: string | null = null;
  for (const item of items) {
    if (item.disabled) continue;
    if (!navHrefMatchesPath(item.href, pathname)) continue;
    if (best === null || item.href.length > best.length) {
      best = item.href;
    }
  }
  return best;
}

export function isNavItemActive(pathname: string, href: string): boolean {
  return resolveActiveNavHref(pathname) === href;
}

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
  if (pathname === "/settings/branding") return "Apariencia";
  return "Talento";
}
