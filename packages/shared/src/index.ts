export const APP_NAME = 'talento' as const;

export type HealthStatus = {
  status: 'ok';
};

export type ReadyStatus = {
  status: 'ready' | 'not_ready';
};

export function createHealthResponse(): HealthStatus {
  return { status: 'ok' };
}

export function createReadyResponse(ready: boolean): ReadyStatus {
  return { status: ready ? 'ready' : 'not_ready' };
}

/**
 * Canonical document types for Candidate writes.
 *
 * Candidate.documentType remains a free String? in Prisma so historical
 * values (free text) are not migrated or rejected on read. New CREATE/UPDATE
 * payloads may only set a catalog code (or omit/clear the field).
 */
export const CANDIDATE_DOCUMENT_TYPES = [
  { code: 'TI', label: 'Tarjeta de Identidad' },
  { code: 'CC', label: 'Cédula de Ciudadanía' },
  { code: 'CE', label: 'Cédula de Extranjería' },
  { code: 'PASSPORT', label: 'Pasaporte' },
] as const;

export type CandidateDocumentType =
  (typeof CANDIDATE_DOCUMENT_TYPES)[number]['code'];

export const CANDIDATE_DOCUMENT_TYPE_CODES: CandidateDocumentType[] =
  CANDIDATE_DOCUMENT_TYPES.map((item) => item.code);

export function isCandidateDocumentType(
  value: string,
): value is CandidateDocumentType {
  return (CANDIDATE_DOCUMENT_TYPE_CODES as readonly string[]).includes(value);
}

/** Friendly label for a catalog code; unknown historical values are returned as-is. */
export function candidateDocumentTypeLabel(
  code: string | null | undefined,
): string | null {
  if (!code) return null;
  const match = CANDIDATE_DOCUMENT_TYPES.find((item) => item.code === code);
  return match?.label ?? code;
}

export const COMPANY_ACCESS_CATALOG = [
  {
    code: 'ORGANIZATION',
    label: 'Organización',
    features: [
      { code: 'organization.employees', label: 'Colaboradores' },
      { code: 'organization.org-chart', label: 'Organigrama' },
      { code: 'organization.import', label: 'Importación masiva' },
      { code: 'organization.business-units', label: 'Unidades de negocio' },
      { code: 'organization.areas', label: 'Áreas' },
      { code: 'organization.positions', label: 'Descripciones de cargo' },
      { code: 'organization.position-fields', label: 'Campos personalizados' },
      { code: 'organization.job-levels', label: 'Niveles' },
    ],
  },
  {
    code: 'ATS',
    label: 'ATS',
    features: [
      { code: 'ats.vacancy-requests', label: 'Crear proceso de selección' },
      { code: 'ats.vacancies', label: 'Vacantes' },
      { code: 'ats.candidates', label: 'Candidatos' },
      { code: 'ats.pipeline', label: 'Pipeline' },
      { code: 'ats.interviews', label: 'Entrevistas' },
      { code: 'ats.interview-templates', label: 'Plantillas de entrevista' },
      { code: 'ats.approvals', label: 'Niveles de aprobación por defecto' },
    ],
  },
  {
    code: 'PERFORMANCE',
    label: 'Performance',
    features: [
      { code: 'performance.cycles', label: 'Ciclos' },
      { code: 'performance.population', label: 'Seleccionar población a evaluar' },
      { code: 'performance.my-evaluations', label: 'Mis evaluaciones' },
      { code: 'performance.my-results', label: 'Mis resultados' },
      { code: 'performance.results', label: 'Resultados' },
      { code: 'performance.calibration', label: 'Calibración' },
      { code: 'performance.competencies', label: 'Competencias' },
      { code: 'performance.scales', label: 'Escalas de calificación' },
    ],
  },
  {
    code: 'GOALS',
    label: 'Objetivos',
    features: [
      { code: 'goals.cycles', label: 'Periodos' },
      { code: 'goals.goals', label: 'Objetivos organizacionales' },
      { code: 'goals.mine', label: 'Mis objetivos' },
      { code: 'goals.team', label: 'Mi equipo' },
      { code: 'goals.reviews', label: 'Revisión de cierres' },
    ],
  },
  {
    code: 'SETTINGS',
    label: 'Configuración',
    features: [{ code: 'settings.branding', label: 'Apariencia' }],
  },
  {
    code: 'PREMIUM',
    label: 'Opciones premium',
    features: [
      { code: 'premium.digital-signature', label: 'Firma digital' },
      {
        code: 'premium.interview-recording',
        label: 'Grabación de la entrevista',
      },
      { code: 'premium.pdi', label: 'Generación de PDI' },
    ],
  },
] as const;

