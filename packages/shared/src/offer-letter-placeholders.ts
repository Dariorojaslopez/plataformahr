/**
 * Placeholders for the company offer-letter Word template.
 * The uploaded .docx must use tokens like [Nombre]; later the ATS
 * replaces them from the job offer and candidate.
 */
export const OFFER_LETTER_PLACEHOLDERS = [
  { key: 'nombre', token: '[Nombre]', label: 'Nombre' },
  { key: 'cargo', token: '[Cargo]', label: 'Cargo' },
  {
    key: 'fechaDelDocumento',
    token: '[Fecha del documento]',
    label: 'Fecha del documento',
  },
  { key: 'salario', token: '[Salario]', label: 'Salario' },
  { key: 'formaDePago', token: '[Forma de Pago]', label: 'Forma de Pago' },
  {
    key: 'tipoDeContrato',
    token: '[Tipo de Contrato]',
    label: 'Tipo de Contrato',
  },
  { key: 'fechaDeInicio', token: '[Fecha de Inicio]', label: 'Fecha de Inicio' },
  { key: 'beneficios', token: '[Beneficios]', label: 'Beneficios' },
  { key: 'ciudad', token: '[Ciudad]', label: 'Ciudad' },
  { key: 'quienFirma', token: '[Quien firma]', label: 'Quien firma' },
] as const;

export type OfferLetterPlaceholder = (typeof OFFER_LETTER_PLACEHOLDERS)[number];
export type OfferLetterPlaceholderKey = OfferLetterPlaceholder['key'];
export type OfferLetterPlaceholderToken = OfferLetterPlaceholder['token'];

export type OfferLetterPlaceholderValues = Record<
  OfferLetterPlaceholderKey,
  string
>;

export const OFFER_LETTER_PLACEHOLDER_TOKENS = OFFER_LETTER_PLACEHOLDERS.map(
  (item) => item.token,
);

/** Longest tokens first so "[Fecha del documento]" is not split by shorter matches. */
const PLACEHOLDERS_BY_TOKEN_LENGTH = [...OFFER_LETTER_PLACEHOLDERS].sort(
  (a, b) => b.token.length - a.token.length,
);

export function emptyOfferLetterPlaceholderValues(): OfferLetterPlaceholderValues {
  return {
    nombre: '',
    cargo: '',
    fechaDelDocumento: '',
    salario: '',
    formaDePago: '',
    tipoDeContrato: '',
    fechaDeInicio: '',
    beneficios: '',
    ciudad: '',
    quienFirma: '',
  };
}

/**
 * Maps offer/candidate fields onto the Word tokens.
 * `beneficios` uses the offer notes until a dedicated field exists.
 */
export function buildOfferLetterPlaceholderValues(input: {
  candidateName?: string | null;
  positionTitle?: string | null;
  documentDate?: string | null;
  salary?: string | null;
  paymentForm?: string | null;
  contractType?: string | null;
  startDate?: string | null;
  benefits?: string | null;
  city?: string | null;
  signerName?: string | null;
}): OfferLetterPlaceholderValues {
  return {
    nombre: input.candidateName?.trim() ?? '',
    cargo: input.positionTitle?.trim() ?? '',
    fechaDelDocumento: input.documentDate?.trim() ?? '',
    salario: input.salary?.trim() ?? '',
    formaDePago: input.paymentForm?.trim() ?? '',
    tipoDeContrato: input.contractType?.trim() ?? '',
    fechaDeInicio: input.startDate?.trim() ?? '',
    beneficios: input.benefits?.trim() ?? '',
    ciudad: input.city?.trim() ?? '',
    quienFirma: input.signerName?.trim() ?? '',
  };
}

export function fillOfferLetterPlaceholders(
  text: string,
  values: OfferLetterPlaceholderValues,
): string {
  let filled = text;
  for (const item of PLACEHOLDERS_BY_TOKEN_LENGTH) {
    filled = filled.split(item.token).join(values[item.key]);
  }
  return filled;
}
