export const CONFIGURABLE_COMPANY_ROLES = [
  'ADMINISTRATOR',
  'RECRUITMENT_LEADER',
  'RECRUITER',
  'PERFORMANCE_MANAGER',
  'LEADER',
  'COLLABORATOR',
] as const;

export type ConfigurableCompanyRole =
  (typeof CONFIGURABLE_COMPANY_ROLES)[number];

export const ALWAYS_ALLOWED_NAV_HREFS = ['/dashboard'] as const;

export const ADMIN_ONLY_NAV_HREFS = ['/settings/roles'] as const;

export const ROLE_MENU_CATALOG = [
  {
    section: 'Organización',
    href: '/organization/employees',
    label: 'Colaboradores',
  },
  {
    section: 'Organización',
    href: '/organization/org-chart',
    label: 'Organigrama',
  },
  {
    section: 'Organización',
    href: '/organization/import',
    label: 'Importación masiva',
  },
  {
    section: 'Organización',
    href: '/organization/business-units',
    label: 'Unidades de negocio',
  },
  { section: 'Organización', href: '/organization/areas', label: 'Áreas' },
  {
    section: 'Organización',
    href: '/organization/positions',
    label: 'Descripciones de cargo',
  },
  {
    section: 'Organización',
    href: '/organization/position-fields',
    label: 'Campos personalizados',
  },
  { section: 'Organización', href: '/organization/job-levels', label: 'Niveles' },
  {
    section: 'Organización',
    href: '/organization/competencies',
    label: 'Competencias',
  },
  {
    section: 'Organización',
    href: '/organization/scales',
    label: 'Escalas de calificación',
  },
  {
    section: 'ATS',
    href: '/ats/vacancy-requests',
    label: 'Crear proceso de selección',
  },
  { section: 'ATS', href: '/ats/vacancies', label: 'Vacantes' },
  { section: 'ATS', href: '/ats/candidates', label: 'Candidatos' },
  { section: 'ATS', href: '/ats/pipeline', label: 'Tablero Kanban' },
  { section: 'ATS', href: '/ats/interviews', label: 'Entrevistas' },
  {
    section: 'ATS',
    href: '/ats/settings/approvals',
    label: 'Configuración ATS',
  },
  { section: 'Performance', href: '/performance/cycles', label: 'Ciclos' },
  {
    section: 'Performance',
    href: '/performance/my-evaluations',
    label: 'Mis evaluaciones',
  },
  {
    section: 'Performance',
    href: '/performance/my-results',
    label: 'Mis resultados',
  },
  { section: 'Performance', href: '/performance/results', label: 'Resultados' },
  {
    section: 'Performance',
    href: '/goals',
    label: 'Objetivos organizacionales',
  },
  { section: 'Performance', href: '/performance/9box', label: '9Box' },
  {
    section: 'Performance',
    href: '/performance/calibration',
    label: 'Calibración',
  },
  {
    section: 'Configuración',
    href: '/settings/branding',
    label: 'Apariencia',
  },
] as const;

export type RoleMenuHref = (typeof ROLE_MENU_CATALOG)[number]['href'];

const ROLE_MENU_HREF_SET = new Set<string>(
  ROLE_MENU_CATALOG.map((item) => item.href),
);

export const DEFAULT_ROLE_MENU_HREFS: Record<
  ConfigurableCompanyRole,
  readonly RoleMenuHref[]
> = {
  ADMINISTRATOR: ROLE_MENU_CATALOG.map((item) => item.href),
  RECRUITMENT_LEADER: [
    '/ats/vacancies',
    '/ats/candidates',
    '/ats/pipeline',
    '/ats/interviews',
    '/ats/vacancy-requests',
    '/ats/settings/approvals',
  ],
  COLLABORATOR: [
    '/performance/my-evaluations',
    '/performance/my-results',
    '/goals',
    '/ats/vacancy-requests',
  ],
  LEADER: [
    '/organization/org-chart',
    '/performance/my-evaluations',
    '/goals',
    '/ats/vacancy-requests',
  ],
  RECRUITER: [
    '/ats/vacancies',
    '/ats/candidates',
    '/ats/pipeline',
    '/ats/interviews',
    '/ats/vacancy-requests',
  ],
  PERFORMANCE_MANAGER: [
    '/performance/cycles',
    '/performance/results',
    '/performance/9box',
    '/performance/calibration',
    '/organization/competencies',
    '/organization/scales',
    '/goals',
  ],
};

export function isConfigurableCompanyRole(
  value: string,
): value is ConfigurableCompanyRole {
  return (CONFIGURABLE_COMPANY_ROLES as readonly string[]).includes(value);
}

const LEGACY_ROLE_MENU_HREFS: Record<string, RoleMenuHref> = {
  '/organization/settings': '/performance/9box',
  '/performance/settings': '/performance/9box',
  '/ats/interview-templates': '/ats/settings/approvals',
  '/performance/population': '/performance/cycles',
};

export function normalizeRoleMenuHref(href: string): string {
  return LEGACY_ROLE_MENU_HREFS[href] ?? href;
}

export function isGrantableNavHref(href: string): href is RoleMenuHref {
  return ROLE_MENU_HREF_SET.has(normalizeRoleMenuHref(href));
}

export function defaultMenuHrefsForRole(
  role: ConfigurableCompanyRole,
): string[] {
  return [...DEFAULT_ROLE_MENU_HREFS[role]];
}

export function resolveAllowedNavHrefs(input: {
  roleCodes: readonly string[];
  homeRole: string;
  catalogHrefs: readonly string[];
  overrides: Readonly<Record<string, readonly string[]>>;
}): string[] {
  const catalog = new Set(input.catalogHrefs);
  if (input.roleCodes.includes('CLIENT_ADMIN')) {
    return [...ALWAYS_ALLOWED_NAV_HREFS, ...ADMIN_ONLY_NAV_HREFS, ...catalog];
  }

  const roles = new Set<ConfigurableCompanyRole>();
  for (const code of input.roleCodes) {
    if (isConfigurableCompanyRole(code)) roles.add(code);
  }
  if (isConfigurableCompanyRole(input.homeRole)) roles.add(input.homeRole);
  if (roles.size === 0) roles.add('COLLABORATOR');

  const allowed = new Set<string>(ALWAYS_ALLOWED_NAV_HREFS);
  for (const role of roles) {
    const hrefs = input.overrides[role] ?? DEFAULT_ROLE_MENU_HREFS[role];
    for (const href of hrefs) {
      const normalized = normalizeRoleMenuHref(href);
      if (catalog.has(normalized) && isGrantableNavHref(normalized)) {
        allowed.add(normalized);
      }
    }
  }
  return [...allowed];
}

export function navGrantCoversPath(
  allowedHrefs: readonly string[],
  pathname: string,
): boolean {
  if (
    pathname === '/dashboard' ||
    ALWAYS_ALLOWED_NAV_HREFS.includes(pathname as '/dashboard')
  ) {
    return true;
  }
  const path = normalizeRoleMenuHref(pathname);
  for (const href of allowedHrefs) {
    const allowed = normalizeRoleMenuHref(href);
    if (path === allowed || path.startsWith(`${allowed}/`)) return true;
  }
  if (
    pathname.startsWith('/ats/settings/') &&
    allowedHrefs.includes('/ats/settings/approvals')
  ) {
    return true;
  }
  if (pathname === '/my-goals' && allowedHrefs.includes('/goals')) {
    return true;
  }
  return false;
}

export function configurableRoles(): ConfigurableCompanyRole[] {
  return [...CONFIGURABLE_COMPANY_ROLES];
}
