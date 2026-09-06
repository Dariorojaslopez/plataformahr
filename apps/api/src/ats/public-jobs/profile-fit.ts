export type ProfileFitLevel = 'green' | 'yellow' | 'red' | 'gray';

export type ProfileFitResult = {
  level: ProfileFitLevel;
  summary: string;
};

const FIT_SUMMARY: Record<ProfileFitLevel, string> = {
  green: 'Ajuste adecuado al perfil del cargo',
  yellow: 'Ajuste parcial al perfil del cargo',
  red: 'No se ajusta al perfil del cargo',
  gray: 'Sin suficiente información para evaluar el ajuste',
};

/** Common HR/job-description fluff that inflates false overlap. */
const STOPWORDS = new Set([
  'ano',
  'anos',
  'year',
  'years',
  'the',
  'and',
  'for',
  'with',
  'from',
  'this',
  'that',
  'del',
  'de',
  'la',
  'las',
  'los',
  'el',
  'en',
  'un',
  'una',
  'unos',
  'unas',
  'para',
  'por',
  'con',
  'sin',
  'sobre',
  'entre',
  'como',
  'mas',
  'muy',
  'tambien',
  'etc',
  'requisitos',
  'requeridos',
  'requerido',
  'requerida',
  'deseable',
  'deseables',
  'minimo',
  'minima',
  'maximo',
  'maxima',
  'inclusive',
  'incluyendo',
  'incluye',
  'debe',
  'deben',
  'contar',
  'inclusive',
  'incluyendo',
  'incluye',
  'vacante',
  'proceso',
  'seleccion',
  'descripcion',
]);

/** Expand tokens with common ATS/tech aliases (bidirectional). */
const SYNONYMS: Record<string, string[]> = {
  javascript: ['js'],
  js: ['javascript'],
  typescript: ['ts'],
  ts: ['typescript'],
  react: ['reactjs'],
  reactjs: ['react'],
  node: ['nodejs'],
  nodejs: ['node'],
  postgresql: ['postgres', 'psql'],
  postgres: ['postgresql', 'psql'],
  psql: ['postgresql', 'postgres'],
  kubernetesql: ['sqlserver'],
  sqlserver: ['mssql'],
  csharp: ['c#', 'dotnet'],
  'c#': ['csharp', 'dotnet'],
  dotnet: ['csharp'],
  python: ['py'],
  py: ['python'],
  kubernetes: ['k8s'],
  k8s: ['kubernetes'],
  profesional: ['pregrado', 'licenciatura', 'ingenieria'],
  pregrado: ['profesional'],
  licenciatura: ['profesional'],
  ingenieria: ['profesional'],
  maestria: ['master', 'magister'],
  master: ['maestria', 'magister'],
  magister: ['maestria', 'master'],
  doctorado: ['phd', 'doctorate'],
  phd: ['doctorado'],
  tecnologico: ['tecnologo'],
  tecnologo: ['tecnologico'],
  tecnico: ['technical'],
};

const EDUCATION_LEVEL_WORDS: Record<string, string[]> = {
  PRIMARY: ['primaria'],
  HIGH_SCHOOL: ['bachiller', 'bachillerato', 'secundaria'],
  TECHNICAL: ['tecnico'],
  TECHNOLOGICAL: ['tecnologo', 'tecnologico'],
  PROFESSIONAL: ['profesional', 'pregrado', 'licenciatura', 'ingenieria'],
  SPECIALIZATION: ['especializacion', 'posgrado', 'postgrado'],
  MASTER: ['maestria', 'master', 'magister', 'mba'],
  DOCTORATE: ['doctorado', 'phd'],
  DIPLOMA: ['diplomado', 'diploma'],
  COURSE: ['curso', 'certificacion'],
};

/**
 * Keyword overlap between candidate profile and job requirements.
 * Weights required experience/education higher than JD fluff; screening modulates.
 */
