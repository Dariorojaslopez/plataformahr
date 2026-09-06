import { parseCandidateFromCvText, type ParsedCvFields } from './cv-parse';

const LINKEDIN_IN_RE =
  /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9\-_%]+)\/?/i;

export const LINKEDIN_ERRORS = {
  EMPTY: 'Indica una URL de LinkedIn o pega el texto de tu perfil.',
  URL: 'La URL de LinkedIn no es válida. Usa un enlace /in/…',
  TEXT: 'No encontramos datos útiles en el texto pegado.',
} as const;

export type ParsedLinkedInFields = ParsedCvFields & {
  linkedinUrl: string | null;
};

export function normalizeLinkedInProfileUrl(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const match = LINKEDIN_IN_RE.exec(withProtocol);
  if (!match) return null;
  const vanity = decodeURIComponent(match[1]).replace(/\/+$/, '');
  if (!vanity || vanity.length > 120) return null;
  return `https://www.linkedin.com/in/${vanity}`;
}

export function extractLinkedInUrlFromText(text: string): string | null {
  const match = LINKEDIN_IN_RE.exec(text);
  if (!match) return null;
  return normalizeLinkedInProfileUrl(match[0]);
}

/** Normalize LinkedIn copy/paste headings before CV heuristics. */
export function normalizeLinkedInProfileText(raw: string): string {
  return raw
    .replaceAll('\r', '')
    .replace(/^\s*about\s*$/gim, 'Perfil profesional')
    .replace(/^\s*summary\s*$/gim, 'Perfil profesional')
    .replace(/^\s*experience\s*$/gim, 'Experiencia laboral')
    .replace(/^\s*education\s*$/gim, 'Educación')
    .replace(/^\s*licenses?\s*&\s*certifications?\s*$/gim, 'Formación')
    .trim();
}

export function parseLinkedInInput(input: {
  linkedinUrl?: string | null;
  profileText?: string | null;
}): ParsedLinkedInFields {
  const profileText = input.profileText?.trim() ?? '';
  const urlFromField = normalizeLinkedInProfileUrl(input.linkedinUrl);
  const urlFromText = profileText
    ? extractLinkedInUrlFromText(profileText)
    : null;
  const linkedinUrl = urlFromField ?? urlFromText;

  if (!profileText && !linkedinUrl) {
    return emptyParsed(null);
  }

  if (!profileText) {
    return emptyParsed(linkedinUrl);
  }

  const parsed = parseCandidateFromCvText(
    normalizeLinkedInProfileText(profileText),
  );
  return {
    ...parsed,
    linkedinUrl,
  };
}

export function hasLinkedInParsedData(parsed: ParsedLinkedInFields): boolean {
  return Boolean(
    parsed.linkedinUrl ||
    parsed.firstName ||
    parsed.lastName ||
    parsed.email ||
    parsed.phone ||
    parsed.documentNumber ||
    parsed.professionalProfile ||
    parsed.workExperience.length > 0 ||
    parsed.education.length > 0,
  );
}

function emptyParsed(linkedinUrl: string | null): ParsedLinkedInFields {
  return {
    firstName: null,
    lastName: null,
    email: null,
    phone: null,
    documentType: null,
    documentNumber: null,
    professionalProfile: null,
    workExperience: [],
    education: [],
    linkedinUrl,
  };
}
