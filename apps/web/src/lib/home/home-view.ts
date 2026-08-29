import {
  isCompanyHomeRole,
  resolveCompanyHomeRole,
  type CompanyHomeRole,
} from "@talento/shared";
import { resolveCompanyAccessForPath } from "@/lib/navigation";
import type { CompanyAccess, CurrentCompanyAccess } from "@/types/auth";

export type HomeConfigGroup =
  | "organization"
  | "ats"
  | "performance"
  | "system";

export type HomeShortcut = {
  href: string;
  title: string;
  description: string;
  group?: HomeConfigGroup;
};

export const HOME_CONFIG_GROUP_LABELS: Record<
  HomeConfigGroup,
  { title: string; description: string }
> = {
  organization: {
    title: "Configuración de organización",
    description: "Estructura, cargos, competencias, escalas y personas de la compañía.",
  },
  ats: {
    title: "Configuración del ATS",
    description: "Flujos de selección, niveles de aprobación, evaluadores y plantillas.",
  },
  performance: {
    title: "Configuración de performance",
    description: "Ciclos, población, calibración y objetivos organizacionales.",
  },
  system: {
    title: "Configuración del sistema",
    description: "Ajustes generales de la compañía.",
  },
};

const HOME_CONFIG_GROUP_ORDER: HomeConfigGroup[] = [
  "organization",
  "ats",
  "performance",
  "system",
];

export const HOME_ROLE_LABELS: Record<CompanyHomeRole, string> = {
  COLLABORATOR: "Colaborador",
  LEADER: "Líder",
  RECRUITER: "Reclutador",
  CLIENT_ADMIN: "Administrador",
  PERFORMANCE_MANAGER: "Gestor de performance",
};

export const HOME_SHORTCUTS: Record<CompanyHomeRole, HomeShortcut[]> = {
  COLLABORATOR: [
    {
      href: "/performance/my-evaluations",
      title: "Mis evaluaciones",
      description: "Responde y da seguimiento a tus evaluaciones.",
    },
    {
      href: "/performance/my-results",
      title: "Mis resultados",
      description: "Consulta tu desempeño cuando esté publicado.",
    },
    {
      href: "/goals",
      title: "Objetivos organizacionales",
      description: "Consulta los objetivos de la compañía.",
    },
    {
      href: "/ats/vacancy-requests",
      title: "Crear proceso de selección",
      description: "Pide una vacante cuando tu área lo necesite.",
    },
  ],
  LEADER: [
    {
      href: "/organization/org-chart",
      title: "Organigrama",
      description: "Mira cómo se reporta tu equipo.",
    },
    {
      href: "/performance/my-evaluations",
      title: "Mis evaluaciones",
      description: "Evalúa a tu equipo y completa las tuyas.",
    },
    {
      href: "/goals",
      title: "Objetivos organizacionales",
      description: "Consulta los objetivos de la compañía.",
    },
    {
      href: "/ats/vacancy-requests",
      title: "Mis procesos de selección",
      description: "Crea o aprueba pedidos de vacante de tu equipo.",
    },
  ],
  RECRUITER: [
    {
      href: "/ats/vacancies",
      title: "Vacantes",
      description: "Administra vacantes abiertas y su estado.",
    },
    {
      href: "/ats/candidates",
      title: "Candidatos",
      description: "Carga y actualiza el talento en proceso.",
    },
    {
      href: "/ats/pipeline",
      title: "Pipeline",
      description: "Mueve aplicaciones entre etapas.",
    },
    {
      href: "/ats/interviews",
      title: "Entrevistas",
      description: "Agenda y da seguimiento a entrevistas.",
    },
    {
      href: "/ats/vacancy-requests",
      title: "Crear proceso de selección",
      description: "Gestiona pedidos de vacante de la compañía.",
    },
  ],
  CLIENT_ADMIN: [
    {
      href: "/organization/employees",
      title: "Colaboradores",
      description: "Personas, cargos y datos de la compañía.",
      group: "organization",
    },
    {
      href: "/organization/org-chart",
      title: "Organigrama",
      description: "Reportes directos y estructura.",
      group: "organization",
    },
    {
      href: "/organization/business-units",
      title: "Unidades de negocio",
      description: "Agrupa áreas por unidad.",
      group: "organization",
    },
    {
      href: "/organization/areas",
      title: "Áreas",
      description: "Áreas y su relación con la compañía.",
      group: "organization",
    },
    {
      href: "/organization/positions",
      title: "Descripciones de cargo",
      description: "Catálogo de descripciones de cargo y plazas.",
      group: "organization",
    },
    {
      href: "/organization/job-levels",
      title: "Niveles",
      description: "Niveles de cargo y competencias.",
      group: "organization",
    },
    {
      href: "/organization/competencies",
      title: "Competencias",
      description: "Catálogo usado en niveles y evaluaciones.",
      group: "organization",
    },
    {
      href: "/organization/scales",
      title: "Escalas de calificación",
      description: "Escalas cualitativas y cuantitativas de la compañía.",
      group: "organization",
    },
    {
      href: "/organization/settings",
      title: "Ajustes de resultados",
      description: "Visibilidad del 9Box en mis resultados.",
      group: "organization",
    },
    {
      href: "/organization/position-fields",
      title: "Campos personalizados",
      description: "Campos extra en cargos y personas.",
      group: "organization",
    },
    {
      href: "/organization/import",
      title: "Importación masiva",
      description: "Carga masiva de la organización.",
      group: "organization",
    },
    {
      href: "/ats/settings/approvals",
      title: "Niveles de aprobación por defecto",
      description: "Cargos que aprueban un proceso de selección.",
      group: "ats",
    },
    {
      href: "/ats/settings/evaluators",
      title: "Evaluadores por defecto",
      description: "Cargos que evalúan en los procesos de selección.",
      group: "ats",
    },
    {
      href: "/ats/settings/active-processes",
      title: "Procesos activos",
      description: "Ajusta aprobadores o evaluadores de un proceso en curso.",
      group: "ats",
    },
    {
      href: "/ats/interview-templates",
      title: "Plantillas de entrevista",
      description: "Formularios de evaluación reutilizables.",
      group: "ats",
    },
    {
      href: "/performance/cycles",
      title: "Ciclos de desempeño",
      description: "Abre y administra ciclos de performance.",
      group: "performance",
    },
    {
      href: "/performance/population",
      title: "Población a evaluar",
      description: "Elige colaboradores y asígnalos a un ciclo activo.",
      group: "performance",
    },
    {
      href: "/performance/calibration",
      title: "Calibración",
      description: "Sesiones 9Box, invitados y líderes.",
      group: "performance",
    },
    {
      href: "/goals",
      title: "Objetivos organizacionales",
      description: "Consulta y configura el cascadeo de objetivos de compañía.",
      group: "performance",
    },
    {
      href: "/settings/branding",
      title: "Apariencia",
      description: "Nombre, color y logo de la compañía.",
      group: "system",
    },
  ],
  PERFORMANCE_MANAGER: [
    {
      href: "/performance/cycles",
      title: "Ciclos",
      description: "Abre y administra ciclos de desempeño.",
    },
    {
      href: "/performance/population",
      title: "Población a evaluar",
      description: "Asigna colaboradores a un ciclo activo.",
    },
    {
      href: "/performance/results",
      title: "Resultados",
      description: "Publica y consulta resultados del ciclo.",
    },
    {
      href: "/performance/calibration",
      title: "Calibración",
      description: "Configura sesiones y el 9Box.",
    },
    {
      href: "/organization/competencies",
      title: "Competencias",
      description: "Catálogo usado en evaluaciones.",
    },
    {
      href: "/organization/scales",
      title: "Escalas de calificación",
      description: "Escalas cualitativas y cuantitativas de la compañía.",
    },
    {
      href: "/goals",
      title: "Objetivos organizacionales",
      description: "Consulta los objetivos de la compañía.",
    },
  ],
};

