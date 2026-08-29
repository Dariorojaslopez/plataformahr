import type { CandidateDocumentType } from '@talento/shared';

export type ParsedCvFields = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  documentType: CandidateDocumentType | null;
  documentNumber: string | null;
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const MOBILE_RE = /(?:\+57[\s.-]*)?3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}/;
const LABELED_PHONE_RE =
  /(?:tel[eé]fono|celular|m[oó]vil|whatsapp)\s*[:.\s#-]*([+\d][\d\s().-]{6,20})/i;
const NAME_CHARS = 'A-ZÁÉÍÓÚÜÑa-záéíóúüñ ';
const SKIP_LINE =
  /^(curriculum|currículum|vitae|hoja de vida|cv|resume|perfil profesional|contacto|experiencia|educaci[oó]n|formaci[oó]n|habilidades|referencias)\b/i;

export function parseCandidateFromCvText(raw: string): ParsedCvFields {
  const text = raw.replaceAll('\0', ' ').replaceAll('\r', '');
  const email = firstMatch(text, EMAIL_RE)?.toLowerCase() ?? null;
  const phone =
    normalizePhone(firstMatch(text, MOBILE_RE)) ??
    normalizePhone(labeledPhone(text));
  const document = parseDocument(text);
  const name = parseName(text);

  return {
    firstName: name.firstName,
    lastName: name.lastName,
    email,
    phone,
    documentType: document.documentType,
    documentNumber: document.documentNumber,
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