export type CompanyModuleCode = (typeof COMPANY_ACCESS_CATALOG)[number]['code'];
export type CompanyFeatureCode =
  (typeof COMPANY_ACCESS_CATALOG)[number]['features'][number]['code'];

export const COMPANY_MODULE_CODES: CompanyModuleCode[] =
  COMPANY_ACCESS_CATALOG.map(({ code }) => code);
export const COMPANY_FEATURE_CODES: CompanyFeatureCode[] =
  COMPANY_ACCESS_CATALOG.flatMap(({ features }) =>
    features.map(({ code }) => code),
  );

export function moduleForCompanyFeature(
  featureCode: string,
): CompanyModuleCode | null {
  return (
    COMPANY_ACCESS_CATALOG.find(({ features }) =>
      features.some(({ code }) => code === featureCode),
    )?.code ?? null
  );
}

export const PREMIUM_MODULE = 'PREMIUM' as const;

export const COMPANY_STANDARD_ACCESS_CATALOG = COMPANY_ACCESS_CATALOG.filter(
  (module) => module.code !== PREMIUM_MODULE,
);

export const PREMIUM_FEATURE_CODES = COMPANY_ACCESS_CATALOG.find(
  (module) => module.code === PREMIUM_MODULE,
)!.features.map(({ code }) => code);

export type PremiumFeatureCode = (typeof PREMIUM_FEATURE_CODES)[number];

export function isPremiumFeature(
  code: string,
): code is PremiumFeatureCode {
  return (PREMIUM_FEATURE_CODES as readonly string[]).includes(code);
}

export function splitCompanyAccess(
  enabledModules: readonly string[],
  enabledFeatures: readonly string[],
): {
  modules: CompanyModuleCode[];
  features: CompanyFeatureCode[];
  premiumFeatures: PremiumFeatureCode[];
} {
  const moduleSet = new Set(COMPANY_MODULE_CODES);
  const featureSet = new Set(COMPANY_FEATURE_CODES);
  const modules = enabledModules.filter(
    (code): code is CompanyModuleCode =>
      moduleSet.has(code as CompanyModuleCode) && code !== PREMIUM_MODULE,
  );
  const features = enabledFeatures.filter(
    (code): code is CompanyFeatureCode =>
      featureSet.has(code as CompanyFeatureCode) && !isPremiumFeature(code),
  );
  const premiumFeatures = enabledFeatures.filter(isPremiumFeature);
  return { modules, features, premiumFeatures };
}

export function mergeCompanyAccess(
  standardModules: readonly CompanyModuleCode[],
  standardFeatures: readonly CompanyFeatureCode[],
  premiumFeatures: readonly PremiumFeatureCode[],
): {
  enabledModules: CompanyModuleCode[];
  enabledFeatures: CompanyFeatureCode[];
} {
  const premium = [...new Set(premiumFeatures.filter(isPremiumFeature))];
  const modules = standardModules.filter((code) => code !== PREMIUM_MODULE);
  const features = standardFeatures.filter((code) => !isPremiumFeature(code));
  return {
    enabledModules: premium.length > 0 ? [...modules, PREMIUM_MODULE] : modules,
    enabledFeatures: [...features, ...premium],
  };
}

/**
 * Product home personas. PERFORMANCE_MANAGER is seeded in RBAC but is not
 * one of the four HOME roles in the product matrix; it still gets its own
 * view so those users are not dumped on the collaborator home.
 */
export const COMPANY_HOME_ROLES = [
  'CLIENT_ADMIN',
  'RECRUITER',
  'PERFORMANCE_MANAGER',
  'LEADER',
  'COLLABORATOR',
] as const;

export type CompanyHomeRole = (typeof COMPANY_HOME_ROLES)[number];

const HOME_ROLE_SET = new Set<string>(COMPANY_HOME_ROLES);

export function isCompanyHomeRole(value: string): value is CompanyHomeRole {
  return HOME_ROLE_SET.has(value);
}

/**
 * Picks the HOME persona when a membership has several company roles.
 * Precedence matches the product matrix: Administrador → Reclutador →
 * Gestor de performance → Líder (role or people reporting to them) →
 * Colaborador.
 */
export function resolveCompanyHomeRole(
  roleCodes: readonly string[],
  hasDirectReports: boolean,
): CompanyHomeRole {
  const roles = new Set(roleCodes);
  if (roles.has('CLIENT_ADMIN')) return 'CLIENT_ADMIN';
  if (roles.has('RECRUITER')) return 'RECRUITER';
  if (roles.has('PERFORMANCE_MANAGER')) return 'PERFORMANCE_MANAGER';
  if (roles.has('LEADER') || hasDirectReports) return 'LEADER';
  return 'COLLABORATOR';
}