export function homeDescription(
  homeRole: CompanyHomeRole,
  companyName: string,
): string {
  switch (homeRole) {
    case "CLIENT_ADMIN":
      return companyName
        ? `Administra ${companyName}: procesos de selección, perfil y configuración.`
        : "Administra la compañía: procesos de selección, perfil y configuración.";
    case "RECRUITER":
      return "Vacantes internas, tu perfil, los procesos que te asignaron y sus métricas.";
    case "LEADER":
      return "Vacantes internas, tu perfil, tareas asignadas y solicitudes de selección para tu equipo.";
    case "PERFORMANCE_MANAGER":
      return "Gestiona ciclos de desempeño, resultados y objetivos.";
    default:
      return "Tu espacio: vacantes internas, perfil y tareas que te asignen.";
  }
}

export function resolveHomeRoleFromAccess(
  access:
    | Pick<CurrentCompanyAccess, "homeRole" | "roleCodes" | "hasDirectReports">
    | CompanyAccess,
): CompanyHomeRole {
  if (
    "homeRole" in access &&
    access.homeRole &&
    isCompanyHomeRole(access.homeRole)
  ) {
    return access.homeRole;
  }
  if ("roleCodes" in access && Array.isArray(access.roleCodes)) {
    return resolveCompanyHomeRole(
      access.roleCodes,
      Boolean("hasDirectReports" in access && access.hasDirectReports),
    );
  }
  return "COLLABORATOR";
}

export function homeShortcutsFor(
  homeRole: CompanyHomeRole,
  access: CompanyAccess,
): HomeShortcut[] {
  const modules = new Set(access.enabledModules);
  const features = new Set(access.enabledFeatures);
  return HOME_SHORTCUTS[homeRole].filter((item) => {
    const required = resolveCompanyAccessForPath(item.href);
    return (
      !required ||
      (modules.has(required.module) && features.has(required.feature))
    );
  });
}

export function groupedHomeShortcuts(shortcuts: HomeShortcut[]): Array<{
  group: HomeConfigGroup;
  title: string;
  description: string;
  items: HomeShortcut[];
}> {
  return HOME_CONFIG_GROUP_ORDER.flatMap((group) => {
    const items = shortcuts.filter((item) => item.group === group);
    if (items.length === 0) return [];
    return [
      {
        group,
        title: HOME_CONFIG_GROUP_LABELS[group].title,
        description: HOME_CONFIG_GROUP_LABELS[group].description,
        items,
      },
    ];
  });
}
