import type { CandidateDocumentType } from '@talento/shared';
import type { EducationLevel } from '@prisma/client';

export type ParsedCvWorkExperience = {
  companyName: string | null;
  country: string | null;
  positionTitle: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  functions: string | null;
  achievements: string | null;
};

export type ParsedCvEducation = {
  institution: string | null;
  program: string | null;
  educationLevel: EducationLevel | null;
  startDate: string | null;
  endDate: string | null;
  isStudying: boolean;
};

export type ParsedCvFields = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  documentType: CandidateDocumentType | null;
  documentNumber: string | null;
  professionalProfile: string | null;
  workExperience: ParsedCvWorkExperience[];
  education: ParsedCvEducation[];
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const MOBILE_RE = /(?:\+57[\s.-]*)?3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}/;
const LABELED_PHONE_RE =
  /(?:tel[eé]fono|celular|m[oó]vil|whatsapp)\s*[:.\s#-]*([+\d][\d\s().-]{6,20})/i;
const NAME_CHARS = 'A-ZÁÉÍÓÚÜÑa-záéíóúüñ ';
const SKIP_LINE =
  /^(curriculum|currículum|vitae|hoja de vida|cv|resume|perfil profesional|contacto|experiencia|educaci[oó]n|formaci[oó]n|habilidades|referencias)\b/i;

const SECTION_HEADERS: Array<{
  key: 'profile' | 'experience' | 'education' | 'other';
  re: RegExp;
}> = [
  {
    key: 'profile',
    re: /^(perfil(?:\s+profesional)?|resumen(?:\s+profesional)?|objetivo(?:\s+profesional)?|about\s+me)\b/i,
  },
  {
    key: 'experience',
    re: /^(experiencia(?:\s+laboral|\s+profesional)?|historial\s+laboral|work\s+experience)\b/i,
  },
  {
    key: 'education',
    re: /^(educaci[oó]n|formaci[oó]n(?:\s+acad[eé]mica)?|estudios|academic\s+background)\b/i,
  },
  {
    key: 'other',
    re: /^(habilidades|skills|idiomas|languages|referencias|certificaciones|cursos?\s+adicionales|informaci[oó]n\s+adicional)\b/i,
  },
];

const MONTHS: Record<string, number> = {
  ene: 1,
  enero: 1,
  jan: 1,
  january: 1,
  feb: 2,
  febrero: 2,
  february: 2,
  mar: 3,
  marzo: 3,
  march: 3,
  abr: 4,
  abril: 4,
  apr: 4,
  april: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  june: 6,
  jul: 7,
  julio: 7,
  july: 7,
  ago: 8,
  agosto: 8,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  septiembre: 9,
  set: 9,
  setiembre: 9,
  september: 9,
  oct: 10,
  octubre: 10,
  october: 10,
  nov: 11,
  noviembre: 11,
  november: 11,
  dic: 12,
  diciembre: 12,
  dec: 12,
  december: 12,
};

const CURRENT_RE =
  /\b(actualidad|actual|presente|hoy|current|present|en\s+curso)\b/i;

const MAX_SEGMENTS = 10;

export function parseCandidateFromCvText(raw: string): ParsedCvFields {
  const text = raw.replaceAll('\0', ' ').replaceAll('\r', '');
  const email = firstMatch(text, EMAIL_RE)?.toLowerCase() ?? null;
  const phone =
    normalizePhone(firstMatch(text, MOBILE_RE)) ??
    normalizePhone(labeledPhone(text));
  const document = parseDocument(text);
  const name = parseName(text);
  const sections = splitSections(text);

  return {
    firstName: name.firstName,
    lastName: name.lastName,
    email,
    phone,
    documentType: document.documentType,
    documentNumber: document.documentNumber,
    professionalProfile: parseProfile(sections.profile),
    workExperience: parseExperiences(sections.experience),
    education: parseEducations(sections.education),
  };
}

function parseDocument(
  text: string,
): Pick<ParsedCvFields, 'documentType' | 'documentNumber'> {
  const labeled: Array<{ type: CandidateDocumentType; re: RegExp }> = [
    {
      type: 'CC',
      re: /(?:c[eé]dula(?:\s+de\s+ciudadan[ií]a)?|c\.?\s*c\.?)\s*[:.\s#-]*([0-9][0-9.\s-]{4,18})/i,
    },
    {
      type: 'TI',
      re: /(?:tarjeta\s+de\s+identidad|t\.?\s*i\.?)\s*[:.\s#-]*([0-9][0-9.\s-]{4,18})/i,
    },
    {
      type: 'CE',
      re: /(?:c[eé]dula\s+de\s+extranjer[ií]a|c\.?\s*e\.?)\s*[:.\s#-]*([0-9][0-9.\s-]{4,18})/i,
    },
    {
      type: 'PASSPORT',
      re: /pasaporte\s*[:.\s#-]*([A-Z0-9][A-Z0-9\s-]{4,18})/i,
    },
  ];
  for (const item of labeled) {
    const match = item.re.exec(text);
    const documentNumber = normalizeDocument(match?.[1]);
    if (documentNumber) {
      return { documentType: item.type, documentNumber };
    }
  }
  const generic =
    /(?:documento(?:\s+de\s+identidad)?|n[uú]mero\s+de\s+documento)\s*[:.\s#-]*([0-9][0-9.\s-]{4,18})/i.exec(
      text,
    );
  const documentNumber = normalizeDocument(generic?.[1]);
  if (!documentNumber) {
    return { documentType: null, documentNumber: null };
  }
  return { documentType: 'CC', documentNumber };
}

function parseName(
  text: string,
): Pick<ParsedCvFields, 'firstName' | 'lastName'> {
  const firstLabel = labeledValue(
    text,
    new RegExp(`nombres?\\s*[:\\-]\\s*([${NAME_CHARS}]{2,80})`, 'i'),
  );
  const lastLabel = labeledValue(
    text,
    new RegExp(`apellidos?\\s*[:\\-]\\s*([${NAME_CHARS}]{2,80})`, 'i'),
  );
  if (firstLabel || lastLabel) {
    return {
      firstName: firstLabel,
      lastName: lastLabel,
    };
  }
  const full = labeledValue(
    text,
    new RegExp(
      `nombres?\\s+y\\s+apellidos?\\s*[:\\-]\\s*([${NAME_CHARS}]{3,80})`,
      'i',
    ),
  );
  if (full) return splitName(full);

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || SKIP_LINE.test(trimmed) || EMAIL_RE.test(trimmed)) continue;
    if (MOBILE_RE.test(trimmed) && /\d{7,}/.test(trimmed.replace(/\D/g, ''))) {
      continue;
    }
    if (!new RegExp(`^[${NAME_CHARS}]+$`).test(trimmed)) continue;
    if (trimmed.split(/\s+/).length < 2) continue;
    return splitName(trimmed);
  }
  return { firstName: null, lastName: null };
}

function splitName(
  full: string,
): Pick<ParsedCvFields, 'firstName' | 'lastName'> {
  const words = full.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { firstName: null, lastName: null };
  if (words.length === 1)
    return { firstName: words[0] ?? null, lastName: null };
  if (words.length === 2) {
    return { firstName: words[0] ?? null, lastName: words[1] ?? null };
  }
  if (words.length === 3) {
    return {
      firstName: words[0] ?? null,
      lastName: words.slice(1).join(' '),
    };
  }
  return {
    firstName: words.slice(0, 2).join(' '),
    lastName: words.slice(2).join(' '),
  };
}

function splitSections(text: string): Record<
  'profile' | 'experience' | 'education' | 'other' | 'header',
  string
> {
  const lines = text.split('\n');
  const buckets: Record<
    'profile' | 'experience' | 'education' | 'other' | 'header',
    string[]
  > = {
    profile: [],
    experience: [],
    education: [],
    other: [],
    header: [],
  };
  let current: keyof typeof buckets = 'header';
  for (const line of lines) {
    const trimmed = line.trim();
    const header = SECTION_HEADERS.find((item) => item.re.test(trimmed));
    if (header) {
      current = header.key;
      continue;
    }
    buckets[current].push(line);
  }
  return {
    profile: buckets.profile.join('\n').trim(),
    experience: buckets.experience.join('\n').trim(),
    education: buckets.education.join('\n').trim(),
    other: buckets.other.join('\n').trim(),
    header: buckets.header.join('\n').trim(),
  };
}

function parseProfile(section: string): string | null {
  const cleaned = section
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 20) return null;
  return cleaned.slice(0, 4000);
}

function parseExperiences(section: string): ParsedCvWorkExperience[] {
  if (!section.trim()) return [];
  const blocks = splitBlocks(section);
  const out: ParsedCvWorkExperience[] = [];
  for (const block of blocks) {
    if (out.length >= MAX_SEGMENTS) break;
    const item = parseExperienceBlock(block);
    if (item) out.push(item);
  }
  return out;
}

function parseEducations(section: string): ParsedCvEducation[] {
  if (!section.trim()) return [];
  const blocks = splitBlocks(section);
  const out: ParsedCvEducation[] = [];
  for (const block of blocks) {
    if (out.length >= MAX_SEGMENTS) break;
    const item = parseEducationBlock(block);
    if (item) out.push(item);
  }
  return out;
}

function splitBlocks(section: string): string[] {
  const lines = section
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const blocks: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    const startsNew =
      current.length > 0 &&
      (looksLikeDateRange(line) ||
        /^(empresa|compa[nñ][ií]a|cargo|puesto|instituci[oó]n|universidad|colegio)\s*[:\-]/i.test(
          line,
        ) ||
        (/^[A-ZÁÉÍÓÚÜÑ]/.test(line) &&
          line.length <= 80 &&
          !/^(funciones|logros|responsabilidades|descripci[oó]n)\b/i.test(
            line,
          )));
    if (startsNew && current.some((item) => looksLikeDateRange(item))) {
      blocks.push(current.join('\n'));
      current = [line];
      continue;
    }
    current.push(line);
  }
  if (current.length) blocks.push(current.join('\n'));
  return blocks.length > 0 ? blocks : [section];
}

function parseExperienceBlock(block: string): ParsedCvWorkExperience | null {
  const lines = block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const joined = lines.join('\n');
  const company =
    labeledField(joined, /(?:empresa|compa[nñ][ií]a)\s*[:\-]\s*(.+)/i) ??
    pickTitleLine(lines, /experiencia|funciones|logros|cargo|puesto/i);
  const position =
    labeledField(
      joined,
      /(?:cargo|puesto|posici[oó]n|rol)\s*[:\-]\s*(.+)/i,
    ) ??
    pickSecondaryLine(lines, company) ??
    null;
  const dates = extractDateRange(joined);
  const functions =
    labeledMultiline(joined, /(?:funciones|responsabilidades)\s*[:\-]\s*/i) ??
    null;
  const achievements =
    labeledMultiline(joined, /(?:logros|logros\s+clave|achievements)\s*[:\-]\s*/i) ??
    null;

  if (!company && !position) return null;

  return {
    companyName: clip(company, 200),
    country: clip(
      labeledField(joined, /(?:pa[ií]s|country)\s*[:\-]\s*(.+)/i),
      120,
    ),
    positionTitle: clip(position, 200),
    startDate: dates.startDate,
    endDate: dates.isCurrent ? null : dates.endDate,
    isCurrent: dates.isCurrent,
    functions: clip(functions, 4000),
    achievements: clip(achievements, 4000),
  };
}

function parseEducationBlock(block: string): ParsedCvEducation | null {
  const lines = block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return null;
  const joined = lines.join('\n');
  const institution =
    labeledField(
      joined,
      /(?:instituci[oó]n|universidad|colegio|escuela)\s*[:\-]\s*(.+)/i,
    ) ?? pickTitleLine(lines, /educaci|formaci|programa|t[ií]tulo|nivel/i);
  const program =
    labeledField(
      joined,
      /(?:programa|carrera|t[ií]tulo|estudios?)\s*[:\-]\s*(.+)/i,
    ) ?? pickSecondaryLine(lines, institution);
  const educationLevel =
    parseEducationLevel(joined) ??
    parseEducationLevel(program ?? '') ??
    parseEducationLevel(institution ?? '');
  const dates = extractDateRange(joined);
  const isStudying =
    dates.isCurrent ||
    /\b(estudiando|en\s+curso|cursando)\b/i.test(joined);

  if (!institution && !program) return null;

  return {
    institution: clip(institution, 200),
    program: clip(program, 200),
    educationLevel,
    startDate: dates.startDate,
    endDate: isStudying ? null : dates.endDate,
    isStudying,
  };
}

function parseEducationLevel(text: string): EducationLevel | null {
  const value = text.toLowerCase();
  if (/doctorado|ph\.?\s*d|doctorate/.test(value)) return 'DOCTORATE';
  if (/maestr[ií]a|mag[ií]ster|master'?s?|mba/.test(value)) return 'MASTER';
  if (/especializaci[oó]n|postgrado|posgrado/.test(value))
    return 'SPECIALIZATION';
  if (/profesional|pregrado|licenciatura|ingenier[ií]a|bachelor/.test(value))
    return 'PROFESSIONAL';
  if (/tecnol[oó]gic|technolog/.test(value)) return 'TECHNOLOGICAL';
  if (/t[eé]cnic/.test(value)) return 'TECHNICAL';
  if (/bachiller|secundaria|high\s+school/.test(value)) return 'HIGH_SCHOOL';
  if (/primaria|primary/.test(value)) return 'PRIMARY';
  if (/diplomado|diploma/.test(value)) return 'DIPLOMA';
  if (/curso|certificaci[oó]n|certificat/.test(value)) return 'COURSE';
  return null;
}

const DATE_TOKEN =
  '(?:\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{4}|\\d{1,2}[\\/\\-]\\d{4}|\\d{4}[\\/\\-]\\d{1,2}(?:[\\/\\-]\\d{1,2})?|(?:ene|enero|feb|febrero|mar|marzo|abr|abril|may|mayo|jun|junio|jul|julio|ago|agosto|sep|sept|septiembre|set|setiembre|oct|octubre|nov|noviembre|dic|diciembre|jan|january|february|march|apr|april|june|july|aug|august|september|october|november|dec|december)[a-z]*\\.?\\s+\\d{4}|\\d{4})';
const CURRENT_TOKEN =
  '(?:actualidad|actual|presente|hoy|current|present|en\\s+curso)';

function extractDateRange(text: string): {
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
} {
  const isCurrent = CURRENT_RE.test(text);
  const rangeRe = new RegExp(
    `(${DATE_TOKEN})\\s*(?:[-–—]|hasta|al|to)\\s*((?:${DATE_TOKEN}|${CURRENT_TOKEN}))`,
    'i',
  );
  const match = rangeRe.exec(text);
  if (match) {
    const startDate = normalizeDateToken(match[1]);
    const endToken = match[2];
    const endIsCurrent = CURRENT_RE.test(endToken);
    return {
      startDate,
      endDate: endIsCurrent ? null : normalizeDateToken(endToken),
      isCurrent: isCurrent || endIsCurrent,
    };
  }
  const single = normalizeDateToken(
    firstMatch(text, new RegExp(DATE_TOKEN, 'i')),
  );
  return { startDate: single, endDate: null, isCurrent };
}

function normalizeDateToken(value: string | undefined): string | null {
  if (!value) return null;
  const raw = value.trim().toLowerCase().replace(/\.$/, '');
  if (CURRENT_RE.test(raw)) return null;

  const iso = /^(\d{4})(?:[\/\-](\d{1,2})(?:[\/\-](\d{1,2}))?)?$/.exec(raw);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2] ?? '1');
    const day = Number(iso[3] ?? '1');
    return toIsoDate(year, month, day);
  }

  const dmy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(raw);
  if (dmy) {
    return toIsoDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  }

  const my = /^(\d{1,2})[\/\-](\d{4})$/.exec(raw);
  if (my) return toIsoDate(Number(my[2]), Number(my[1]), 1);

  const named = /^([a-záéíóúüñ]+)\.?\s+(\d{4})$/i.exec(raw);
  if (named) {
    const month = MONTHS[named[1].normalize('NFD').replace(/\p{M}/gu, '')];
    if (month) return toIsoDate(Number(named[2]), month, 1);
  }

  const yearOnly = /^(\d{4})$/.exec(raw);
  if (yearOnly) return toIsoDate(Number(yearOnly[1]), 1, 1);

  return null;
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (year < 1950 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function looksLikeDateRange(line: string): boolean {
  return (
    CURRENT_RE.test(line) ||
    (/\d{4}/.test(line) &&
      /[-–—]|hasta|al\b|to\b|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic/i.test(
        line,
      ))
  );
}

function pickTitleLine(lines: string[], skip: RegExp): string | null {
  for (const line of lines) {
    if (skip.test(line)) continue;
    if (looksLikeDateRange(line) && line.length < 40) continue;
    if (/^(funciones|logros|responsabilidades)\b/i.test(line)) continue;
    const cleaned = line.replace(/\s*[|·•]\s*/g, ' ').trim();
    if (cleaned.length >= 2) return cleaned.slice(0, 200);
  }
  return null;
}

function pickSecondaryLine(
  lines: string[],
  primary: string | null,
): string | null {
  for (const line of lines) {
    if (primary && line === primary) continue;
    if (looksLikeDateRange(line) && line.length < 40) continue;
    if (/^(funciones|logros|responsabilidades|empresa|cargo)\b/i.test(line))
      continue;
    if (EMAIL_RE.test(line)) continue;
    const cleaned = line.replace(/\s*[|·•]\s*/g, ' ').trim();
    if (cleaned.length >= 2) return cleaned.slice(0, 200);
  }
  return null;
}

function labeledField(text: string, re: RegExp): string | null {
  const match = re.exec(text);
  const value = match?.[1]?.split('\n')[0]?.trim();
  if (!value) return null;
  return value.slice(0, 200);
}

function labeledMultiline(text: string, re: RegExp): string | null {
  const match = re.exec(text);
  if (!match || match.index == null) return null;
  const after = text.slice(match.index + match[0].length).trim();
  const stop = after.search(
    /\n(?:empresa|compa[nñ][ií]a|cargo|puesto|instituci[oó]n|universidad|logros|funciones)\s*[:\-]/i,
  );
  const body = (stop >= 0 ? after.slice(0, stop) : after)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return body ? body.slice(0, 4000) : null;
}

function labeledPhone(text: string): string | undefined {
  return LABELED_PHONE_RE.exec(text)?.[1];
}

function labeledValue(text: string, re: RegExp): string | null {
  const match = re.exec(text);
  const value = match?.[1]?.trim().replace(/\s+/g, ' ');
  if (!value || SKIP_LINE.test(value) || EMAIL_RE.test(value)) return null;
  return value.slice(0, 100);
}

function normalizePhone(value: string | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7) return null;
  if (digits.startsWith('57') && digits.length >= 12) {
    return `+${digits}`;
  }
  return digits;
}

function normalizeDocument(value: string | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[.\s-]/g, '').trim();
  if (cleaned.length < 5 || cleaned.length > 80) return null;
  return cleaned;
}

function firstMatch(text: string, re: RegExp): string | undefined {
  return re.exec(text)?.[0];
}

function clip(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}