export function computeProfileFit(input: {
  jobText: string;
  /** Preferencia: experiencia/formación requerida del cargo. */
  requiredText?: string;
  candidateText: string;
  screeningPassed: boolean;
  screeningCorrectCount: number;
  screeningTotal: number;
}): ProfileFitResult {
  const requiredTokens = tokenize(input.requiredText ?? '');
  const contextTokens = tokenize(input.jobText);
  const candidateTokens = tokenize(input.candidateText);

  if (
    requiredTokens.size === 0 &&
    contextTokens.size === 0 &&
    candidateTokens.size === 0
  ) {
    if (input.screeningTotal > 0 && input.screeningPassed) {
      return { level: 'yellow', summary: FIT_SUMMARY.yellow };
    }
    return { level: 'gray', summary: FIT_SUMMARY.gray };
  }

  if (requiredTokens.size === 0 && contextTokens.size === 0) {
    return screeningOnlyFit(input);
  }

  const requiredOverlap = overlapRatio(requiredTokens, candidateTokens);
  const contextOverlap = overlapRatio(contextTokens, candidateTokens);
  const screeningBoost =
    input.screeningTotal > 0
      ? input.screeningCorrectCount / input.screeningTotal
      : 0.55;

  let score: number;
  if (requiredTokens.size > 0 && contextTokens.size > 0) {
    score =
      requiredOverlap * 0.5 + contextOverlap * 0.2 + screeningBoost * 0.3;
  } else if (requiredTokens.size > 0) {
    score = requiredOverlap * 0.7 + screeningBoost * 0.3;
  } else {
    score = contextOverlap * 0.7 + screeningBoost * 0.3;
  }

  if (!input.screeningPassed && input.screeningTotal > 0) {
    return {
      level: 'red',
      summary: `${FIT_SUMMARY.red} (screening no aprobado)`,
    };
  }

  const detail = summarizeOverlap({
    requiredOverlap,
    contextOverlap,
    hasRequired: requiredTokens.size > 0,
    hasContext: contextTokens.size > 0,
  });

  if (score >= 0.48) {
    return { level: 'green', summary: `${FIT_SUMMARY.green}${detail}` };
  }
  if (score >= 0.28) {
    return { level: 'yellow', summary: `${FIT_SUMMARY.yellow}${detail}` };
  }
  return { level: 'red', summary: `${FIT_SUMMARY.red}${detail}` };
}

function screeningOnlyFit(input: {
  screeningPassed: boolean;
  screeningCorrectCount: number;
  screeningTotal: number;
}): ProfileFitResult {
  if (input.screeningTotal === 0) {
    return { level: 'gray', summary: FIT_SUMMARY.gray };
  }
  if (!input.screeningPassed) {
    return {
      level: 'red',
      summary: `${FIT_SUMMARY.red} (screening no aprobado)`,
    };
  }
  const ratio = input.screeningCorrectCount / input.screeningTotal;
  if (ratio >= 0.85) return { level: 'green', summary: FIT_SUMMARY.green };
  return { level: 'yellow', summary: FIT_SUMMARY.yellow };
}

function overlapRatio(jobTokens: Set<string>, candidateTokens: Set<string>): number {
  if (jobTokens.size === 0) return 0;
  let hits = 0;
  for (const token of jobTokens) {
    if (candidateTokens.has(token)) hits += 1;
  }
  return hits / jobTokens.size;
}

function summarizeOverlap(input: {
  requiredOverlap: number;
  contextOverlap: number;
  hasRequired: boolean;
  hasContext: boolean;
}): string {
  const parts: string[] = [];
  if (input.hasRequired) {
    parts.push(`requisitos ${Math.round(input.requiredOverlap * 100)}%`);
  }
  if (input.hasContext) {
    parts.push(`descripción ${Math.round(input.contextOverlap * 100)}%`);
  }
  return parts.length ? ` · ${parts.join(', ')}` : '';
}

export function tokenize(text: string): Set<string> {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  const matches = normalized.match(/[\p{L}\p{N}+#]{2,}/gu) ?? [];
  const out = new Set<string>();
  for (const raw of matches) {
    const token = raw.replace(/^#+|#+$/g, '');
    if (token.length < 2) continue;
    if (token.length < 3 && !/^[a-z]{2}$/.test(token) && !/^\d/.test(token)) {
      continue;
    }
    if (STOPWORDS.has(token)) continue;
    addWithSynonyms(out, token);
    const educationWords = EDUCATION_LEVEL_WORDS[token.toUpperCase()];
    if (educationWords) {
      for (const word of educationWords) addWithSynonyms(out, word);
    }
  }
  return out;
}

function addWithSynonyms(target: Set<string>, token: string): void {
  target.add(token);
  for (const alias of SYNONYMS[token] ?? []) {
    target.add(alias);
  }
}

export function buildCandidateFitText(
  parts: Array<string | null | undefined>,
): string {
  return parts.filter((part) => part?.trim()).join('\n');
}

export function buildJobFitText(
  parts: Array<string | null | undefined>,
): string {
  return parts.filter((part) => part?.trim()).join('\n');
}
