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
      { code: 'organization.positions', label: 'Cargos' },
      { code: 'organization.position-fields', label: 'Campos de cargos' },
      { code: 'organization.job-levels', label: 'Niveles' },
    ],
  },
  {
    code: 'ATS',
    label: 'ATS',
    features: [
      { code: 'ats.vacancy-requests', label: 'Solicitudes' },
      { code: 'ats.vacancies', label: 'Vacantes' },
      { code: 'ats.candidates', label: 'Candidatos' },
      { code: 'ats.pipeline', label: 'Pipeline' },
      { code: 'ats.interviews', label: 'Entrevistas' },
      { code: 'ats.interview-templates', label: 'Plantillas de entrevista' },
      { code: 'ats.approvals', label: 'Aprobación de solicitudes' },
    ],
  },
  {
    code: 'PERFORMANCE',
    label: 'Performance',
    features: [
      { code: 'performance.cycles', label: 'Ciclos' },
      { code: 'performance.my-evaluations', label: 'Mis evaluaciones' },
      { code: 'performance.my-results', label: 'Mis resultados' },
      { code: 'performance.results', label: 'Resultados' },
      { code: 'performance.competencies', label: 'Competencias' },
      { code: 'performance.scales', label: 'Escalas' },
    ],
  },
  {
    code: 'GOALS',
    label: 'Objetivos',
    features: [
      { code: 'goals.cycles', label: 'Periodos' },
      { code: 'goals.goals', label: 'Objetivos' },
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
